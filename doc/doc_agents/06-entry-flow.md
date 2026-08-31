# 06 — Entry Flow (Lệnh đầu)

## 1. Mục tiêu

FLAT → consensus → **A INSERT `MarketOrderInfo` PENDING** → Executor OrderSend BeginLot → NORMAL.

## 2. Preconditions

```
PairState == FLAT ∧ TotalLot == 0 ∧ ¬KillSwitch
HardValidator: Context×PUSH≥0.6 ∈ matrix OPEN_*
```

## 3. Flow AUTO

```
1. Wake
2. get_memory_pack → A & B
3. MDA: D1 structure → ContextFinal; H1 Strength Score → rails
4. MatrixAction (chỉ strength_final ≥ 0.6); soft zone [0.4,0.6) = WAIT + log "soft zone"
5. Draft TradePlan ENTRY
6. HardValidator — fail → WAIT/wake
7. B ballot (+ MemoryPack)
8. CHALLENGE ≤2 → revise
9. APPROVE → A.enqueue_order(PENDING)  // KHÔNG OrderSend
10. Executor claim → MT5 → Archive / FAILED
11. On success: PairState=NORMAL; WakeRequest C3
12. (Sau này đóng lệnh) submit_feedback / record_lesson
```

## 4. DEFER

C1/C2 — không enqueue.

## 5. Checklist plan

| Field | Ví dụ |
|-------|--------|
| direction | BUY |
| lot | 0.05 |
| context | UPTREND + narrative |
| signal | PUSH_DOWN, strength_final=0.72 |
| rule_refs | `UPTREND×PUSH_DOWN→OPEN_BUY` |

## 6. Sequence

```
Orch → A.wake → get_memory_pack
A → Plan → HV → B Ballot
alt APPROVE
  A → INSERT MarketOrderInfo PENDING
  Executor → OrderSend MT5
  Executor → Archive + ExecutionReport
  A → WakeRequest(C3)
else DEFER
  A → WakeRequest(C1|C2)
```

## 7. ExecutionReport

Executor (không phải A) phát sau MT5. FAILED → PairState giữ FLAT nếu chưa fill; alert; A có thể wake ngắn retry/re-eval.

Diagram: [A01](diagrams/A01-a2a-sequence.mmd), [A08](diagrams/A08-db-queue-flow.mmd).
