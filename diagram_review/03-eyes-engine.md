# 03 - BỘ MÁY TÍNH TOÁN "MẮT" (EYES ENGINE)

> **File sơ đồ Mermaid tương ứng**: [03-eyes-engine.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/03-eyes-engine.mmd)

---

## 1. Bản Chất: Bộ Máy Tính Toán Toán Học (Deterministic Math)

"Mắt" (Eyes Engine) đóng vai trò là tầng tiền xử lý dữ liệu (Feature Engineering). 

> [!IMPORTANT]
> **Quy tắc bất di bất dịch**: Eyes Engine chỉ làm các phép tính thống kê nến và nén dữ liệu. Eyes Engine **KHÔNG BAO GIỜ TỰ Ý MỞ LỆNH**. Toàn bộ quyền quyết định thuộc về LLM Agents.

---

## 2. Phần A: D1 Structure Pipeline (Bức tranh dài hạn)

1. **Pivot Swing Detection**: Quét chuỗi nến D1 để tìm các đỉnh (`Swing High`) và đáy (`Swing Low`) có ý nghĩa thống kê.
2. **BOS (Break of Structure)**: Kiểm tra giá đóng cửa có phá vỡ đỉnh/đáy trước đó hay không để xác định UPTREND hoặc DOWNTREND.
3. **Bộ lọc Hysteresis (Độ trễ chống nhiễu)**: 
   - Thị trường tài chính hay có các cây nến "râu dài" quét ảo. 
   - Thuật toán Hysteresis yêu cầu giá phải vượt qua ngưỡng $K \times \text{ATR}$ và giữ vững thì mới lật trạng thái xu hướng, ngăn chặn tình trạng xoay chiều liên tục trong ngày.

---

## 3. Phần B: H1 Signal Pipeline (Đo lường xung lực ngắn hạn)

### 3.1 Công thức tính Strength Score (0.0 đến 1.0)
$$\text{Raw Score} = 0.4 \times \text{Momentum} + 0.3 \times \text{Structural} + 0.2 \times \text{Location} + 0.1 \times \text{Confirmation}$$

- **Momentum (40%)**: Tỷ lệ thân nến so với toàn bộ chiều dài nến và nến trung bình.
- **Structural (30%)**: Nến H1 có nằm thuận theo cấu trúc sóng con hay không.
- **Location (20%)**: Khoảng cách tới các ngưỡng Hỗ trợ / Kháng cự quan trọng.
- **Confirmation (10%)**: Khối lượng giao dịch (Tick Volume) tăng trưởng.

### 3.2 Bộ lọc loại trừ (Disqualification - DQ)
Dù điểm thô cao, điểm số sẽ bị đánh tụt xuống nếu:
- **Streak Filter**: Đã có 4-5 nến cùng màu liên tiếp (Rủi ro kiệt sức/đảo chiều).
- **D1 Wall Filter**: Giá đang tiến sát vào một bức tường cản cứng khung D1.

### 3.3 Ba phân vùng tín hiệu
- **$\ge 0.60$ (PUSH Zone)**: Xung lực rõ ràng, đủ điều kiện để LLM cân nhắc mở lệnh.
- **$0.40 - 0.59$ (Soft Zone / WAIT)**: Xung lực trung bình, thị trường lưỡng lự.
- **$< 0.40$ (IGNORE)**: Tín hiệu rác, không kích hoạt LLM tốn chi phí.
