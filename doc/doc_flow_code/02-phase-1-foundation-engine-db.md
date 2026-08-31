# 02 — Phase 1: Nền Tảng Cơ Sở (Database, MT5 Adapter, Engine Mắt, Executor)

> **Mục tiêu Phase 1:** Hoàn thiện toàn bộ hạ tầng cơ khí, cơ sở dữ liệu SQLite (9 bảng chuẩn), hệ thống Repository, các thuật toán trích xuất đặc trưng giá ("đôi mắt" deterministic chia nhỏ theo file), bộ kiểm duyệt an toàn (HardValidator) và luồng thực thi lệnh (Executor Thread).

---

## 📦 1. Các Module Cần Viết Trong Phase 1 (Senior Modular Layout)

### Module 1.1: Database Layer & Repositories (`src/database/`)
- **Connection & Pragmas (`src/database/connection.py`):**
  - Khởi tạo kết nối SQLite với cấu hình PRAGMA bắt buộc:
    ```sql
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = FULL; -- An toàn tuyệt đối chống crash dữ liệu lệnh
    ```
  - Tự động tạo 9 bảng chuẩn cho từng database instance `data/dca_<symbol>.db`:
    1. `MarketOrderInfo`: Hàng đợi lệnh chờ thực thi.
    2. `MarketOrderInfoArchive`: Lịch sử lưu trữ lệnh đã hoàn tất.
    3. `PairState`: Trạng thái rổ và bối cảnh hiện tại của cặp tiền.
    4. `AuditLog`: Nhật ký kiểm toán mọi quyết định.
    5. `Plans`: Kế hoạch giao dịch do Agent A đề xuất.
    6. `Ballots`: Phiếu thẩm định do Agent B chấm điểm.
    7. `Sessions`: Phiên thảo luận (Scheduled, Intra-bar, Boss).
    8. `Messages`: Tin nhắn chi tiết trong phiên thảo luận.
    9. `LLMRuns`: Ghi nhận chi tiết token, chi phí USD, latency từng cuộc gọi API LLM.
- **Repositories Riêng Biệt (`src/database/repositories/`):**
  - `market_order_repo.py`: Các hàm `insert_pending()`, `claim_processing_atomic()`, `archive_and_delete_transaction()`, `cancel_orphans()`.
  - `pair_state_repo.py`: Các hàm `get_state()`, `update_state()`, `set_cooldown()`, `update_last_processed_bar()`.
  - `audit_repo.py`: Hàm `log_decision(event_type, plan_id, ballot_id, hard_pass, decision, reason, extra)`.
  - `llm_runs_repo.py`: Hàm `log_run(run_id, symbol, session_id, caller, model, provider, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, purpose)`. Quy ước `purpose`: `'memory_pack'` (đo chi phí nạp kinh nghiệm), `'context_analysis'`, `'signal_analysis'`, `'plan'`, `'ballot'`, `'revision'`, `'boss_chat'`.

### Module 1.2: MT5 Adapter (`src/engine/data/mt5_adapter.py`)
- **Nhiệm vụ:**
  - Bọc thư viện `MetaTrader5` thành wrapper an toàn: `initialize()`, `login()`, `shutdown()`.
  - Hàm `get_closed_rates(symbol, timeframe, count)`: Luôn loại bỏ nến `shift = 0` (đang hình thành), chỉ lấy đúng `count` nến đã đóng (`shift >= 1`).
  - Hàm `get_account_state()`: Lấy Balance, Equity, Margin, Free Margin.
  - Hàm `get_open_positions(symbol, magic)`: Lấy danh sách lệnh đang mở, lọc theo symbol và magic.
  - Hàm `send_order(request)`:
    - Chuẩn hóa lot theo `SYMBOL_VOLUME_STEP` qua `normalize_lot(symbol, volume)`.
    - Gắn comment nhận diện audit: `COMMENT = f"DCA|{symbol}|{state}|S{ladder_step}"`.
    - Xử lý **Retry nhẹ (1-2 lần)** với độ trễ $500\text{ms}$ khi gặp Requote hoặc lỗi mạng tạm thời.
    - Kiểm tra `retcode == TRADE_RETCODE_DONE`.

### Module 1.3: StructureEngine D1 (`src/engine/structure/`)
Tách thành 3 file nhỏ chuyên biệt:
1. `pivot_detector.py`: Tìm Pivot High / Pivot Low với bán kính $r = 3$ (`High[i] > High[i±1, i±2, i±3]`). Chỉ xác nhận khi đã có đủ 3 nến sau đóng cửa (không repaint). Duy trì danh sách tối đa 6 swings gần nhất.
2. `structure_features.py`: Nhận diện mẫu hình `HH/HL` hoặc `LH/LL`; Nhận diện `BOS` (Break of Structure); Tính `range_compress = |SwingHigh - SwingLow| / ATR14_D1`.
3. `context_classifier.py`: Phân loại bối cảnh `RuleContext` (`UPTREND`, `DOWNTREND`, `SIDEWAY`) kèm cơ chế **Hysteresis** (cần 2 swing cùng dấu hoặc BOS mạnh $\ge 0.5 \times ATR$ mới cho phép đổi bối cảnh).

### Module 1.4: SignalEngine H1 Strength Score (`src/engine/signal/`)
Tách thành 2 file nhỏ:
1. `strength_score.py`: Nhận nến H1 đã đóng và ATR14_H1, tính 4 thành phần điểm:
   - **Momentum (0 - 0.4):** Chuẩn hóa $|C - O| / ATR14_{H1}$ từ sàn 0.5 đến trần 1.5.
   - **Structure Breakout (0 - 0.3):** Phá vỡ đỉnh/đáy 3 nến trước (+0.15) hoặc phá swing H1 mini (+0.15).
   - **Location (0 - 0.2):** Buy dip gần đáy D1 trong Uptrend (+0.2), Sell rally gần đỉnh D1 trong Downtrend (+0.2). Trừ điểm nếu ép giữa hư không.
   - **Confirmation (0 - 0.1):** Đóng sát cực trị (+0.1), bấc ngược $\ge 0.4 \times body$ bị trừ điểm.
   - Phân loại Soft Zone: Score $< 0.4$ (Ignore), $0.4 \le Score < 0.6$ (Soft Zone - log WAIT), $Score \ge 0.6$ (Đủ điều kiện xét Matrix/Squeeze).
2. `disqualifiers.py`: Kiểm tra và kích hoạt `DQ_STREAK` (chuỗi $\ge 4$ nến cùng hướng) hoặc `DQ_INTO_D1_WALL` (đâm vào cản D1 chưa phá) $\rightarrow$ Nhân điểm với $0.35$.

### Module 1.5: Position Metrics & Spacing Calculator (`src/engine/position/`)
Tách thành 3 file nhỏ:
1. `spacing_calculator.py`: Tính khoảng cách Spacing ATR và kiểm tra cờ `spacing_met` (Bid $\le$ AdverseRef - SpacingPrice cho BUY; Ask $\ge$ AdverseRef + SpacingPrice cho SELL).
2. `ladder_calculator.py`: Tính lot theo ladder step: $Lot(k) = 0.05 + k \times 0.05$; Tính PayoffLot trong RECOVERY: $Clamp(TotalLot \times 20\%, min\_lot, max\_lot)$.
3. `basket_metrics.py`: Tính `TotalLot`, `BasketProfit` (floating P/L + swap), `AdverseRef` (Worst-case open price).

### Module 1.6: HardValidator (`src/engine/hard_validator.py`)
- **Nhiệm vụ:**
  - Thực thi 5 checks an toàn tuyệt đối trước khi bất kỳ lệnh nào được chạm DB Queue:
    1. **Matrix Action:** `OPEN_BUY` chỉ khi UPTREND/SIDEWAY $\times$ PUSH_DOWN $\ge 0.6$; `OPEN_SELL` chỉ khi DOWNTREND/SIDEWAY $\times$ PUSH_UP $\ge 0.6$.
    2. **Spacing & Ladder:** Lot khớp bậc ladder, spacing $\ge$ SpacingPrice khi DCA.
    3. **Direction Lock & Recovery Rule:** Cấm mở ngược hướng rổ hiện tại; trong RECOVERY cấm mở vị thế ngược chiều.
    4. **Normalize Lot:** Làm tròn lot theo bước khối lượng của broker (`SYMBOL_VOLUME_STEP`).
    5. **Kill-Switch:** `InpKillSwitch == false`.

### Module 1.7: Executor Thread (`src/execution/executor_thread.py`)
- **Nhiệm vụ:**
  - Chạy vòng lặp nền độc lập cho từng instance (polling mỗi 500ms - 1000ms).
  - **Atomic Claim:**
    ```sql
    UPDATE MarketOrderInfo SET status = 'PROCESSING', processed_at = CURRENT_TIMESTAMP 
    WHERE id = (SELECT id FROM MarketOrderInfo WHERE status = 'PENDING' ORDER BY id ASC LIMIT 1);
    ```
  - Thực thi lệnh qua `mt5_adapter.send_order()` hoặc `close_position()`.
  - **Archive Transaction:**
    ```sql
    BEGIN TRANSACTION;
    INSERT INTO MarketOrderInfoArchive (...) VALUES (...);
    DELETE FROM MarketOrderInfo WHERE id = ?;
    UPDATE PairState SET total_lot = ?, ladder_step = ?, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?;
    COMMIT;
    ```
  - Xử lý lỗi: Nếu MT5 từ chối $\rightarrow$ Ghi `status = 'FAILED'`, không thay đổi `PairState`, phát cảnh báo.

---

## ✅ 2. Checklist Developer — Phase 1

- [ ] **DB Setup:** Khởi tạo thành công database SQLite với PRAGMA WAL và `synchronous = FULL`, đủ 9 bảng (kèm `LLMRuns`).
- [ ] **Repositories:** Viết đầy đủ unit test cho các hàm trong `src/database/repositories/`.
- [ ] **MT5 Wrapper:** Kết nối thành công MT5 demo, lấy đúng nến đã đóng (`shift >= 1`), gắn đúng comment format.
- [ ] **StructureEngine:** Test phát hiện chính xác Swing D1 ($r=3$), BOS, Range Compress, Hysteresis không repaint.
- [ ] **SignalEngine:** Test tính đúng 4 thành phần Score H1, kích hoạt đúng DQ flags, phân loại đúng Soft Zone.
- [ ] **Position Calculators:** Tính đúng Spacing ATR, cờ `spacing_met`, bậc ladder lot, Payoff lot.
- [ ] **HardValidator:** Chặn đứng 100% các vi phạm (lệnh ngược rổ, lot sai bước, kill-switch bật, score < 0.6).
- [ ] **Executor Thread:** Test Atomic claim, thực thi lệnh mẫu, lưu Archive và cập nhật PairState mà không bị double-execution.

---

## 🧪 3. Kiểm Thử Cần Thực Hiện (Unit & Integration Tests)

1. **Unit Test Structure Modules (`tests/unit/test_structure.py`):**
   - Test riêng `pivot_detector.py`, `structure_features.py`, `context_classifier.py` với mock OHLC.
2. **Unit Test Signal Modules (`tests/unit/test_signal.py`):**
   - Test riêng `strength_score.py` và `disqualifiers.py`.
3. **Integration Test Queue & Executor (`tests/integration/test_executor_queue.py`):**
   - Chạy 2 luồng Executor đồng thời claim 1 lệnh PENDING $\rightarrow$ Assert chỉ 1 luồng thành công.
