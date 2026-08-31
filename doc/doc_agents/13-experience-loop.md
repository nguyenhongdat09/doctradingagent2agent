# 13 — Experience Loop (Agents)

Tham chiếu: [`../doc_experience/`](../doc_experience/).

## 1. Trước plan

```
Wake → get_memory_pack(symbol, ContextFinal_or_ANY, intended_action)
     → inject pack vào prompt A và B
     → A draft / B ballot (B dùng pack để challenge AVOID)
```

## 2. Sau đóng / FAILED

```
CLOSE_ALL success | exit RECOVERY | queue FAILED | cooldown end
  → evaluate(plan, outcome)
  → record_lesson(...) qua LessonWriter
  → submit_feedback(lesson_id, WIN|LOSS|FLAT|NA, pl)
  → invalidate MemoryCache liên quan
```

## 3. Không làm

- Agents không ghi trực tiếp SQLite Lessons nếu có LessonWriter riêng.  
- Không dùng outcome `'FAIL'` — dùng `'LOSS'` / `'NA'`.  
