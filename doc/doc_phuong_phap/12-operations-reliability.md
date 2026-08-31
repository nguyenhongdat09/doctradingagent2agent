# 12 — Operations, Reliability & Error Handling

> Đặc tả xử lý lỗi, khởi động/phục hồi, monitoring, và SYSTEM_FREEZE cho hệ thống Trading Agent DCA.
> Nguyên tắc: ALL-LLM — engine không tự ra lệnh; khi LLM down → FREEZE + Boss.

---

## 1. SYSTEM_FREEZE — Khi LLM Không Khả Dụng

### 1.1 Trigger FREEZE

| Sự kiện | Hành động |
|---|---|
| LLM API timeout (> `InpLlmTimeoutMs`, default 30000ms) | Retry tối đa `InpLlmMaxRetries` lần (default 3) |
| Retry hết → vẫn fail | `SYSTEM_FREEZE = true` |
| LLM trả lỗi 4xx/5xx | Tương tự: retry → freeze |
| LLM trả output malformed (parse fail) | Retry 1 lần → nếu lại fail → freeze |
| Rate limit (429) | Backoff exponential → nếu quá `InpLlmRateLimitWaitMax` (default 300s) → freeze |

### 1.2 Hành vi khi FREEZE

```
SYSTEM_FREEZE = true:
  1. Mọi action → ĐÓNG BĂNG: engine KHÔNG tự DCA/close/entry
  2. Mọi position → GIỮ NGUYÊN (pair state không đổi)
  3. Executor Thread: vẫn chạy nhưng không có PENDING mới (hết queue thì idle)
  4. Alert Boss: ALERT_LLM_OUTAGE (critical) + snapshot positions
  5. Log: ghi timestamp, lý do, retry_count vào AuditLog
  6. Retry LLM: exponential backoff (30s → 60s → 120s → 240s → cap 300s)
```

### 1.3 Thoát FREEZE & Auto-Resume với Light Reconcile

```
Khi LLM API phản hồi thành công:
  1. SYSTEM_FREEZE = false
  2. Log: LLM_RECOVERED + downtime_duration
  3. Alert Boss: "LLM khôi phục — hệ thống auto-resume"
  4. Light Reconcile (bắt buộc):
     - Gọi ReconcileSymbol() nhanh cho 4 cặp: refresh positions thực tế từ MT5 vs PairState trong DB
     - Đảm bảo TotalLot, BasketDir, OpenTickets đúng thực tế trước khi agents bắt đầu chu kỳ mới
  5. Resume agent cycle bình thường theo wake schedule
  6. Agents xem xét mọi position hiện tại với snapshot mới nhất
```

Hoặc: Boss can thiệp thủ công (kill-switch, flatten, chờ).

### 1.4 Tham số

| Tham số | Default | Mô tả |
|---------|---------|-------|
| `InpLlmTimeoutMs` | 30000 | Timeout 1 lần gọi LLM (ms) |
| `InpLlmMaxRetries` | 3 | Số lần retry trước khi freeze |
| `InpLlmBackoffBaseMs` | 30000 | Base backoff khi retry trong freeze |
| `InpLlmBackoffMaxMs` | 300000 | Cap backoff (5 phút) |
| `InpLlmRateLimitWaitMax` | 300 | Tối đa chờ rate limit (giây) trước freeze |

### 1.5 KHÔNG có auto-degrade

- **KHÔNG** chuyển về rule-only khi LLM down
- **KHÔNG** auto-flatten sau N phút
- Kill-switch **KHÔNG** tự kích hoạt — chỉ Boss/operator bật thủ công
- Lý do: ALL-LLM — khi não hỏng, dừng lại + gọi người

---

## 2. Error Handling — Executor & MT5

### 2.1 OrderSend Failure

| Lỗi | Hành động | State |
|-----|-----------|-------|
| `TRADE_RETCODE_DONE` | Success → Archive | Cập nhật PairState |
| `TRADE_RETCODE_REJECT` / `INVALID` | Ghi FAILED + error → Alert | PairState **không đổi** |
| Timeout (MT5 không trả kết quả) | Retry 1 lần sau 2s → nếu vẫn fail → FAILED + check positions | Reconcile (§3) |
| Partial fill (khớp ít hơn lot yêu cầu) | Archive với `executed_lot` thực tế → cập nhật TotalLot theo lot thực | PairState cập nhật theo thực tế |
| Network error / MT5 disconnect | Retry với backoff → nếu fail → FAILED + Alert Boss | Giữ nguyên |

### 2.2 CLOSE_ALL Execution Detail

```
function ExecuteCloseAll(symbol, magic):
  positions = get_positions(symbol, magic)   // tất cả positions
  closed = []
  failed = []

  for p in positions (sorted by |profit| ascending — lỗ nhỏ nhất trước):
    result = mt5.order_send(close_request(p.ticket))
    if result.retcode == TRADE_RETCODE_DONE:
      closed.append(p.ticket)
    else:
      failed.append({ticket: p.ticket, error: result.comment})
      // Retry 1 lần
      result2 = mt5.order_send(close_request(p.ticket))
      if result2.retcode == TRADE_RETCODE_DONE:
        closed.append(p.ticket)
      else:
        failed.append({ticket: p.ticket, error: result2.comment, retried: true})

  // Kết quả
  if len(failed) == 0:
    // Thành công: tất cả đóng
    TotalLot = 0 → FLAT
    Archive all → ExecutionReport(status=FILLED)
  else:
    // Partial success: một số lệnh chưa đóng được
    refresh TotalLot từ MT5 positions thực tế
    if TotalLot == 0:
      FLAT (MT5 đã đóng hết dù report fail)
    else:
      // GIỮ NGUYÊN state (NORMAL/RECOVERY)
      Alert Boss: "CLOSE_ALL partial fail — {len(failed)} lệnh chưa đóng"
      ExecutionReport(status=PARTIAL, error=detail)
      // A+B sẽ xử lý trong cycle tiếp theo
```

### 2.3 MT5 Connection Loss

```
Executor:
  1. Detect: mt5.terminal_info() fail hoặc mt5.last_error() != 0
  2. Log: MT5_DISCONNECTED + timestamp
  3. Retry connect: exponential backoff (5s → 10s → 30s → cap 60s)
  4. Trong khi disconnect:
     - KHÔNG enqueue mới (gate: mt5_healthy flag)
     - PENDING trong queue giữ nguyên (chờ reconnect)
     - Alert Boss nếu disconnect > 5 phút
  5. Khi reconnect:
     - Reconcile positions (§3)
     - Resume Executor polling
```

---

## 3. Startup / Initialization / Reconciliation

### 3.1 Startup Protocol

```
function SystemStartup():
  1. Init SQLite connections (dca_<symbol>.db × 4 + experience.db)
     - PRAGMA journal_mode=WAL, busy_timeout=5000, foreign_keys=ON
  2. Init MT5 connection (mt5.initialize + mt5.login)
     - Fail → retry 3 lần → nếu fail → exit + log
  3. Reconcile mỗi symbol (§3.2)
  4. Check LLM API health → OK thì tiếp; fail → SYSTEM_FREEZE ngay
  5. Load config (YAML/ENV)
  6. Start Executor Thread
  7. Start Orchestrator loop
     - Mỗi symbol: đọc PairState → set initial wake theo state
  8. Log: SYSTEM_STARTUP_COMPLETE
```

### 3.2 Reconciliation — So khớp MT5 vs DB

```
function ReconcileSymbol(symbol, magic):
  db_state = PairState.load(symbol)
  mt5_positions = mt5.positions_get(symbol=symbol, magic=magic)
  mt5_total_lot = sum(p.volume for p in mt5_positions)

  // Case 1: DB khớp MT5
  if abs(db_state.total_lot - mt5_total_lot) < epsilon:
    OK — tiếp tục bình thường

  // Case 2: MT5 có lệnh, DB nói FLAT (crash sau entry nhưng trước update DB)
  if mt5_total_lot > 0 and db_state.state == 'FLAT':
    Alert Boss: "Desync — MT5 có lệnh nhưng DB ghi FLAT"
    // Reconstruct state từ MT5
    db_state.state = NORMAL if mt5_total_lot < R_TH else RECOVERY
    db_state.total_lot = mt5_total_lot
    db_state.basket_dir = infer_from_positions(mt5_positions)
    db_state.save()

  // Case 3: DB có lệnh, MT5 không có (manual close / broker stop-out)
  if mt5_total_lot == 0 and db_state.state != 'FLAT':
    Alert Boss: "Desync — DB ghi {state} nhưng MT5 không có position"
    db_state → FLAT (reset all)
    db_state.save()

  // Case 4: Lot lệch (partial close ngoài hệ thống?)
  if mt5_total_lot > 0 and abs(db_state.total_lot - mt5_total_lot) >= epsilon:
    Alert Boss: "Lot lệch — DB={db_state.total_lot}, MT5={mt5_total_lot}"
    db_state.total_lot = mt5_total_lot  // trust MT5
    db_state.state = recalc_state(mt5_total_lot)
    db_state.save()

  // Clean orphan queue entries
  orphans = MarketOrderInfo.where(status IN ('PENDING','PROCESSING'))
  for o in orphans:
    if o.status == 'PROCESSING':
      // May have been interrupted mid-execution
      check if position exists for this plan_id
      if exists: Archive(FILLED) else: Archive(FAILED, "orphan after restart")
    if o.status == 'PENDING':
      // Cancel — agents sẽ re-evaluate trong cycle mới
      o.status = 'CANCELLED'
      Archive(CANCELLED, "orphan after restart")
```

### 3.3 Warm-up Data

| Dữ liệu | Minimum cần | Mục đích |
|---|---|---|
| D1 OHLC closed | 60 bars | StructureEngine buffer (pivot confirm radius 3 + 6 swings) |
| H1 OHLC closed | 30 bars | SignalEngine + snapshot LLM |
| ATR14 D1/H1 | 14 bars (trong 60/30 trên) | Spacing, momentum |

Engine phải fetch đủ warm-up data trước khi chạy cycle đầu tiên.

---

## 4. Monitoring — Phase 1 (Minimal)

### 4.1 Heartbeat Engine

```
Mỗi 60 giây:
  ghi timestamp vào file/DB heartbeat
  Nếu external monitor không thấy heartbeat > 5 phút → alert
```

### 4.2 MT5 Connection Health

```
Mỗi cycle (hoặc mỗi 30 giây):
  check mt5.terminal_info()
  if fail → set mt5_healthy = false → gate chặn enqueue mới
  log status
```

### 4.3 Queue Backlog

```
Mỗi 5 phút:
  count = MarketOrderInfo.where(status='PENDING').count()
  if count > InpMaxQueueBacklog (default 5):
    Alert: "Queue backlog — {count} lệnh PENDING chờ xử lý"
  oldest_pending_age = now - oldest_pending.created_at
  if oldest_pending_age > InpMaxPendingAge (default 300s):
    Alert: "Lệnh PENDING quá cũ — có thể Executor bị stuck"
```

### 4.4 Phase 2 (mở rộng sau)

- LLM API health / latency / cost tracking
- Spread / slippage alert
- Margin level warning
- Wake schedule drift detection

---

## 5. Tham số Operations

| Tham số | Default | Mô tả |
|---------|---------|-------|
| `InpLlmTimeoutMs` | 30000 | Timeout LLM call |
| `InpLlmMaxRetries` | 3 | Retries trước freeze |
| `InpLlmBackoffBaseMs` | 30000 | Base backoff freeze retry |
| `InpLlmBackoffMaxMs` | 300000 | Cap backoff |
| `InpMt5ReconnectBaseMs` | 5000 | Base backoff MT5 reconnect |
| `InpMt5ReconnectMaxMs` | 60000 | Cap MT5 backoff |
| `InpMt5DisconnectAlertMinutes` | 5 | Alert Boss nếu disconnect > N phút |
| `InpMaxQueueBacklog` | 5 | Alert nếu PENDING > N |
| `InpMaxPendingAge` | 300 | Alert nếu PENDING cũ > N giây |
| `InpHeartbeatInterval` | 60 | Ghi heartbeat mỗi N giây |
| `InpCloseAllRetryCount` | 1 | Retry close nếu fail |

---

## 6. Liên kết

- State machine: [06-state-machine.md](06-state-machine.md) §7.2 (SYSTEM_FREEZE)
- Message schemas: [../doc_agents/04-message-schemas.md](../doc_agents/04-message-schemas.md) §8 (SystemFreezeEvent)
- Autonomy: [../doc_agents/10-autonomy-constraints.md](../doc_agents/10-autonomy-constraints.md)
- ERRATA: [../ERRATA.md](../ERRATA.md) DEC-08
