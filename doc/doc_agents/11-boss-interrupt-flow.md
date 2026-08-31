# 11 — Boss Interrupt Flow (v1)

## 1. Mục tiêu

Boss prompt đánh thức agents đang ngủ → hội thoại A–B–Boss → **chỉ khi B.APPROVE + HardPass** thì A enqueue.  
**Không có BossOverride.**

## 2. Sequence

```
B0  BossWake(intent, symbols)
B1  Orch: cancel sleep; session_mode=BOSS; wake A+B
B2  get_memory_pack
B3  A plan (HardPass)
B4  B ballot độc lập
B5  Chat ≤ MaxBossTurns
B6  A revise nếu cần; B ballot lại
B7  BossACK = xác nhận đã bàn (optional log)
B8  Nếu B.APPROVE → A.enqueue → Executor
    Nếu B dissent → DEFER + wake C1–C3 (Boss không ép được)
B9  session_mode=AUTO; A WakeRequest; sleep
```

## 3. Điều kiện enqueue trong BOSS

```
HardPass ∧ B.APPROVE ∧ ballot_valid(B)
→ A.enqueue_order
```

## 4. Giới hạn

| Rule | v1 |
|------|-----|
| MaxBossTurns | 12 |
| BossOverride | **Tắt** |
| Boss OrderSend / enqueue | **Cấm** |

Diagram: [A05](diagrams/A05-boss-interrupt.mmd).
