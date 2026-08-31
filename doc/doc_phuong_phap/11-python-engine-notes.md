# 11 — GHI CHÚ KIẾN TRÚC PYTHON ENGINE & RUNTIME

Tài liệu này hướng dẫn cấu trúc các module Python, vai trò của "Đôi mắt" deterministic, hệ thống Python tools cung cấp cho LLM Agents, và vòng đời thực thi của Executor Thread kết nối MT5.

---

## 1. PHÂN CHIA TẬP TRUNG: PYTHON ENGINE (MẮT) VS LLM (NÃO)
- **Engine Deterministic (Pure Python):**
  - Trích xuất dữ liệu nến từ MT5 API (`MetaTrader5` package).
  - Tính toán Swing High/Low D1 ($r=3$), xác định BOS, độ nén ATR.
  - Tính 4 thành phần H1 Strength Score: Momentum, Structure Breakout, Location, Confirmation.
  - Áp dụng bộ lọc Disqualifiers (DQ_STREAK, DQ_INTO_D1_WALL).
  - Chạy `HardValidator` kiểm soát 5 tiêu chí an toàn trước khi lệnh chạm DB.
- **LLM Agents (Bộ não):**
  - Diễn giải bức tranh thị trường từ dữ liệu nến và đặc trưng mà Python Engine cung cấp.
  - Tìm kiếm rủi ro tiềm ẩn (tin tức, bấc nến bất thường, bẫy thanh khoản).
  - Soạn thảo kế hoạch giao dịch (`TradePlan`) và phản biện (`ReviewBallot`).

---

## 2. DANH SÁCH PYTHON TOOLS CUNG CẤP CHO LLM AGENTS
Để tối ưu chi phí token và giảm số lần gọi API, hệ thống gộp snapshot thành 1 hàm chính:
1. `get_market_snapshot(symbol: str) -> dict`:
   - Trả về: 30 nến D1 OHLC, 30 nến H1 OHLC, danh sách <= 6 Swings D1, BOS status, ATR14_D1, ATR14_H1, Raw Strength Score & Comps, DQ flags, trạng thái vị thế (TotalLot, OpenTickets, BasketPnL).
2. `get_structure_features(symbol: str) -> dict`:
   - Chi tiết các vùng cản S/R D1 và mức nén biên độ.
3. `get_h1_strength_score(symbol: str) -> dict`:
   - Chi tiết từng điểm thành phần và cảnh báo bấc nến.
4. `get_positions(symbol: str) -> list[dict]`:
   - Chi tiết từng lệnh: ticket, open_price, current_profit, swap, lot.
5. `hard_validate(plan: dict) -> tuple[bool, str]`:
   - Cho phép Agent tự kiểm tra tính hợp lệ trước khi gửi chính thức.

---

## 3. RUNTIME LIFECYCLE & EXECUTOR THREAD
- **Vòng lặp Executor Thread:**
  - Chạy thường trực (`daemon thread` hoặc process riêng), polling bảng `MarketOrderInfo` mỗi $500\text{ms} \sim 1000\text{ms}$.
  - Claim lệnh: `UPDATE MarketOrderInfo SET status='PROCESSING' WHERE id = ?`.
  - Gọi API MT5: `mt5.order_send(request)`.
  - Transaction Archive & Delete: Đảm bảo không bao giờ thực thi lặp lệnh (*anti-double-execution*).
  - Tự động fallback: Nếu LLM sập hoặc ngắt kết nối mạng, Python Engine tiếp tục duy trì quản lý vị thế đang chạy theo các quy tắc toán học thuần túy.
