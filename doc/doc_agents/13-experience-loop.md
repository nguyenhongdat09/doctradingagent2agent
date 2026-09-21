# 13 — Experience Loop (Agents)

Tham chiếu: [`../doc_experience/`](../doc_experience/).

## 1. Trước plan

```
Wake → get_memory_pack(symbol, ContextFinal_or_ANY, intended_action)
     → inject pack vào prompt A và B
     → A draft / B ballot (B dùng pack để challenge AVOID)
```

## 2. Sau đóng / FAILED (write-path theo DEC-18)

```
CLOSE_ALL success | exit RECOVERY | queue FAILED | cooldown end | plan DONE
  → evaluate(plan, outcome)
  → đọc plan.lessons_proposed[] (A/B đề xuất trong output — xem 04 §3b)
  → record_lesson(...) qua LessonWriter (single-writer)
  → submit_feedback(lesson_id, WIN|LOSS|FLAT|NA, pl)
  → invalidate MemoryCache liên quan
```

> Lesson proposal đến từ field `lessons_proposed[]` trong `UnifiedContingencyPlan`
> output của A/B (không phải tool-call riêng). LessonWriter quyết định insert/dedupe.

## 3. Không làm

- Agents không ghi trực tiếp SQLite Lessons nếu có LessonWriter riêng.  
- Không dùng outcome `'FAIL'` — dùng `'LOSS'` / `'NA'`.  
