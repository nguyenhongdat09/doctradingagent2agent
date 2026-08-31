# 03 — Phase 2: Hệ Thống Bộ Nhớ Rút Kinh Nghiệm (Experience DB & MemoryPack)

> **Mục tiêu Phase 2:** Xây dựng cơ sở dữ liệu tri thức dùng chung (`experience.db`), cơ chế nạp bài học nhanh qua bộ nhớ đệm 2 tầng (**MemoryPack** $\le 500$ tokens), thuật toán chấm điểm ưu tiên và cơ chế chống trùng lặp (Deduplication).

---

## 📦 1. Các Module Cần Viết Trong Phase 2

### Module 2.1: Experience Database & Schemas (`src/database/experience_db.py`)
- **Nhiệm vụ:**
  - Khởi tạo file database dùng chung `data/experience.db` với PRAGMA WAL mode.
  - Tạo 4 bảng theo đặc tả [01-experience-db-spec.md](../doc_experience/01-experience-db-spec.md):
    1. `Lessons`: Lưu các bài học cô đọng $\le 200$ ký tự theo template `[AVOID | PREFER | WARNING]`.
    2. `MemoryCache`: Lưu trữ chuỗi text MemoryPack đã render sẵn theo cache key `<symbol>|<context_type>|<action_type>`.
    3. `PairProfiles`: Lưu tóm tắt đặc tính 4 cặp tiền (`AUDCAD`, `AUDNZD`, `GBPUSD`, `NZDCAD`).
    4. `LessonFeedback`: Ghi nhận hiệu quả bài học sau mỗi lệnh đóng (`WIN`, `LOSS`, `FLAT`, `NA`).

### Module 2.2: Thuật Toán Chấm Điểm & Lọc Bài Học (`src/experience/scoring.py`)
- **Nhiệm vụ:**
  - Cài đặt công thức xếp hạng bài học:
    $$\text{Score} = \text{Severity}^2 \times \Big(1 + \ln(\text{occurrence\_count})\Big) \times \text{Relevance} \times \text{TimeDecay}$$
  - Trong đó:
    - $\text{Severity} \in [1, 5]$ ($\text{Severity}^2 \in [1, 25]$).
    - $\text{Relevance} = \text{ScopeRelevance} \times \text{ContextRelevance}$:
      - $\text{ScopeRelevance}$: Đúng cặp ($1.0$), cùng nhóm ($0.7$), dùng chung 'all' ($0.5$).
      - $\text{ContextRelevance}$: Đúng bối cảnh ($1.0$), bối cảnh 'ANY' ($0.4$).
    - $\text{TimeDecay} = 0.9^{\Delta t_{\text{days}}}$.

### Module 2.3: MemoryPack Builder 2 Tầng (`src/experience/memory_pack_builder.py`)
- **Nhiệm vụ:**
  - Cài đặt hàm `get_memory_pack(symbol: str, context_type: str, action_type: str) -> str`:
    1. **Kiểm tra Cache:** Nếu có trong `MemoryCache` và chưa hết hạn TTL ($3600\text{s}$) $\rightarrow$ Trả về ngay lập tức ($O(1)$ query).
    2. **Tầng 1 (Permanent / Profile & Evergreen $\le 150$ tokens):**
       - Lấy Profile ngắn gọn từ `PairProfiles` ($\le 300$ ký tự).
       - Lấy tối đa 2 bài học cốt lõi có `Severity = 5` (Evergreen rules).
    3. **Tầng 2 (Dynamic Ranked Lessons $\le 350$ tokens):**
       - Lọc bài học theo `symbol`/`group`/`all` và `context_type`/`action_type` phù hợp.
       - Tính Score cho từng bài học và chọn **Top 6 bài học** có điểm cao nhất.
    4. **Render & Kiểm Soát Token:** Gộp Tầng 1 và Tầng 2, đảm bảo tổng độ dài $\le 500$ tokens.
    5. **Cập nhật Cache:** Lưu chuỗi kết xuất vào bảng `MemoryCache`.

### Module 2.4: LessonWriter & Deduplication Engine (`src/experience/lesson_writer.py`)
- **Nhiệm vụ:**
  - Đảm bảo cơ chế **Single-Writer**: Chỉ một tiến trình/thread duy nhất có quyền ghi vào bảng `Lessons` để tránh xung đột SQLite.
  - **Deduplication:**
    - Tính mã băm định danh:
      $$\text{Hash} = \text{SHA256}(\text{symbol} + \text{context\_type} + \text{action\_type} + \text{lesson\_type} + \text{trigger\_cond})$$
    - Nếu đã tồn tại Lesson có cùng Hash: Thực hiện `UPDATE` tăng `occurrence_count`, cộng dồn `total_pl_usd`, cập nhật `last_seen_at`.
    - Nếu chưa tồn tại: `INSERT` dòng mới vào `Lessons`.
  - **Cache Invalidation:** Bất cứ khi nào có `INSERT` hoặc `UPDATE` bài học $\rightarrow$ Xóa/vô hiệu hóa các bản ghi trong `MemoryCache` liên quan đến symbol hoặc scope đó.
  - **Ghi nhận phản hồi (`submit_feedback`):** Sau khi đóng rổ lệnh hoặc thoát RECOVERY, ghi nhận kết quả (`WIN`/`LOSS`) vào `LessonFeedback`. Nếu bài học bị gắn `LOSS` liên tiếp $\ge 3$ lần $\rightarrow$ Đổi trạng thái sang `SUPERSEDED`.

---

## ✅ 2. Checklist Developer — Phase 2

- [ ] **Khởi tạo DDL:** Tạo thành công database `experience.db` với đầy đủ indexes.
- [ ] **Nạp Dữ Liệu Ban Đầu:** Nạp 4 bản ghi hồ sơ cặp tiền vào `PairProfiles` và các bài học mẫu cơ bản.
- [ ] **Scoring Engine:** Kiểm tra công thức xếp hạng, đảm bảo bài học có Severity cao và tần suất nhiều được ưu tiên Top đầu.
- [ ] **MemoryPack Builder:** Render chuỗi text chuẩn Markdown, tổng token ước lượng luôn $\le 500$ tokens.
- [ ] **Cache Mechanism:** Test lần gọi thứ 2 trả về kết quả từ `MemoryCache` mà không cần query lại bảng `Lessons`.
- [ ] **Deduplication & Invalidation:** Thử ghi 2 bài học trùng điều kiện $\rightarrow$ DB chỉ tăng `occurrence_count`, không sinh dòng mới, đồng thời cache cũ bị xóa.

---

## 🧪 3. Kiểm Thử Cần Thực Hiện (Unit & Integration Tests)

1. **Unit Test MemoryPack Builder (`tests/unit/test_memory_pack_builder.py`):**
   - Mock 20 bài học với các mức severity và ngày tạo khác nhau.
   - Gọi `get_memory_pack('AUDCAD', 'UPTREND', 'ENTRY')`.
   - Assert: Trả về chuỗi Markdown gồm 2 tầng (Profile + Top 6 bài học); tổng số từ/tokens $\le 500$ tokens.
2. **Integration Test Cache & Invalidation (`tests/integration/test_experience_cache.py`):**
   - Gọi `get_memory_pack` lần 1 $\rightarrow$ Cache miss, ghi vào `MemoryCache`.
   - Gọi `get_memory_pack` lần 2 $\rightarrow$ Cache hit (truy vấn nhanh $< 2\text{ms}$).
   - Ghi thêm 1 bài học mới qua `LessonWriter` $\rightarrow$ Assert: Bản ghi trong `MemoryCache` bị xóa hoặc đánh dấu hết hạn.
