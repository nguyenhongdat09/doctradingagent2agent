# 10 - CHẾ ĐỘ ĐÓNG BĂNG HỆ THỐNG VÀ ĐỘ TIN CẬY (FREEZE & RELIABILITY)

> **File sơ đồ Mermaid tương ứng**: [10-freeze-and-reliability.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/10-freeze-and-reliability.mmd)

---

## 1. Triết Lý: Fail-Safe (An Toàn Khi Gặp Thảm Họa)

Trong lập trình phân tán và trading tự động, các sự cố mạng là không thể tránh khỏi:
- Nhà cung cấp LLM (OpenAI, Anthropic, Gemini) bị sập máy chủ hoặc chạm Rate Limit.
- Máy chủ MT5 bị mất kết nối Internet.
- Lệch dữ liệu giữa cơ sở dữ liệu SQLite và số dư thực tế trên sàn.

Thay vì hoảng loạn đóng sạch lệnh (dễ bị cắt đúng đáy lỗ) hoặc tự động hạ cấp sang bot code vô tri (dễ cháy tài khoản), hệ thống áp dụng trạng thái **`SYSTEM_FREEZE`** (Đóng băng an toàn).

---

## 2. Các Hành Vi Khi Hệ Thống Bị FREEZE

1. **Giữ nguyên trạng thái hiện tại (Hold Positions)**: Không tự ý cắt lỗ hoảng loạn.
2. **Khóa cổng đặt lệnh**: `HardValidator` lập tức từ chối 100% mọi lệnh được sinh ra.
3. **Bắn thông báo P0**: Gửi tin nhắn cảnh báo khẩn cấp tới Telegram của Boss/Quản trị viên.

---

## 3. Cơ Chế Tự Phục Hồi (Auto-Resume & Light Reconcile)

Hệ thống không cần con người can thiệp thủ công nếu là sự cố mạng tạm thời:
1. **Exponential Backoff**: Tự động ping thăm dò hạ tầng theo khoảng thời gian tăng dần ($5\text{s} \rightarrow 15\text{s} \rightarrow 30\text{s} \rightarrow 60\text{s}$).
2. **Light Reconcile**: Khi mạng thông suốt trở lại, hệ thống truy vấn MT5 lấy danh sách tất cả các Ticket đang chạy, đối chiếu với bảng `open_orders` trong SQLite:
   - Nếu khớp 100% $\rightarrow$ Gỡ cờ `SYSTEM_FREEZE = False`.
   - Scheduler tiếp tục chu kỳ bình thường.
