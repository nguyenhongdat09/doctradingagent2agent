# 05 - HÀNG ĐỢI LỆNH & WORKER THỰC THI (QUEUE & EXECUTOR)

> **File sơ đồ Mermaid tương ứng**: [05-queue-executor.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/05-queue-executor.mmd)

---

## 1. Tách Rời "Não Bộ" (LLM) và "Đôi Tay" (Executor)

Trong các hệ thống trading kém an toàn, code thường gọi trực tiếp hàm `mt5.order_send()` ngay trong luồng xử lý AI. Điều này cực kỳ nguy hiểm vì nếu mạng bị lag, timeout, hoặc luồng bị gọi lại, tài khoản có thể bị mở 2-3 lệnh giống nhau (Double Trading).

Hệ thống của chúng ta tách rời hoàn toàn:
1. **Brain Agents + HardValidator** chỉ có quyền: `INSERT INTO MarketOrderInfo (status='PENDING')`.
2. **Executor Worker** chạy vòng lặp ngầm (Background Loop) chuyên trách việc đọc queue và gửi lệnh lên MT5.

---

## 2. Cơ Chế Atomic Claim (Khóa Ghi Độc Quyền)

Để chống race condition, Executor sử dụng câu lệnh SQL nguyên tử (Atomic Update):

```sql
-- Worker tìm lệnh PENDING cũ nhất và chuyển ngay sang PROCESSING trong 1 nhịp:
WITH next_order AS (
    SELECT id FROM MarketOrderInfo 
    WHERE status = 'PENDING' 
    ORDER BY created_at ASC 
    LIMIT 1
)
UPDATE MarketOrderInfo 
SET status = 'PROCESSING', claimed_at = CURRENT_TIMESTAMP 
WHERE id = (SELECT id FROM next_order)
RETURNING *;
```

- Nhờ cơ chế này, dù có nhiều thread cùng quét DB, chỉ có đúng 1 worker lấy được lệnh để xử lý.

---

## 3. Vòng Đời Lệnh (Lifecycle)

- **`PENDING`**: Lệnh vừa được Agent và Validator thông qua, nằm chờ trong SQLite.
- **`PROCESSING`**: Đã được Executor claim, đang gửi gói tin sang MT5 API.
- **`ARCHIVED`**: MT5 xác nhận mở lệnh thành công (`retcode == 10009`). Lệnh được thêm vào bảng `open_orders`, xóa khỏi `MarketOrderInfo`, và cập nhật `pair_state`.
- **`FAILED`**: Sàn từ chối (hết tiền ký quỹ, spread giãn quá mức, mất mạng). Hệ thống lưu log và bắn cảnh báo ngay lập tức.
