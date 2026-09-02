# 10 — THIẾT KẾ CƠ SỞ DỮ LIỆU SQLITE & HÀNG ĐỢI GIAO DỊCH

Tài liệu này chi tiết hóa kiến trúc cơ sở dữ liệu SQLite cho từng instance cặp tiền tệ (`dca_<symbol>.db`), cơ chế hàng đợi giao dịch giữa LLM Agents và Executor Thread, các ràng buộc toàn vẹn, cũng như nguyên tắc chống xung đột đa luồng.

---

## 1. MÔ HÌNH DATABASE THEO INSTANCE
- **1 Cặp = 1 Database File Riêng Biệt:** Ví dụ: `dca_AUDCAD.db`, `dca_AUDNZD.db`.
- **Không chia sẻ file DB giữa các process/symbol:** Tránh hoàn toàn lock contention cấp database giữa các cặp.
- **SQLite Pragmas bắt buộc:**
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  PRAGMA synchronous = FULL; -- An toàn tuyệt đối chống crash; có thể dùng NORMAL nếu cần tối ưu I/O
  ```

---

## 2. CHI TIẾT SCHEMA 10 BẢNG DỮ LIỆU (Instance Database)

### 2.1. `MarketOrderInfo` (Hàng đợi lệnh chờ thực thi)
```sql
CREATE TABLE MarketOrderInfo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    plan_id TEXT UNIQUE NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('OPEN', 'DCA', 'PAYOFF', 'CLOSE_ALL', 'PARTIAL_CLOSE')),
    direction TEXT NOT NULL CHECK(direction IN ('BUY', 'SELL', 'FLAT')),
    lot REAL NOT NULL CHECK(lot > 0),
    target_lot REAL DEFAULT 0.0,
    price_ref REAL NOT NULL,
    tp_pips REAL DEFAULT 30.0,
    sl REAL DEFAULT 0.0,
    reason TEXT NOT NULL,
    ballot TEXT,
    session_mode TEXT DEFAULT 'AUTO' CHECK(session_mode IN ('AUTO', 'BOSS', 'FALLBACK')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    error TEXT
);

CREATE INDEX idx_market_order_status ON MarketOrderInfo(status);
```

### 2.2. `MarketOrderInfoArchive` (Lịch sử lệnh đã xử lý xong)
```sql
CREATE TABLE MarketOrderInfoArchive (
    id INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    lot REAL NOT NULL,
    executed_price REAL,
    executed_lot REAL,
    ticket INTEGER,
    fill_status TEXT NOT NULL,
    fill_error TEXT,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3. `PairState` (Trạng thái hiện tại của cặp tiền)
```sql
CREATE TABLE PairState (
    symbol TEXT PRIMARY KEY,
    state TEXT NOT NULL CHECK(state IN ('FLAT', 'NORMAL', 'RECOVERY')),
    context TEXT NOT NULL CHECK(context IN ('UPTREND', 'DOWNTREND', 'SIDEWAY')),
    prev_context TEXT NOT NULL CHECK(prev_context IN ('UPTREND', 'DOWNTREND', 'SIDEWAY')),
    basket_dir TEXT NOT NULL CHECK(basket_dir IN ('BUY', 'SELL', 'NONE')),
    total_lot REAL NOT NULL DEFAULT 0.0,
    ladder_step INTEGER NOT NULL DEFAULT 0,
    adverse_ref REAL NOT NULL DEFAULT 0.0,
    last_processed_bar_id TEXT,
    cooldown_until_bar TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4. `AuditLog` (Nhật ký kiểm toán quyết định)
```sql
CREATE TABLE AuditLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    symbol TEXT NOT NULL,
    event_type TEXT NOT NULL,
    plan_id TEXT,
    ballot_id TEXT,
    hard_pass INTEGER NOT NULL CHECK(hard_pass IN (0, 1)),
    decision TEXT NOT NULL,
    reason TEXT,
    outcome TEXT,
    extra JSON
);
```

### 2.5. `Plans` (Kế hoạch giao dịch của Agent A)
```sql
CREATE TABLE Plans (
    plan_id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    action TEXT NOT NULL,
    direction TEXT NOT NULL,
    lot REAL NOT NULL,
    context JSON NOT NULL,
    signal JSON NOT NULL,
    rule_refs TEXT,
    thesis TEXT NOT NULL,
    risks TEXT,
    invalidation TEXT,
    status TEXT NOT NULL DEFAULT 'PROPOSED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.6. `Ballots` (Phiếu thẩm định của Agent B)
```sql
CREATE TABLE Ballots (
    ballot_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES Plans(plan_id),
    round INTEGER NOT NULL DEFAULT 1,
    decision TEXT NOT NULL CHECK(decision IN ('APPROVE', 'REVISE', 'VETO')),
    thesis TEXT NOT NULL,
    counter_evidence TEXT NOT NULL,
    agree_points JSON,
    dissent_points JSON,
    requested_changes TEXT,
    similarity_score REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.7. `Sessions` & `Messages` (Lưu vết hội đồng thảo luận)
```sql
CREATE TABLE Sessions (
    session_id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK(trigger_type IN ('SCHEDULED_H1', 'INTRA_BAR', 'BOSS_INTERRUPT')),
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

CREATE TABLE Messages (
    msg_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES Sessions(session_id),
    sender TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.8. `LLMRuns` (Đo lường & Kiểm toán Chi phí Token — Bắt buộc)
```sql
CREATE TABLE LLMRuns (
    run_id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    session_id TEXT,
    caller TEXT NOT NULL CHECK(caller IN ('AGENT_A', 'AGENT_B', 'BOSS')),
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0.0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    purpose TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_llm_runs_lookup ON LLMRuns(symbol, caller, created_at);
```

> **Quy ước giá trị `purpose` (ADR-008):**
> - `'memory_pack'`: Tách riêng đo lường chi phí nạp/kết xuất bộ nhớ kinh nghiệm.
> - `'context_analysis'`: Lượt phân tích bối cảnh D1 của Agent A/B.
> - `'signal_analysis'`: Lượt phân tích tín hiệu H1 của Agent A/B.
> - `'plan'`: Lượt soạn thảo kế hoạch `TradePlan` của Agent A.
> - `'ballot'`: Lượt thẩm định `ReviewBallot` của Agent B.
> - `'revision'`: Lượt sửa đổi kế hoạch trong vòng tranh luận Consensus.
> - `'boss_chat'`: Lượt đàm thoại trong phiên Boss.

### 2.9. `EscalationTickets` (Ticket hỏi Boss khi Agent mơ hồ)

> **Tính năng mới:** Agent A hoặc B chủ động hỏi Boss qua Telegram khi không tự tin về phân tích.
> Xem chi tiết: [`../doc_agents/15-uncertainty-escalation.md`](../doc_agents/15-uncertainty-escalation.md).

```sql
CREATE TABLE EscalationTickets (
    ticket_id           TEXT PRIMARY KEY,                -- UUID
    symbol              TEXT NOT NULL,                    -- AUDCAD
    source_agent        TEXT NOT NULL CHECK(source_agent IN ('A', 'B')),
    pair_state          TEXT NOT NULL,                    -- FLAT|NORMAL|RECOVERY
    
    -- Nội dung escalation
    category            TEXT NOT NULL,                    -- CONFLICTING_SIGNALS|MEMORY_CONFLICT|NEAR_RESISTANCE|UNUSUAL_PATTERN|RECOVERY_RISK
    uncertainty_score   REAL NOT NULL,                    -- 0.0–1.0
    context_summary     TEXT NOT NULL,                    -- Tóm tắt tình huống (tiếng Việt)
    question            TEXT NOT NULL,                    -- Câu hỏi cụ thể cho Boss (tiếng Việt)
    analysis_so_far     TEXT,                             -- JSON: {proposed_action, confidence, concerns[]}
    snapshot_id         TEXT,                             -- FK → market_snapshots
    
    -- Trạng thái
    status              TEXT NOT NULL DEFAULT 'WAITING' 
                        CHECK(status IN ('WAITING', 'RESPONDED', 'SELF_RESOLVED')),
    
    -- Timestamps
    created_at          TEXT NOT NULL,                    -- ISO-8601: lúc gửi
    timeout_at          TEXT NOT NULL,                    -- ISO-8601: created_at + 30 phút
    responded_at        TEXT,                             -- ISO-8601: lúc Boss reply (nếu ≤ 30 phút)
    resolved_at         TEXT,                             -- ISO-8601: lúc Agent tự quyết (khi timeout)
    
    -- Response
    boss_response       TEXT,                             -- Nguyên văn reply Boss (text tự do, tiếng Việt)
    self_resolution     TEXT,                             -- Giải pháp Agent tự chọn khi timeout
    late_boss_response  TEXT,                             -- Reply Boss sau khi đã timeout (nếu có)
    late_response_at    TEXT,                             -- ISO-8601: thời gian Boss reply trễ
    
    -- Audit
    telegram_message_id INTEGER,                          -- ID tin nhắn Telegram đã gửi
    plan_id             TEXT                              -- FK → Plans (plan được tạo sau escalation)
);

CREATE INDEX idx_escalation_status ON EscalationTickets(status);
CREATE INDEX idx_escalation_symbol ON EscalationTickets(symbol, created_at);
```

**Lifecycle:**
```
WAITING → RESPONDED      (Boss reply ≤ 30 phút)
WAITING → SELF_RESOLVED  (Timeout 30 phút → Agent tự quyết)
    └→ late_boss_response được ghi nếu Boss reply sau đó
```

---

## 3. CƠ CHẾ ĐỒNG BỘ & ATOMIC CLAIM TRONG EXECUTOR THREAD
1. **Khóa bản ghi Atomic:**
   ```sql
   UPDATE MarketOrderInfo 
   SET status = 'PROCESSING', processed_at = CURRENT_TIMESTAMP 
   WHERE id = (
       SELECT id FROM MarketOrderInfo 
       WHERE status = 'PENDING' 
       ORDER BY id ASC LIMIT 1
   );
   ```
2. **Transaction lưu trữ & dọn hàng đợi (Archive + Delete):**
   ```sql
   BEGIN TRANSACTION;
   INSERT INTO MarketOrderInfoArchive (id, symbol, instance_id, plan_id, action_type, direction, lot, executed_price, executed_lot, ticket, fill_status, fill_error)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FILLED', NULL);

   DELETE FROM MarketOrderInfo WHERE id = ?;

   UPDATE PairState SET total_lot = ?, ladder_step = ?, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?;
   COMMIT;
   ```
