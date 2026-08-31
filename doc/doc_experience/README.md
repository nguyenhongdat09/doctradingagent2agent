# Experience DB (Bộ Nhớ Rút Kinh Nghiệm) — Design Doc

Bộ đặc tả kiến trúc cơ sở dữ liệu tri thức dùng chung (`experience.db`), cơ chế rút kinh nghiệm sau giao dịch, thuật ngữ bài học chuẩn hóa, thuật toán xếp hạng ưu tiên và bộ nhớ đệm 2 tầng (**MemoryPack**) cho hệ thống Trading Agent DCA đa cặp trên MT5/Python.

> **Bản cập nhật chính thức:** Thiết kế chuẩn hóa bộ nhớ kinh nghiệm toàn hệ thống.  
> **Thư mục liên quan:**
> - Phương pháp giao dịch: [`../doc_phuong_phap/`](../doc_phuong_phap/)
> - Hệ thống Multi-Agent: [`../doc_agents/`](../doc_agents/)

---

## Mục Lục Tài Liệu

| File | Nội dung |
|------|----------|
| [01-experience-db-spec.md](01-experience-db-spec.md) | Triết lý, Schema DDL đầy đủ, Template bài học, Thuật toán Scoring, MemoryPack 2 tầng, Vòng đời Dedupe & Invalidation, Chi phí Token & Python Tools |

---

## Tập Hợp Diagrams (Mermaid .mmd)

| File | Loại | Mô tả |
|------|------|-------|
| [diagrams/E01-experience-er.mmd](diagrams/E01-experience-er.mmd) | erDiagram | Schema 4 bảng: `Lessons`, `MemoryCache`, `PairProfiles`, `LessonFeedback` |
| [diagrams/E02-learning-cache-flow.mmd](diagrams/E02-learning-cache-flow.mmd) | flowchart TD | Vòng đời học hỏi: Batch Trigger → Deduplication → Invalidation → MemoryPackBuilder → Feedback |
| [diagrams/E03-memory-injection.mmd](diagrams/E03-memory-injection.mmd) | sequenceDiagram | Vị trí nạp `get_memory_pack()` trong chu kỳ ra quyết định của Agent A & Agent B |

---

## Tóm Tắt Nguyên Tắc Cốt Lõi

1. **Không ghi Journal chi tiết:** Chỉ lưu các bài học cô đọng $\le 200$ ký tự theo mẫu `[AVOID | PREFER | WARNING]`.
2. **File Database Dùng Chung:** `experience.db` dùng chung cho toàn bộ các cặp giao dịch (`AUDCAD`, `AUDNZD`, `GBPUSD`, `NZDCAD`).
3. **Bộ Nhớ 2 Tầng Siêu Nhẹ:** MemoryPack kết xuất sẵn có dung lượng $\le 500$ tokens (T1: Profile & Evergreen $\le 150$ tokens; T2: Top 6 Dynamic Lessons $\le 350$ tokens).
4. **Chi Phí Tối Ưu:** Chỉ tốn $\approx \$0.006 \sim \$0.02 \text{ USD/ngày/cặp}$ với tần suất 24 chu kỳ nến H1.
