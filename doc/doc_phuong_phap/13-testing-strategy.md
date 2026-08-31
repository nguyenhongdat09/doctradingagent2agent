# 13 — Testing Strategy

> Chiến lược kiểm thử cho hệ thống Trading Agent DCA.
> Nguyên tắc: ALL-LLM — không test "engine tự quyết"; test "LLM quyết định đúng phương pháp, được hỗ trợ bởi engine".

---

## 1. Phân Loại Test

| Loại | Mục đích | Engine tự chạy? |
|------|----------|-----------------|
| Unit Test | Kiểm tra từng module (StructureEngine, SignalEngine, HardValidator) | ✅ Tự động |
| Integration Test | State machine transitions, DB operations, queue flow | ✅ Tự động |
| LLM Decision Test | Agent A/B ra quyết định đúng phương pháp | ⚠️ Cần LLM call (hoặc mock) |
| Scenario Test | End-to-end với dữ liệu historical | ⚠️ Cần LLM call |
| Forward Test | Paper trading real-time trước khi live | ❌ Manual |

---

## 2. Unit Tests — Engine (Mắt)

> Engine = cảm biến. Test output **dữ liệu**, không test quyết định.

### 2.1 StructureEngine

| Test case | Input | Expected output |
|-----------|-------|----------------|
| Pivot High confirm | 7 bars D1 OHLC với PH tại bar 3 | PH detected, price/time đúng |
| Pivot Low confirm | 7 bars tương tự | PL detected |
| Pivot not confirmed (chưa đủ 3 bar sau) | 5 bars | Không detect |
| HH/HL pattern | 4 swings: PL₁ < PL₂, PH₁ < PH₂ | HH+HL = true |
| LH/LL pattern | 4 swings: PL₁ > PL₂, PH₁ > PH₂ | LH+LL = true |
| BOS up | Close > pivot high gần nhất | last_BOS = up |
| BOS down | Close < pivot low gần nhất | last_BOS = down |
| Range compress | Swing range / ATR14 ≤ 1.5 | range_compress ≤ 1.5 |
| Hysteresis — giữ context cũ | Mixed swings, chưa đủ 2 cùng dấu | PrevContext giữ nguyên |
| Hysteresis — cho phép đổi | 2 swing cùng dấu HOẶC strong BOS | Context đổi |

### 2.2 SignalEngine (H1 Strength Score)

| Test case | Input | Expected |
|-----------|-------|----------|
| Strong bullish bar | Body/ATR = 1.5, close > prior highs, clean close | Score ≥ 0.7, verdict=PUSH_UP |
| Doji | Body/ATR < 0.1 | Momentum ≈ 0, score thấp |
| DQ_STREAK | 5 nến tăng liên tiếp | DQ flag, score × 0.35 |
| DQ_INTO_D1_WALL | Ép sát pivot D1 chưa breakout | DQ flag |
| Location bonus | Gần swing low D1 trong UPTREND + PUSH_DOWN | Location > 0 |
| Location penalty | Ép giữa "hư không" | Location < 0 |
| Reject wick | Upper wick ≥ 0.4 × body | Confirm trừ điểm |
| Soft zone | Score 0.5 | verdict_hint=WAIT, không entry |

### 2.3 HardValidator

| Test case | Expected |
|-----------|----------|
| Matrix hợp lệ: UPTREND × PUSH_DOWN → OPEN_BUY | PASS |
| Matrix vi phạm: UPTREND × PUSH_UP → OPEN_BUY | FAIL |
| Spacing đủ | PASS |
| Spacing chưa đủ | FAIL |
| RECOVERY + mở ngược BasketDir | FAIL |
| NormalizeLot bước broker | Lot được normalize |
| Kill-switch ON | FAIL |
| Strength < 0.6 cho ENTRY | FAIL |

### 2.4 Spacing / Ladder

| Test case | Expected |
|-----------|----------|
| Ladder step 0 → lot = 0.05 | Đúng |
| Ladder step 3 → lot = 0.20 | Đúng |
| Spacing normal: Coef=1.35 × ATR=12 pip = 16.2 → max(15, 16.2) = 16.2 | Đúng |
| Spacing strong: Coef=0.7 × ATR=20 = 14 → max(15, 14) = 15 | Đúng (floor) |

---

## 3. Integration Tests — State Machine & DB

### 3.1 Transition Tests

| # | Test | Setup | Action | Expect |
|---|------|-------|--------|--------|
| T1 | FLAT → NORMAL | State=FLAT, Matrix=OPEN_BUY, HardPass | A+B consensus → enqueue | State=NORMAL, TotalLot=L0 |
| T2 | NORMAL → FLAT | FavorableSqueeze + BasketProfit ≥ TpMoney | A+B consensus → CLOSE_ALL | State=FLAT, TotalLot=0 |
| T3 | NORMAL → RECOVERY | DCA → TotalLot ≥ R_TH | A+B consensus → DCA | State=RECOVERY |
| T4 | RECOVERY → RECOVERY (DCA) | AdverseSqueeze | A+B → RECOVERY_DCA | TotalLot↑, vẫn RECOVERY |
| T5 | RECOVERY → RECOVERY (Payoff) | FavorableSqueeze | A+B → PAYOFF_REDUCE | Loser closed, TotalLot↓ |
| T6 | RECOVERY → FLAT | TotalLot → 0 sau reduce | Close all losers | State=FLAT |
| T7 | ANY → FLAT (kill) | KillSwitch FLATTEN | Boss manual | State=FLAT |

### 3.2 DB Queue Tests

| Test | Expected |
|------|----------|
| INSERT MarketOrderInfo PENDING | Row created, status=PENDING |
| Executor claim → PROCESSING | Atomic update, only 1 claim |
| Success → Archive + Delete | MarketOrderInfoArchive created, original deleted |
| FAILED → Archive + PairState unchanged | FAILED logged, state not modified |
| Concurrent claims (2 executors) | Only 1 succeeds |

### 3.3 SYSTEM_FREEZE Tests

| Test | Expected |
|------|----------|
| LLM timeout 3 lần → FREEZE | SYSTEM_FREEZE=true, alert Boss, no actions |
| FREEZE → mọi enqueue bị chặn | Engine skip cycle, positions unchanged |
| LLM khôi phục → auto-resume | SYSTEM_FREEZE=false, resume cycle |

---

## 4. LLM Decision Tests

> Test rằng LLM (A+B) ra quyết định đúng phương pháp khi được cung cấp snapshot.

### 4.1 Method

```
Chuẩn bị bộ test scenarios (JSON):
  - snapshot: MarketSnapshot cụ thể
  - expected_action: action đúng theo phương pháp
  - expected_reasoning: lý do tối thiểu phải nêu

Chạy:
  response = call_agent_a(snapshot)
  assert response.action == expected_action
  assert "keyword" in response.reasoning   // kiểm tra reasoning có đề cập

Lưu ý: LLM không deterministic → cho phép tolerance
  - Action đúng: PASS
  - Action WAIT khi expected OPEN: ACCEPTABLE (conservative)
  - Action ngược (OPEN_BUY khi expected WAIT): FAIL
```

### 4.2 Bộ Scenarios Tối Thiểu

| # | Scenario | Expected A | Expected B |
|---|----------|------------|------------|
| 1 | FLAT + UPTREND + PUSH_DOWN 0.75 gần swing low D1 | OPEN_BUY | APPROVE |
| 2 | FLAT + UPTREND + PUSH_UP 0.8 (wrong direction) | WAIT | APPROVE WAIT |
| 3 | FLAT + SIDEWAY + PUSH_DOWN 0.65 gần đáy range | OPEN_BUY | APPROVE |
| 4 | FLAT + strength 0.45 (soft zone) | WAIT | APPROVE WAIT |
| 5 | NORMAL + spacing đủ + cú ép đang mạnh (DQ_STREAK) | WAIT (không DCA vội) | APPROVE WAIT |
| 6 | NORMAL + spacing đủ + context hỗ trợ + không DQ | DCA | APPROVE |
| 7 | NORMAL + favorable squeeze + profit ≥ TpMoney | CLOSE_ALL | APPROVE |
| 8 | RECOVERY + adverse squeeze + spacing đủ | RECOVERY_DCA | APPROVE |
| 9 | RECOVERY + favorable + có loser | PAYOFF_REDUCE | APPROVE |
| 10 | RECOVERY + mở ngược BasketDir | *Không xảy ra* — HardValidator chặn | VETO nếu A đề xuất |

### 4.3 Agent B Counter-Evidence Test

| Test | Expected |
|------|----------|
| B APPROVE không có counter_evidence | INVALID ballot → retry |
| B nhìn thấy A vi phạm AVOID trong MemoryPack | CHALLENGE + cite bài học |
| B đồng ý nhưng có dissent_point | APPROVE + counter_evidence filled |

---

## 5. Scenario Test (End-to-End Historical)

### 5.1 Method

```
Replay historical D1+H1 data (OHLC closed) bar-by-bar:
  Mỗi H1 close:
    1. Engine build MarketSnapshot từ historical data
    2. Agent A+B phân tích (LLM call thật hoặc cached response)
    3. Nếu consensus → simulate execution (giả lập fill tại close price)
    4. Update PairState, TotalLot, BasketProfit
    5. Log: timestamp, action, lot, PnL
  Kết thúc: report tổng PnL, max drawdown, win rate, số RECOVERY events
```

### 5.2 Đánh giá

| Metric | Pass criteria |
|--------|---------------|
| Không vi phạm phương pháp cứng | 0 violations |
| Agents không bỏ sót H1 close (khi FLAT) | 100% coverage |
| RECOVERY thoát được (không stuck vĩnh viễn) | Tất cả RECOVERY → FLAT trong test window |
| HardValidator catch mọi invalid plan | 100% |

---

## 6. Forward Test (Paper Trading)

### 6.1 Protocol

```
1. Kết nối MT5 demo account (cùng broker, cùng symbol)
2. Chạy full system (engine + LLM A+B + executor) trên demo
3. Duration: ít nhất 2 tuần (≥ 10 ngày giao dịch)
4. Monitor: mọi action được log + audit
5. Human review:
   - Mỗi ngày: review AuditLog, kiểm tra agents có ra quyết định hợp lý
   - Cuối tuần: review PnL, drawdown, RECOVERY events
6. Pass criteria: không có bug nghiêm trọng, agents tuân thủ phương pháp
```

### 6.2 Trước khi Live

- [ ] Forward test ≥ 2 tuần không lỗi nghiêm trọng
- [ ] RECOVERY vào + thoát thành công ít nhất 1 lần
- [ ] SYSTEM_FREEZE trigger + auto-resume hoạt động đúng
- [ ] Kill-switch FLATTEN hoạt động đúng
- [ ] Boss interrupt flow hoạt động đúng
- [ ] LLM cost trong ngân sách acceptable

---

## 7. Liên kết

- StructureEngine spec: [02-d1-context.md](02-d1-context.md)
- SignalEngine spec: [03-h1-signal.md](03-h1-signal.md)
- State machine: [06-state-machine.md](06-state-machine.md)
- HardValidator: [01-system-overview.md](01-system-overview.md) §5
- LLM Prompt: [../doc_agents/14-llm-prompt-spec.md](../doc_agents/14-llm-prompt-spec.md)
- Operations: [12-operations-reliability.md](12-operations-reliability.md)
