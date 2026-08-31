# 05 — Phase 4: Bộ Điều Phối & Vận Hành An Toàn (Orchestrator & Operations Reliability)

> **Mục tiêu Phase 4:** Kết nối toàn bộ các tầng thành một cỗ máy vận hành theo mô hình **1 Symbol = 1 Process độc lập (ADR-001)**: Quản lý lịch thức giấc (Scheduler C0–C3), xử lý khởi động lại & đối soát (Reconciliation), cơ chế đóng băng khi LLM sập (**SYSTEM_FREEZE**) và phục hồi an toàn (**Auto-Resume kèm Light Reconcile**), cùng hệ thống giám sát Phase 1.

---

## 📦 1. Các Module Cần Viết Trong Phase 4 (Senior Modular Layout)

### Module 4.1: Scheduler & Wake Engine (`src/orchestrator/scheduler.py`)
- **Nhiệm vụ:**
  - Quản lý đồng hồ thức giấc cho riêng instance cặp tiền hiện tại:
    1. **C0 (BẮT BUỘC khi FLAT):** Thức tại thời điểm nến H1 đóng cộng thêm độ trễ đệm:
       $$\text{next\_wake\_at} = \text{H1\_close\_time} + \text{1-2s buffer}$$
       (Buffer 1-2 giây giúp nến broker đã đóng hoàn toàn và có đủ giá đóng cửa).
    2. **C1 / C2 (Bổ trợ khi FLAT):** Wake giữa nến sau mỗi 30 phút để kiểm tra tình hình.
    3. **C3 (Khi NORMAL / RECOVERY):** Thức theo chu kỳ động `interval` do Agent A chỉ định ($3\text{m} \le interval \le 60\text{m}$).
       - **Quy tắc Timing DCA (DEC-09):** Ở **MỖI LẦN WAKE C3**, nếu cờ `spacing_met == true`, kích hoạt Agent A và B đánh giá và ra quyết định DCA ngay giữa nến mà **KHÔNG cần chờ nến H1 đóng**.
  - **Chống xử lý lặp nến (`last_processed_bar_id`):** Lưu thời gian mở nến H1 hiện tại vào `PairState.last_processed_bar_id`. Nếu nến H1 đã được xử lý tín hiệu thì bỏ qua.

### Module 4.2: Freeze Monitor & Auto-Resume (`src/orchestrator/freeze_monitor.py`)
- **Nhiệm vụ:**
  - **Giám sát LLM Outage:**
    - Theo dõi các cuộc gọi LLM API. Nếu gặp Timeout $> 30\text{s}$, lỗi 5xx, hoặc Rate limit quá số lần retry cho phép:
      1. Bật cờ toàn cục `SYSTEM_FREEZE = true`.
      2. Đóng băng mọi hành vi giao dịch (Engine KHÔNG tự ra lệnh; Executor không nhận lệnh mới).
      3. Giữ nguyên toàn bộ các lệnh đang mở (PairState không đổi).
      4. Phát cảnh báo khẩn cấp `ALERT_LLM_OUTAGE` tới Boss kèm snapshot trạng thái các vị thế.
  - **Cơ chế Auto-Resume & Light Reconcile:**
    - Định kỳ thử kết nối lại LLM API (Exponential backoff $30\text{s} \rightarrow 60\text{s} \rightarrow 120\text{s} \rightarrow 300\text{s}$).
    - Khi LLM phản hồi thành công:
      1. Tắt cờ `SYSTEM_FREEZE = false`.
      2. **Thực hiện Light Reconcile (Bắt buộc):** Gọi `reconcile.light_reconcile(symbol)` để so khớp số lot thực tế trên MT5 vs `PairState` trong DB.
      3. Phát cảnh báo "LLM khôi phục — Hệ thống tự động tiếp tục chu kỳ".
      4. Đánh thức các Agents để đánh giá lại toàn bộ vị thế với snapshot mới nhất.

### Module 4.3: Reconciliation Layer (`src/orchestrator/reconcile.py`)
- **Tách riêng logic đối soát thành module độc lập:**
  - `light_reconcile(symbol, magic)`: Kiểm tra nhanh tổng lot và số lượng position trên MT5 vs `PairState.total_lot`. Nếu lệch $\rightarrow$ Cập nhật `PairState` theo MT5 thực tế.
  - `full_reconcile(symbol, magic)`: Dùng khi khởi động lại hệ thống:
    - Nếu MT5 có lệnh mà DB ghi FLAT $\rightarrow$ Tái tạo trạng thái (NORMAL/RECOVERY) theo `TotalLot` thực tế.
    - Nếu DB có lệnh mà MT5 rỗng $\rightarrow$ Reset về FLAT.
    - Dọn dẹp hàng đợi: Chuyển các bản ghi `PENDING` cũ trước khi crash sang `status = 'CANCELLED'`.

### Module 4.4: Startup Protocol (`src/orchestrator/startup.py`)
- **Nhiệm vụ:**
  - Quy trình khởi động instance cặp tiền khi boot process:
    1. Mở kết nối SQLite database riêng của symbol (`data/dca_<symbol>.db`) + `experience.db`.
    2. Khởi tạo kết nối MT5 Terminal (`mt5.initialize()`, `mt5.login()`).
    3. Chạy `full_reconcile(symbol)`.
    4. Nạp đủ dữ liệu nến khởi động (**Warm-up data:** 60 nến D1 + 30 nến H1).
    5. Khởi chạy Executor Thread chạy nền.
    6. Trả về trạng thái sẵn sàng cho Main Runner.

### Module 4.5: Monitoring Phase 1 (`src/orchestrator/monitoring.py`)
- **Nhiệm vụ:**
  - **Heartbeat:** Ghi nhận timestamp mỗi 60 giây vào file `logs/heartbeat_<symbol>.json`.
  - **MT5 Connection Health:** Kiểm tra `mt5.terminal_info()` mỗi 30 giây. Nếu mất kết nối $\rightarrow$ Khóa gate `mt5_healthy = false` (ngăn enqueue mới), tự động retry kết nối lại.
  - **Queue Backlog Watcher:** Quét bảng `MarketOrderInfo` mỗi 5 phút. Nếu số lệnh PENDING $> 5$ hoặc có lệnh PENDING tồn đọng $> 300\text{s}$ $\rightarrow$ Phát cảnh báo Executor bị nghẽn.
  - **Audit Logger:** Ghi vết mọi quyết định vào file xoay vòng `logs/audit/audit_<symbol>_YYYYMMDD.jsonl`.

### Module 4.6: Single-Symbol Main Runner (`src/orchestrator/main_runner.py`)
- **Nhiệm vụ:**
  - Lớp `SymbolInstanceRunner`:
    ```python
    class SymbolInstanceRunner:
        def __init__(self, symbol: str, config_path: str):
            self.symbol = symbol
            self.config = load_config(config_path, symbol)
            # Khởi tạo DI: DB repos, MT5 adapter, Engines, Agents, Executor, Scheduler
            
        def start(self):
            # 1. Startup & Reconcile
            startup_instance(self.symbol, self.config)
            # 2. Main Loop: Chờ timer hoặc Boss interrupt
            while self.is_running:
                event = self.scheduler.wait_next_event()
                self.process_cycle(event)
    ```

### Module 4.7: Quản Lý Đa Tiến Trình & Concurrency `experience.db`
- **Nguyên tắc Concurrency cho Database dùng chung (`experience.db`):**
  - **Single-Writer:** Chỉ duy nhất 1 tiến trình/thread `LessonWriter` có quyền ghi (INSERT/UPDATE vào `Lessons`, `PairProfiles`, vô hiệu hóa `MemoryCache`).
  - **Readers-Only:** Các tiến trình con của từng cặp tiền (`AUDCAD`, `AUDNZD`, etc.) **CHỈ ĐỌC** qua hàm `get_memory_pack()` và đọc bảng `MemoryCache`.
  - Điều này loại bỏ 100% nguy cơ xảy ra SQLite Database Lock (`SQLITE_BUSY`) khi 4 process instance chạy song song.

---

## ✅ 2. Checklist Developer — Phase 4

- [ ] **Single Instance Runner:** Process khởi chạy độc lập cho 1 cặp tiền duy nhất qua tham số `--symbol`.
- [ ] **Scheduler C0-C3:** Đảm bảo thức giấc chính xác tại H1 Close + 1-2s buffer (FLAT) và thức linh hoạt C3 (OPEN).
- [ ] **Chống trùng nến:** Kiểm tra `last_processed_bar_id` ngăn chặn phân tích 2 lần trên cùng một nến H1.
- [ ] **SYSTEM_FREEZE:** Thử ngắt mạng / mock lỗi LLM 500 $\rightarrow$ Hệ thống lập tức freeze, không tự ý vào lệnh, phát alert Boss.
- [ ] **Auto-Resume & Light Reconcile:** Khôi phục mạng $\rightarrow$ Tự động resume, chạy Light Reconcile khớp số lot thực tế rồi mới chạy tiếp.
- [ ] **Full Reconcile Khi Boot:** Giả lập crash khi đang có lệnh $\rightarrow$ Khởi động lại, hệ thống nhận diện đúng trạng thái từ MT5, dọn sạch orphan queue.

---

## 🧪 3. Kiểm Thử Cần Thực Hiện (Integration & Reliability Tests)

1. **Integration Test Scheduler (`tests/integration/test_scheduler.py`):**
   - Giả lập thời gian nến H1 close + buffer 2s $\rightarrow$ Scheduler kích hoạt chu kỳ phân tích FLAT.
2. **Reliability Test Freeze & Light Reconcile (`tests/integration/test_system_freeze.py`):**
   - Mock LLM lỗi $\rightarrow$ Assert `SYSTEM_FREEZE == true`.
   - Mock LLM hồi phục $\rightarrow$ Assert `SYSTEM_FREEZE == false`, `light_reconcile()` được gọi, state được cập nhật.
3. **Startup Reconcile Test (`tests/integration/test_startup_reconciliation.py`):**
   - DB ghi FLAT nhưng MT5 có lệnh $\rightarrow$ `full_reconcile()` khôi phục state NORMAL chính xác.
