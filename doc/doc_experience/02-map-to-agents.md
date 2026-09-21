# 02 — Map Experience → Agents

## 1. Tools theo actor

| Tool | Agent A | Agent B | Orchestrator | LessonWriter | Executor |
|------|---------|---------|--------------|--------------|----------|
| `get_memory_pack(symbol, context, action)` | R (trước plan) | R (trước ballot) | R (build/inject) | — | — |
| `lessons_proposed[]` (output field) | **W** (trong plan JSON) | **W** (trong ballot JSON) | R (trích + route) | — | — |
| `record_lesson(candidate, caller)` | — (không gọi trực tiếp) | — | C (route từ output) | **RW** (single-writer) | — |
| `evaluate(plan, outcome)` | C | C | R / Orch | R | — |
| `submit_feedback(lesson_id, outcome, pl)` | — | — | C sau đóng | R | — |

> **DEC-18:** A/B chỉ *đề xuất* lesson qua field `lessons_proposed[]` trong `UnifiedContingencyPlan`/`Ballot` (schema: `doc_agents/04-message-schemas.md`). Không agent nào được gọi `record_lesson` trực tiếp — mọi ghi đi qua **LessonWriter single-writer**.

## 2. Vị trí trong flow

| Thời điểm | Gọi | Mục đích |
|-----------|-----|----------|
| Sau wake, **trước** A draft `UnifiedContingencyPlan` | `get_memory_pack` | Inject pack vào prompt A và B |
| B ballot | Đọc cùng pack | Bắt A vi phạm AVOID |
| Sau consensus mỗi cycle | Orchestrator đọc `lessons_proposed[]` → `record_lesson` | Đề xuất bài học mới từ plan |
| Sau CLOSE_ALL / exit RECOVERY / FAILED / hết cooldown | `evaluate` + `record_lesson` + `submit_feedback` | Học / cập nhật stats |

## 2b. Quan hệ MemoryPack ↔ plan_history_summaries (v2.x)

Hai lớp nhớ song song, **không ghi đè nhau**:

| Lớp | Bảng | Phạm vi | Vòng đời | Inject vào |
|-----|------|---------|----------|-----------|
| **Dài hạn** | `Lessons` → `MemoryPack` | Cross-cycle, cross-symbol | Persistent, time-decay | Prompt A/B mọi wake |
| **Ngắn hạn** | `plan_history_summaries` (trong `dca_<symbol>.db`) | Trong 1 macro cycle | Hủy khi macro cycle đóng | Prompt planning kế tiếp |

Khi macro cycle đóng (FLAT→FLAT), PlanSummarizer có thể **đề xuất** 1 lesson cô đọng vào `Lessons` (qua `lessons_proposed`) — nhưng không tự ghi; đi qua LessonWriter dedupe như mọi nguồn khác.

## 3. EnforceTopLessons

- Default `false` — advisory only.  
- Nếu `true`: HardValidator có thể REJECT plan trùng AVOID severity≥ ngưỡng (cấu hình) — vẫn **không** vượt 5 checks cứng phương pháp.

## 4. `get_memory_pack()` — Interface trừu tượng (DEC-18)

`get_memory_pack(symbol, context_type, action_type)` là **interface**; caller không biết backend:

| Backend | Cơ chế | Khi nào |
|---------|--------|---------|
| **v1 (mặc định)** | SQL prefilter → formula `Severity²×ln(occ)×Rel×Decay` → top-6 | Luôn khả dụng, không dependency |
| **v2 (tương lai, tùy chọn)** | SQL prefilter top ~20 → **external structured judge** (ví dụ Jev) rerank ngữ nghĩa → top-K | Khi corpus lessons lớn, cần relevance tốt hơn — chi tiết §4.1 |

**Rule fail-open bắt buộc:** external judge timeout/lỗi → tự động rớt về v1 deterministic. Judge outage **không bao giờ** được phép kích hoạt `SYSTEM_FREEZE` — memory retrieval là advisory, không phải execution path.

### 4.1 Backend v2 — External Judge (ví dụ: Jev) — TƯƠNG LAI, chưa triển khai

Khi corpus `Lessons` lớn dần, công thức cứng của v1 bắt đầu lỏng: `Relevance` chỉ là hằng số (0.7 group / 0.4 ANY) và không hiểu ngữ nghĩa — lesson "né DCA khi sát cản D1" sẽ không được chấm cao nếu `action_type` không khớp chính xác. Backend v2 chen thêm **1 lớp judge** giữa prefilter và render pack:

```
SQL prefilter (~20 ứng viên theo symbol/context/action)
  → external judge chấm "lesson_i có liên quan state hiện tại không?" (1 call cho cả batch)
  → rerank theo điểm judge → lấy top-K → MemoryPack
```

**Jev (TypeSafe — "System One" model)** là ứng viên cho vai trò judge vì đúng shape bài toán: nhận state → trả **typed probabilistic decisions** (không sinh text, không hallucinate, output đúng type kèm calibrated confidence; một call chấm được nhiều câu hỏi song song). Latency 70–500ms phù hợp nhịp H1.

**Thuộc tính bắt buộc khi gắn Jev:**

- Jev chỉ là **judge/reranker cho retrieval** — KHÔNG thay LLM A/B, không sinh plan, không phải embedding-RAG truyền thống.
- `trigger_cond` (JSON trong `Lessons`) là input chấm tốt cho judge — giữ format structured, không gộp thành text tự do.
- **Fail-open** (như trên): judge sập/timeout → rớt về v1; outage ≠ `SYSTEM_FREEZE`.
- **Quan sát chất lượng:** ghi `retrieval_score`/`retrieval_rank` vào `LessonFeedback` để đo reranker so với baseline v1 trước khi quyết định bật production.
- **Khi nào đáng bật:** chỉ khi số `Lessons` ACTIVE lớn (ví dụ >100/symbol) — corpus nhỏ thì v1 đủ, Jev chỉ tăng độ phức tạp.
- Tham khảo: https://typesafe.ai/blog/introducing-system-one-models-and-jev

## 5. Liên kết

- Spec DDL: [01-experience-db-spec.md](01-experience-db-spec.md)  
- Message schemas (bao gồm `lessons_proposed[]`): [`../doc_agents/04-message-schemas.md`](../doc_agents/04-message-schemas.md)
- Agents runtime: [`../doc_agents/09-runtime-architecture.md`](../doc_agents/09-runtime-architecture.md)  
- Loop agents: [`../doc_agents/13-experience-loop.md`](../doc_agents/13-experience-loop.md)  
