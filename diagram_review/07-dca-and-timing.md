# 07 - CƠ CHẾ DCA VÀ THỜI ĐIỂM KÍCH HOẠT (TIMING C0-C3 & DEC-09)

> **File sơ đồ Mermaid tương ứng**: [07-dca-and-timing.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/07-dca-and-timing.mmd)

---

## 1. Bốn Loại Nhịp Thức Giấc Của Scheduler (C0, C1, C2, C3)

Để tiết kiệm chi phí gọi LLM và tối ưu CPU, hệ thống không chạy vòng lặp vô tận (Busy-waiting loop) mà sử dụng Scheduler thức giấc theo sự kiện:

| Mã nhịp | Tên nhịp | Thời điểm diễn ra | Nhiệm vụ chính |
| :---: | :--- | :--- | :--- |
| **C0** | Startup Reconcile | Khi vừa khởi động app (`main.py`) | Đồng bộ lại toàn bộ trạng thái DB với sàn MT5. |
| **C1** | H1 Bar Close | Đúng phút $00$ đầu mỗi giờ | Tính Signal H1. **Nơi duy nhất xét lệnh ENTRY** ban đầu. |
| **C2** | D1 Bar Close | Đúng $00:00$ giờ server mỗi ngày | Tính lại xu hướng D1 (Context), Swings, BOS và biên độ ATR ngày. |
| **C3** | Intra-bar Monitor | Định kỳ $5 - 15$ phút trong giờ | Giám sát vị thế mở, kiểm tra khoảng cách Spacing để xét **DCA/Payoff**. |

---

## 2. Khoảng Cách Nhồi Lệnh Động (Dynamic Spacing từ ATR)

Không dùng khoảng cách cố định (Fixed Pip) vì thị trường có lúc sóng êm, có lúc bão giá.

$$\text{Spacing} = \text{BaseSpacing} \times \left( \frac{\text{ATR}_{\text{H1\_current}}}{\text{ATR}_{\text{H1\_baseline}}} \right)$$

- Khi thị trường bình yên (ATR nhỏ): Spacing co lại (ví dụ $20 \text{ pips}$) để nhồi lệnh sớm bắt nhịp hồi.
- Khi thị trường biến động mạnh/tin tức bão giá (ATR lớn): Spacing tự động giãn rộng ra (ví dụ $45 - 60 \text{ pips}$) để tránh bị nhồi quá nhiều lệnh gần nhau dẫn đến cạn vốn.

---

## 3. Quyết Định Kiến Trúc Quan Trọng: DEC-09 (DCA Timing)

### Vì sao ENTRY phải đợi H1 đóng nến, còn DCA thì xét ngay trong nhịp C3 (Intra-bar)?
- **Lệnh ENTRY (Mở mới)**: Cần sự ổn định cao. Nến đang chạy trong giờ rất dễ tạo tín hiệu giả (Fakeout). Chờ nến H1 đóng cửa xác nhận mới vào lệnh giúp tránh bẫy giá.
- **Lệnh DCA (Cứu hộ)**: Khi thị trường xả mạnh một cây nến dài, giá đi ngược rất xa. Nếu bắt buộc đợi hết 60 phút nến H1 đóng cửa mới xét DCA thì **đã bỏ lỡ điểm giá đẹp nhất của nhịp đảo chiều rút chân**. Do đó, theo quyết định **DEC-09**, chỉ cần nhịp C3 phát hiện giá đã đi ngược đủ khoảng cách `Spacing` $\rightarrow$ Đánh thức Agent A + B vào phân tích và quyết định nhồi DCA ngay lập tức.
