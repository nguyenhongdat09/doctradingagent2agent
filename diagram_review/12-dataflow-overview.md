# 12 - SƠ ĐỒ LUỒNG DỮ LIỆU VÀ QUAN HỆ 13 BẢNG SQLITE (DATAFLOW & SCHEMA)

> **File sơ đồ Mermaid tương ứng**: [12-dataflow-overview.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/12-dataflow-overview.mmd)

---

## 1. Cấu Trúc Cơ Sở Dữ Liệu Hai Tầng (Local vs Shared)

Hệ thống phân tách rành mạch giữa **dữ liệu cục bộ của từng cặp tiền** và **dữ liệu kinh nghiệm chia sẻ chung toàn hệ thống**:

```
D:\TradingAgents\PlanToCode\data\
├── dca_audcad.db         <── Database riêng của cặp AUDCAD (9 bảng)
├── dca_audnzd.db         <── Database riêng của cặp AUDNZD (9 bảng)
└── experience.db         <── Database dùng chung toàn hệ thống (4 bảng)
```

---

## 2. Danh Mục 9 Bảng Cục Bộ (`dca_<symbol>.db`)

| Tên Bảng | Vai trò kỹ thuật ngắn gọn |
| :--- | :--- |
| **`pair_state`** | Lưu trạng thái sống hiện tại: `mode` (FLAT/NORMAL/RECOVERY), `total_lot`, `basket_direction`, `last_wake_time`. |
| **`MarketOrderInfo`** | Hàng đợi lệnh bất đồng bộ: `status` (PENDING, PROCESSING, FAILED), `action`, `lot_size`, `price`. |
| **`open_orders`** | Danh sách các vị thế thực tế đang chạy trên MT5 (Ticket ID, open_price, volume, sl, tp). |
| **`order_archive`** | Lịch sử toàn bộ các lệnh đã đóng để phục vụ phân tích P&L và thống kê hiệu suất. |
| **`market_snapshots`** | Lưu trữ cache các bản tin snapshot nến D1/H1 giúp kiểm tra và debug khi cần. |
| **`trade_plans`** | Lưu vết toàn bộ các kế hoạch do Agent A đề xuất qua từng phiên. |
| **`review_ballots`** | Lưu vết các lá phiếu đánh giá và phản biện của Agent B. |
| **`system_flags`** | Lưu các cờ điều khiển: `SYSTEM_FREEZE`, `MAINTENANCE_MODE`, `RECONCILE_REQUIRED`. |
| **`audit_logs`** | Nhật ký sự kiện toàn diện ghi lại mọi thay đổi trong hệ thống. |

---

## 3. Danh Mục 4 Bảng Dùng Chung (`experience.db`)

| Tên Bảng | Vai trò kỹ thuật ngắn gọn |
| :--- | :--- |
| **`symbol_profiles`** | Hồ sơ "tính cách" của từng cặp tiền: đặc tính biến động, thống kê win rate và chế độ tối ưu. |
| **`lessons`** | Ngân hàng bài học kinh nghiệm (`AVOID`, `PREFER`, `WARNING`) với hệ thống điểm uy tín. |
| **`lesson_feedbacks`** | Lịch sử đánh giá thực tế: ghi nhận bài học nào mang lại kết quả giao dịch thắng lợi. |
| **`llm_runs`** | Quản lý và giám sát chi phí: số lượng token In/Out, độ trễ API và tổng số tiền USD đã chi trả. |
