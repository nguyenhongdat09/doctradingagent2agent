# 11 - KÊNH THAM VẤN CỦA BOSS (BOSS CHANNEL - ADVISORY ONLY)

> **File sơ đồ Mermaid tương ứng**: [11-boss-channel.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/11-boss-channel.mmd)

---

## 1. Nguyên Tắc Thiết Kế: "Không Có Boss Override" (No Forced Bypass / No OrderSend)

Trong một hệ thống tự động, nếu con người có thể bấm một nút "ép buộc vào lệnh" mà bỏ qua mọi quy chuẩn an toàn, hệ thống sẽ rất dễ bị cảm xúc chi phối dẫn đến thua lỗ nặng nề (FOMO/Revenge trading).

Hệ thống đặt ra quy định:
- **Boss là cố vấn cấp cao (Advisory Only)**: Ý kiến của Boss được trân trọng đưa vào prompt của Agent A và Agent B như một nguồn dữ liệu tham khảo chất lượng cao. Boss **tuyệt đối không có quyền Override**, không có nút gọi trực tiếp `OrderSend()` sang sàn MT5.
- **Không có cửa sau (No Backdoor)**: Dù Boss chỉ đạo gì, kế hoạch cuối cùng vẫn phải được **Agent A đồng ý + Agent B bỏ phiếu duyệt + HardValidator kiểm tra 5/5 quy tắc an toàn** mới được đưa vào SQLite Queue `MarketOrderInfo`.

---

## 2. Quy Trình Hội Đàm 3 Bên (Tripartite Conference)

1. Boss gửi thông điệp qua Telegram hoặc CLI (ví dụ: *"Cặp AUDCAD sắp có bài phát biểu của Thống đốc RBA, hạn chế nhồi lệnh"*).
2. Hệ thống tạo một phiên thảo luận ngắn gọn (tối đa 12 lượt đối thoại để kiểm soát chi phí token LLM).
3. Agent A và Agent B tiếp thu ý kiến của Boss để điều chỉnh `TradePlan`.
4. Nếu kế hoạch thỏa mãn mọi ràng buộc an toàn, lệnh mới được nạp vào hàng đợi thực thi.
