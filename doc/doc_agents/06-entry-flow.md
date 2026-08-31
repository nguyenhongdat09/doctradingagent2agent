# 06 — Entry Flow (Lệnh đầu)

## 1. Mục tiêu

Từ **FLAT**, sau khi agents đồng thuận, **Agent A** gửi lệnh MARKET BeginLot xuống sàn → chuyển **NORMAL**.

## 2. Preconditions

```
PairState == FLAT
TotalLot == 0
¬KillSwitch
HardValidator sẽ check: Context×Signal ∈ matrix OPEN_* (doc_phuong_phap 04)
```

## 3. Flow AUTO

```
1. Wake (timer C1/C2 hoặc Boss — nếu Boss thì xem 11)
2. A: MDA — fetch D1 → structure features → LLM+rails ContextFinal
   → fetch H1 (+ATR) → fetch_more nếu cần (xem 12)
3. A: H1 Strength Score + rails → MatrixAction (PUSH ≥ 0.6) → nếu WAIT: WakeRequest C1/C2 → sleep
4. A: draft TradePlan(action=ENTRY, lot=L0=0.05, direction=..., strength_final, narrative)
5. HardValidator(plan) — fail → sửa hoặc WAIT + wake
6. B: tự đọc snapshot/features + MarketAssessment độc lập + ReviewBallot
7. Nếu CHALLENGE and round < 2: A revise → lại B
8. Nếu APPROVE: CONSENSUS_AUTO → A.OrderSend(MARKET)
9. On fill: PairState=NORMAL, BasketDir=..., LadderStep=0
10. A: WakeRequest dynamic (C3) vì đã có lệnh
```

## 4. Flow khi DEFER (A≠B)

Áp [03-consensus-protocol](03-consensus-protocol.md) C1/C2 — **không** OrderSend.

## 5. Checklist plan ENTRY (A phải điền)

| Field | Ví dụ |
|-------|--------|
| symbol | AUDCAD |
| direction | BUY |
| lot | 0.05 |
| context + structure | UPTREND, narrative, confidence |
| signal | PUSH_DOWN, strength_final=0.72 |
| rule_refs | `UPTREND×STRONG_DOWN→OPEN_BUY` |
| invalidation | Context flip + … |

## 6. Sequence rút gọn & ExecutionReport

```
Orch → A.wake
A → Plan
A → HardValidator
B → Ballot
alt APPROVE
  A → MT5 OrderSend
  MT5 Adapter → A (Order Result)
  A → Orchestrator / MessageBus: ExecutionReport (status, tickets, fill_price)
  Orchestrator → Log Audit & notify Agent B (và Boss nếu session_mode=BOSS)
  A → WakeRequest(C3)
else CHALLENGE
  A revise (≤2)
else DEFER
  A → WakeRequest(C1|C2)
```

## 7. Xử lý ExecutionReport

1. **Sau khi MT5 trả về kết quả:** Agent A phát hành `ExecutionReport`.
2. **Orchestrator:**
   - Cập nhật `PairState = NORMAL` (nếu fill thành công).
   - Ghi nhận `tickets`, `fill_price` vào `logs/audit.jsonl`.
   - Chuyển `ExecutionReport` tới Agent B (để đồng bộ nhận thức vị thế) và kênh Boss (nếu đang trong BOSS mode).
3. **Nếu OrderSend thất bại:** Orchestrator giữ `PairState = FLAT`, ghi lỗi vào audit log, và Agent A gửi `WakeRequest` chu kỳ ngắn để retry/re-evaluate.

Diagram đầy đủ: [diagrams/A01-a2a-sequence.mmd](diagrams/A01-a2a-sequence.mmd).
