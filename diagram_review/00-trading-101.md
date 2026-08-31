# 00 - TỪ ĐIỂN TRADING 101 DÀNH CHO DEVELOPER

> **Dành cho**: Kỹ sư phần mềm chưa từng trade. Tài liệu này giải thích các thuật ngữ tài chính bằng góc nhìn dữ liệu, mảng số học, và logic lập trình kèm ví dụ cụ thể.

---

## 1. Cặp Tiền Tệ (Forex Pair) & Nến Nhật (Candlestick)

### 1.1 Cặp Tiền Tệ (Currency Pair)
- Ví dụ: `AUDCAD` là tỷ giá giữa Đồng Đô la Úc (AUD) và Đồng Đô la Canada (CAD).
- Giá `AUDCAD = 0.89500` nghĩa là: $1 AUD đổi được $0.89500 CAD.
- **BUY (Mua / Long)**: Bạn kỳ vọng giá tăng (từ 0.89500 lên 0.90000 để có lãi).
- **SELL (Bán / Short)**: Bạn kỳ vọng giá giảm (từ 0.89500 xuống 0.89000 để có lãi).

### 1.2 Nến Nhật (Candlestick) & Khung Thời Gian (Timeframe)
Mỗi cây nến đại diện cho biến động giá trong một khoảng thời gian:
- **D1 (Daily)**: 1 cây nến gom dữ liệu của 24 giờ.
- **H1 (1-Hour)**: 1 cây nến gom dữ liệu của 1 giờ.
- Mỗi cây nến có 4 giá trị số thực `(Open, High, Low, Close)` viết tắt là `OHLC`:
  - `Open`: Giá mở cửa đầu giờ.
  - `Close`: Giá chốt cuối giờ.
  - `High`: Giá cao nhất chạm tới trong giờ.
  - `Low`: Giá thấp nhất chạm tới trong giờ.

---

## 2. Pip, Point, Lot, Spread (Đơn vị đo lường)

### 2.1 Pip và Point
- **Point**: Bước nhảy giá nhỏ nhất của sàn (thường là chữ số thập phân thứ 5, ví dụ `0.00001`).
- **Pip**: $1 \text{ Pip} = 10 \text{ Points} = 0.00010$ (với hầu hết các cặp như AUDCAD, EURUSD).
- *Ví dụ*: Giá AUDCAD tăng từ `0.89500` lên `0.89800` là tăng $300 \text{ points} = 30 \text{ pips}$.

### 2.2 Lot (Khối Lượng Lệnh)
- **1.00 Lot tiêu chuẩn** = 100,000 đơn vị tiền tệ cơ sở.
- **0.01 Lot (Micro-lot)** = 1,000 đơn vị tiền tệ.
- Trong hệ thống của chúng ta:
  - Lệnh đầu tiên ($L_0$) là **0.05 lot**.
  - Ngưỡng kích hoạt chế độ cứu lỗ ($R_{TH}$) là **0.30 lot**.

### 2.3 Spread (Phí chênh lệch mua/bán)
- Sàn luôn chào 2 mức giá cùng lúc: `Ask` (Giá để BUY) và `Bid` (Giá để SELL).
- $\text{Spread} = \text{Ask} - \text{Bid}$.
- *Ví dụ*: `Ask = 0.89515`, `Bid = 0.89500` $\rightarrow$ Spread là 1.5 pips (15 points).

---

## 3. Cấu Trúc Thị Trường: Trend, Sideway, Swing & BOS

```
        (Swing High 2 - HH)
             /\
            /  \       (BOS - Phá đỉnh cũ)
(Swing High 1)  \      --------------------
     /\          \          /\
    /  \          \        /  \
   /    \          \      /    \
  /      \/         \    /      \/
 /    (Swing Low 1)  \  /   (Swing Low 2 - HL)
                      \/
```

### 3.1 Xu Hướng (Trend) & Đi Ngang (Sideway)
- **UPTREND (Xu hướng tăng)**: Giá tạo các đỉnh sau cao hơn đỉnh trước (Higher High - `HH`) và đáy sau cao hơn đáy trước (Higher Low - `HL`).
- **DOWNTREND (Xu hướng giảm)**: Giá tạo các đỉnh sau thấp hơn đỉnh trước (Lower High - `LH`) và đáy sau thấp hơn đáy trước (Lower Low - `LL`).
- **SIDEWAY (Đi ngang/Kẹp biên)**: Giá dao động trong một vùng hộp chữ nhật giữa 2 đường Cản (không tạo rõ HH/HL).

### 3.2 Swing Point & BOS (Break of Structure)
- **Swing High**: Một đỉnh cục bộ (nằm cao hơn các nến xung quanh).
- **Swing Low**: Một đáy cục bộ (nằm thấp hơn các nến xung quanh).
- **BOS (Break of Structure - Phá vỡ cấu trúc)**: Khi giá vượt qua đỉnh Swing High gần nhất (xác nhận tiếp tục Uptrend) hoặc thủng đáy Swing Low gần nhất (xác nhận tiếp tục Downtrend).

### 3.3 Hỗ Trợ & Kháng Cự (Support & Resistance - S/R)
- **Support (Hỗ trợ / Sàn)**: Mức giá mà tại đó phe Mua tập trung đông, giá chạm vào thường nảy lên.
- **Resistance (Kháng cự / Trần)**: Mức giá mà tại đó phe Bán tập trung đông, giá chạm vào thường rơi xuống.

---

## 4. ATR (Average True Range - Thước Đo Biến Động)

- **ATR(14)**: Trung bình biên độ dao động giá của 14 cây nến gần nhất.
- Trong hệ thống của chúng ta:
  - `ATR_D1`: Đo mức biến động theo ngày (khoảng $40 - 80 \text{ pips}$).
  - `ATR_H1`: Đo mức biến động theo giờ (khoảng $8 - 15 \text{ pips}$).
- ATR được dùng để tính **Khoảng cách nhồi lệnh (DCA Spacing)**: Khi thị trường biến động mạnh (ATR lớn), hệ thống tự động giãn khoảng cách nhồi lệnh xa hơn để bảo vệ tài khoản.

---

## 5. DCA (Dollar-Cost Averaging) & Cơ Chế Trung Bình Giá

DCA trong trading là hành động **mở thêm lệnh cùng hướng khi giá đang đi ngược lại dự đoán ban đầu**, nhằm kéo mức giá trung bình của cả "rổ lệnh" lại gần thị trường hơn, giúp thoát lệnh có lãi sớm khi giá hồi nhẹ.

### Ví dụ bằng số học cụ thể:
1. Bạn mở lệnh 1: **BUY 0.05 lot tại giá 0.90000**. Target chốt lời 30 pips tại `0.90300`.
2. Giá không tăng mà giảm xuống `0.89600` (Bạn đang âm 40 pips).
3. Hệ thống mở lệnh 2 (DCA): **BUY 0.05 lot tại giá 0.89600**.
4. **Giá vốn trung bình mới**:
   $$\text{Giá TB} = \frac{(0.05 \times 0.90000) + (0.05 \times 0.89600)}{0.05 + 0.05} = 0.89800$$
5. Giờ đây, chỉ cần giá hồi nhẹ lên `0.89830` (+3 pips so với giá TB) là **TOÀN BỘ RỔ LỆNH ĐÃ CÓ LÃI** và thoát an toàn, không cần đợi giá quay lại tận `0.90300`.

---

## 6. Trạng Thái Hệ Thống & Ngưỡng Cứu Lỗ ($R_{TH}$)

Hệ thống quản lý tài khoản theo **State Machine**:

| Trạng thái | Điều kiện | Giải thích kỹ thuật |
| :--- | :--- | :--- |
| **FLAT** | `TotalLot == 0` | Không có lệnh nào đang chạy trên sàn. Hệ thống ngủ chờ tín hiệu đẹp tại H1 close. |
| **NORMAL** | $0 < \text{TotalLot} < 0.30$ | Đang có từ 1 đến vài lệnh DCA nhỏ. Quản trị rủi ro mức độ thông thường. |
| **RECOVERY** | $\text{TotalLot} \ge 0.30$ ($R_{TH}$) | **Chế độ cứu lỗ khẩn cấp**. Giá đi ngược quá xa khiến rổ lệnh phình to. |

---

## 7. Payoff Lot & Kỹ Thuật Tỉa Lệnh Âm (Recovery Mechanism)

Khi đã rơi vào **RECOVERY** ($\text{TotalLot} \ge 0.30$), hệ thống không nhồi lệnh lớn mù quáng mà kích hoạt cơ chế **Payoff**:

1. **Adverse Squeeze (Thị trường ép ngược)**: Giá tiếp tục đi xa, hệ thống cân nhắc mở thêm 1 lệnh DCA với lot nhỏ theo bước giá an toàn.
2. **Favorable Squeeze (Thị trường hồi nhẹ theo ý mình)**:
   - Hệ thống mở **1 lệnh Payoff** ($15\% - 30\%$ của TotalLot) để lướt sóng nhanh theo chiều hồi.
   - Khi lệnh Payoff có lãi $+X$ USD $\rightarrow$ Lập tức dùng số lãi này để **đóng từng phần (Partial Close) hoặc đóng toàn bộ lệnh lỗ nhỏ nhất trong rổ** (`argmin |profit|` trước để giảm nhanh số lệnh và TotalLot).
   - Giúp giảm dần `TotalLot` từ $0.35 \rightarrow 0.28 \rightarrow 0.15 \rightarrow 0.00$ đưa tài khoản về lại trạng thái an toàn `FLAT`.
