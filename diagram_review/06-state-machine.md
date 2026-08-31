# 06 - MÁY TRẠNG THÁI QUẢN TRỊ RỦI RO (STATE MACHINE)

> **File sơ đồ Mermaid tương ứng**: [06-state-machine.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/06-state-machine.mmd)

---

## 1. Ba Trạng Thái Sống Còn Của Hệ Thống

Hệ thống quản lý trạng thái của mỗi cặp tiền thông qua biến `PairState.mode`:

```
┌──────────┐     Entry (0.05 lot)     ┌────────────┐
│   FLAT   │ ───────────────────────▶ │   NORMAL   │
└──────────┘                          └────────────┘
     ▲                                      │
     │                                      │ TotalLot >= 0.30 (R_TH)
     │                                      ▼
     │        Payoff giải cứu hết     ┌────────────┐
     └─────────────────────────────── │  RECOVERY  │
                                      └────────────┘
```

---

## 2. Ý Nghĩa Chi Tiết Từng Trạng Thái Cho Developer

### 2.1 FLAT (Trạng Thái Trắng Lệnh - Ngủ Đông)
- **Điều kiện**: $\text{TotalLot} == 0.0$ (Tài khoản không có bất kỳ lệnh nào đang mở).
- **Hành vi**: Scheduler chỉ đánh thức hệ thống đúng vào thời điểm **H1 đóng nến** (đầu mỗi giờ). Hệ thống tính toán `Strength Score`, nếu $\ge 0.60$ thì mới gọi LLM để xét vào lệnh `ENTRY` ban đầu ($L_0 = 0.05 \text{ lot}$).

### 2.2 NORMAL (Giao Dịch Tiêu Chuẩn)
- **Điều kiện**: $0.0 < \text{TotalLot} < 0.30 \text{ lot}$.
- **Hành vi**:
  - Đang có một rổ lệnh nhỏ.
  - Nếu giá đi thuận chiều $\rightarrow$ Chạm mức Take-Profit (ví dụ $+30 \text{ pips}$) $\rightarrow$ Đóng toàn bộ rổ $\rightarrow$ Về `FLAT`.
  - Nếu giá đi ngược $\rightarrow$ Scheduler kiểm tra mỗi nhịp (Wake C3). Khi khoảng cách giá thỏa mãn `Spacing` tính từ ATR $\rightarrow$ LLM cân nhắc mở thêm lệnh `DCA`.

### 2.3 RECOVERY (Chế Độ Cứu Hộ Khẩn Cấp)
- **Điều kiện kích hoạt**: Khi nhồi nhiều lệnh DCA khiến tổng khối lượng chạm ngưỡng $R_{TH} = 0.30 \text{ lot}$.
- **Hành vi**:
  - **CẤM TUYỆT ĐỐI** mở thêm lệnh Entry mới.
  - Chuyển sang chiến thuật **Payoff**: Sử dụng các nhịp hồi của thị trường để mở lệnh lướt sóng ngắn ($15\% - 30\%$ TotalLot), lấy tiền lãi lướt sóng này để **tỉa và đóng dần các lệnh lỗ nhỏ nhất trong rổ** (`argmin |profit|` trước).
  - **Tính chất Sticky (Dính chặt)**: Khi đã vào `RECOVERY`, hệ thống **bắt buộc phải ở lại RECOVERY cho đến khi giải phóng toàn bộ rổ lệnh về `FLAT` ($\text{TotalLot} == 0$)**. Không được hạ cấp về `NORMAL` giữa chừng để tránh việc LLM lơ là chiến dịch cứu hộ.
