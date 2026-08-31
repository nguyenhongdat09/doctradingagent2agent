# 02 — Map Experience → Agents

## 1. Tools theo actor

| Tool | Agent A | Agent B | LessonWriter | Executor |
|------|---------|---------|--------------|----------|
| `get_memory_pack(symbol, context, action)` | R (trước plan) | R (trước ballot) | — | — |
| `record_lesson(...)` | C (đề xuất) | C | **R** (single-writer) | — |
| `evaluate(plan, outcome)` | C | C | R / Orch | — |
| `submit_feedback(lesson_id, outcome, pl)` | C sau đóng | C | R | — |

## 2. Vị trí trong flow

| Thời điểm | Gọi | Mục đích |
|-----------|-----|----------|
| Sau wake, **trước** A draft TradePlan | `get_memory_pack` | Inject pack vào prompt A và B |
| B ballot | Đọc cùng pack | Bắt A vi phạm AVOID |
| Sau CLOSE_ALL / exit RECOVERY / FAILED | `evaluate` + `record_lesson` + `submit_feedback` | Học / cập nhật stats |

## 3. EnforceTopLessons

- Default `false` — advisory only.  
- Nếu `true`: HardValidator có thể REJECT plan trùng AVOID severity≥ ngưỡng (cấu hình) — vẫn **không** vượt 5 checks cứng phương pháp.

## 4. Liên kết

- Spec DDL: [01-experience-db-spec.md](01-experience-db-spec.md)  
- Agents runtime: [`../doc_agents/09-runtime-architecture.md`](../doc_agents/09-runtime-architecture.md)  
- Loop agents: [`../doc_agents/13-experience-loop.md`](../doc_agents/13-experience-loop.md)  
