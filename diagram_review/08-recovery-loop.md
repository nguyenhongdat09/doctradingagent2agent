# 08 - VÒNG LẶP CỨU LỖ VÀ CHIẾN THUẬT PAYOFF (RECOVERY LOOP)

> **File sơ đồ Mermaid tương ứng**: [08-recovery-loop.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/08-recovery-loop.mmd)

---

## 1. Khái Niệm: "Payoff Lot" Là Gì Dưới Góc Nhìn Lập Trình?

Trong trading truyền thống, khi gồng lỗ nặng, trader thường "chết cứng" chờ giá quay lại điểm vào ban đầu hoặc cắt lỗ toàn bộ trong đau đớn.

Chiến thuật **Payoff** trong hệ thống của chúng ta hoạt động như một thuật toán **bào mòn nợ xấu (Debt Amortization)**:
- Không chờ giá quay lại đỉnh/đáy ban đầu.
- Khi thị trường có một nhịp sóng hồi nhỏ, mở một lệnh phụ ngắn hạn gọi là **Payoff Lot** (khối lượng từ $15\% - 30\%$ của tổng rổ `TotalLot`).
- Lệnh Payoff kiếm nhanh một khoản lợi nhuận nhỏ (ví dụ $+20 \text{ USD}$).
- Ngay lập tức, hệ thống dùng $+20 \text{ USD}$ này để **bù trừ và đóng lệnh đang có số tiền lỗ NHỎ NHẤT trong rổ** (`argmin |profit|` hay `|loss|` nhỏ nhất).
- **Tại sao cắt lệnh lỗ nhỏ nhất trước?** Vì số tiền lãi từ Payoff sẽ giải quyết dứt điểm được ngay từng vị thế (giảm nhanh số lượng lệnh trên MT5 và giảm `TotalLot` ngay lập tức), thay vì bị "chìm xuồng" khi đắp vào một lệnh âm quá lớn.
- Kết quả: `TotalLot` giảm dần từ $0.35 \rightarrow 0.28 \rightarrow 0.15 \rightarrow 0.00 \text{ lot}$ mà số dư tài khoản không bị thâm hụt nghiêm trọng.

---

## 2. Hai Kịch Bản Trong Vòng Cứu Lỗ (Recovery Loop)

### Kịch bản 1: Adverse Squeeze (Thị trường tiếp tục ép ngược)
- Thị trường chưa chịu hồi, tiếp tục đi xa thêm.
- LLM kiểm tra điều kiện `spacing_met`. Nếu thỏa mãn, mở thêm 1 lệnh `RECOVERY_DCA` với khối lượng được kiểm soát chặt chẽ (tuyệt đối cấm mở ngược hướng rổ) nhằm kéo điểm hòa vốn tổng về gần giá hiện tại hơn nữa.

### Kịch bản 2: Favorable Squeeze (Thị trường bắt đầu hồi phục)
- LLM phát hiện cây nến rút chân hoặc phân kỳ đảo chiều.
- Kích hoạt lệnh `PAYOFF` ($15\% - 30\%$ `TotalLot`).
- Khi lệnh Payoff đạt lợi nhuận mục tiêu $\rightarrow$ Thực thi **Tỉa lệnh âm (Partial/Full Close)** đối với **lệnh lỗ nhỏ nhất** (`argmin |profit|`).
- Tổng khối lượng rổ giảm từ $0.35 \rightarrow 0.25 \rightarrow 0.12 \rightarrow 0.00 \text{ lot}$.

---

## 3. Điều Kiện Thoát Khỏi RECOVERY

> [!IMPORTANT]
> Trạng thái `RECOVERY` có tính chất **"Dính chặt" (Sticky)** khi chạm ngưỡng $R_{TH} = 0.30 \text{ lot}$. Hệ thống chỉ thoát khỏi chế độ này khi và chỉ khi `TotalLot == 0.0` (Toàn bộ rổ lệnh đã được xử lý xong xuôi và tài khoản trở về `FLAT`).
