# 01 - GIẢI THÍCH TOÀN CẢNH HỆ THỐNG (HELICOPTER VIEW)

> **File sơ đồ Mermaid tương ứng**: [01-helicopter-view.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/01-helicopter-view.mmd)

---

## 1. Bản Chất Hệ Thống Dưới Góc Nhìn Kỹ Sư Phần Mềm

Hệ thống được thiết kế theo mô hình **Sense ➔ Think ➔ Guard ➔ Act ➔ Learn** (Cảm nhận ➔ Suy nghĩ ➔ Kiểm duyệt ➔ Hành động ➔ Học hỏi):

```
MT5 Data ──▶ [Eyes Engine] ──▶ [LLM Agents] ──▶ [HardValidator] ──▶ [Queue] ──▶ [Executor] ──▶ MT5 Order
                    │                                                              │
                    └───────────────────── [Experience DB] ◀───────────────────────┘
```

1. **Sense (Cảm nhận - Eyes Engine)**: Thu thập nến giá từ MT5, tính toán toán học (pivot, trend, sức mạnh nến) rồi đóng gói thành 1 bản tin JSON súc tích gọi là `MarketSnapshot`.
2. **Think (Suy nghĩ - Brain Agents)**: Hai mô hình LLM độc lập (Agent A & Agent B) đọc `MarketSnapshot` cùng bộ nhớ kinh nghiệm ngắn gọn `MemoryPack` để thảo luận và ra quyết định hành động.
3. **Guard (Kiểm duyệt - HardValidator)**: 100% bằng code Python thuần. Nếu LLM hallucinate (ảo giác) sinh ra lệnh sai quy tắc (ví dụ: Matrix sai, Spacing chưa đủ, ngược hướng rổ, sai bước volume), HardValidator lập tức chặn đứng.
4. **Act (Hành động - Queue Executor)**: Lưu lệnh vào SQLite Queue (`MarketOrderInfo`). Worker thực thi riêng biệt tiến hành claim bản ghi bằng Atomic Transaction và bắn lệnh sang sàn MT5.
5. **Learn (Học hỏi - Experience Feedback)**: Khi lệnh đóng, hệ thống đánh giá thắng/thua để đúc kết bài học vào cơ sở dữ liệu `experience.db`.

---

## 2. Phân Định Trách Nhiệm Rõ Ràng (Separation of Concerns)

| Thành phần | Vai trò kỹ thuật | Trách nhiệm chính | Điều TUYỆT ĐỐI KHÔNG làm |
| :--- | :--- | :--- | :--- |
| **Eyes Engine (Mắt)** | 🔧 Deterministic Math | Đọc OHLCV, tính toán Context D1, Signal H1, gom dữ liệu. | **Không** được tự động đặt lệnh hay can thiệp logic giao dịch. |
| **Agent A & Agent B (Não)** | ✅ Reasoning / ALL-LLM | Phân tích đa chiều, thỏa hiệp qua Consensus Protocol để ra `TradePlan`. | **Không** trực tiếp gọi hàm API MT5. Chỉ xuất ra JSON kế hoạch. |
| **HardValidator** | 🛡️ Rule-based Gatekeeper | Kiểm tra 5 ràng buộc an toàn (Matrix Context x PUSH, Spacing/Ladder, Cấm ngược hướng, NormalizeLot broker, Kill-switch OFF). | **Không** thay đổi quyết định nếu hợp lệ. |
| **Queue Executor (Tay)** | ⚙️ Background Worker | Atomic claim lệnh từ SQLite `MarketOrderInfo` và gửi sang MT5. | **Không** phán đoán thị trường. Có lệnh trong queue là gửi. |
| **Experience DB** | 🧠 Long-term Storage | Lưu trữ profile cặp tiền, danh sách bài học (Lessons), cấp `MemoryPack`. | **Không** giữ quá 500 tokens để tránh làm loãng ngữ cảnh LLM. |
