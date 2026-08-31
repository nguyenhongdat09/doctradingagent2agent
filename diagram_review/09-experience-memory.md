# 09 - BỘ NHỚ KINH NGHIỆM VÀ QUẢN TRỊ TOKEN (EXPERIENCE MEMORY)

> **File sơ đồ Mermaid tương ứng**: [09-experience-memory.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/09-experience-memory.mmd)

---

## 1. Tại Sao Không Dùng RAG Phức Tạp Với Vector DB Nặng Nề?

Thay vì dựng cụm Vector DB (như Pinecone hay Milvus) tốn kém và cồng kềnh, hệ thống sử dụng một bảng SQLite nhỏ gọn kết hợp bộ lọc phân hạng bài học thông minh:

- **Mục tiêu**: Bơm ngữ cảnh lịch sử cho LLM nhưng **chi phí Token cực rẻ**.
- **Ngân sách cố định**: Toàn bộ `MemoryPack` được giới hạn cứng **không vượt quá 500 Tokens**.

---

## 2. Cấu Trúc Hai Tầng Của MemoryPack ($\le 500$ Tokens)

```
┌────────────────────────────────────────────────────────┐
│                   MemoryPack Output                     │
├──────────────────────────┬─────────────────────────────┤
│   Tier 1: Symbol Profile │      Tier 2: Top 6 Lessons  │
│      (≤ 150 Tokens)      │          (≤ 350 Tokens)     │
│                          │                             │
│ - Tên cặp: AUDCAD        │ 1. [AVOID] Đua lệnh khi     │
│ - Đặc tính biên độ       │    tin Fed sắp ra           │
│ - Win rate 30 ngày gần   │ 2. [PREFER] Mua tại S/R D1  │
│   nhất                   │    khi RSI phân kỳ          │
│ - Chế độ hiện tại        │ ...                         │
└──────────────────────────┴─────────────────────────────┘
```

1. **Tier 1: Symbol Profile ($\le 150$ Tokens)**:
   - Bản tóm tắt "tính cách" của cặp tiền tệ (biến động mạnh hay đi ngang nhiều, thời điểm hoạt động sôi nổi).
2. **Tier 2: Top 6 Lessons ($\le 350$ Tokens)**:
   - 6 bài học được xếp hạng điểm phù hợp nhất với tình huống nến hiện tại.
   - Ba loại bài học: `AVOID` (Cảnh báo sai lầm), `PREFER` (Khen ngợi mẫu hình đẹp), `WARNING` (Cảnh báo biến động bất thường).

---

## 3. Vòng Đời Tự Hoàn Thiện (Closed-Loop Learning)

1. Lệnh đóng $\rightarrow$ Hệ thống ghi log P&L.
2. Bộ đánh giá trích xuất bài học mới $\rightarrow$ Chống trùng lặp (Deduplicate) $\rightarrow$ Lưu vào `experience.db`.
3. Khi Agent tham khảo bài học để ra quyết định:
   - Nếu lệnh thắng $\rightarrow$ Tăng điểm uy tín (`effectiveness_score`) của bài học.
   - Nếu lệnh thua $\rightarrow$ Giảm điểm hoặc đào thải bài học sai lệch.
