# 13 - TRÌNH TỰ CHI TIẾT MỘT CHU KỲ HOÀN CHỈNH (SEQUENCE ONE CYCLE)

> **File sơ đồ Mermaid tương ứng**: [13-sequence-one-cycle.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/13-sequence-one-cycle.mmd)

---

## 1. Vòng Đời Một Nhịp Thức Giấc (Wake Cycle Execution)

Sơ đồ trình tự biểu diễn chính xác dòng thời gian từ mili-giây đầu tiên khi hệ thống thức giấc cho đến khi hoàn tất giao dịch và trở lại trạng thái ngủ:

```
[1. Scheduler Wake] 
       │
[2. MT5 Data Fetch] ────▶ [3. Eyes Engine Math] ────▶ [4. MemoryPack Injection]
                                                              │
[7. Queue Producer] ◀──── [6. HardValidator 5 Rules] ◀──── [5. Dual-Agent Consensus]
       │
[8. Atomic Claim] ──────▶ [9. MT5 OrderSend] ────────▶ [10. DB State & Next Wake]
```

---

## 2. Các Mốc Sự Kiện Trọng Yếu Trong Chu Kỳ

1. **Bước 1-4 (Cảm nhận & Thu thập)**:
   - Scheduler đánh thức hệ thống (ví dụ: nhịp $C_1$ đầu giờ hoặc $C_3$ khi giá biến động).
   - Eyes Engine lấy nến từ MT5, tính toán `Context D1` và `Strength Score H1`.
   - Bơm `MemoryPack` ($\le 500$ tokens) từ `experience.db`.
2. **Bước 5-8 (Suy luận & Thỏa hiệp)**:
   - Agent A lập kế hoạch (`TradePlan`), gửi cho Agent B.
   - Agent B phản biện và bỏ phiếu phê duyệt (`ReviewBallot: APPROVE`).
3. **Bước 9-11 (Gác cổng kỹ thuật)**:
   - `HardValidator` chạy 5 phép kiểm tra logic cứng bằng Python (Chống ảo giác AI).
   - Nếu hợp lệ, đẩy lệnh vào SQLite Queue `MarketOrderInfo` với trạng thái `PENDING`.
4. **Bước 12-16 (Thực thi & Cập nhật)**:
   - Executor Worker thực hiện **Atomic Claim** chuyển trạng thái thành `PROCESSING`.
   - Gửi lệnh `OrderSend` sang MT5.
   - Khi sàn báo thành công, lưu Ticket vào `open_orders`, xóa bản ghi khỏi `MarketOrderInfo`, cập nhật `pair_state` (TotalLot mới) và ghi nhận chi phí token vào `llm_runs`.
5. **Bước 17 (Tiết kiệm tài nguyên)**:
   - Scheduler tính toán mốc thời gian tiếp theo cần thức giấc và đưa Process vào trạng thái ngủ an toàn.
