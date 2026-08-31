# 07 — DCA Dual-Review Loop

## 1. Quy tắc cứng

- **Lệnh đầu (ENTRY):** flow [06](06-entry-flow.md).
- **Từ lệnh thứ 2 trở đi** (mọi DCA / RECOVERY_DCA / PAYOFF / CLOSE material):  
  Agent A **bắt buộc** review chart → gửi `DcaReview`/`ActionProposal` → **B đối thẩm** → đồng thuận mới được A execute.

Không được DCA “câm” chỉ vì spacing đủ nếu chưa có consensus (AUTO) hoặc Boss path.

## 2. Trigger cycle khi đang có lệnh

```
Wake (C3 dynamic hoặc BossWake)
A refresh positions → TotalLot, BasketDir, AdverseRef, BasketProfit, PairState
A đánh giá:
  - spacing đủ adverse?
  - FavorableSqueeze + BasketTp (NORMAL)?
  - RECOVERY adverse/favorable squeeze?
A chọn proposed_action ∈ {DCA, CLOSE_ALL, RECOVERY_DCA, PAYOFF_REDUCE, WAIT}
```

## 3. Dual review protocol

```
A publishes DcaReview
HardValidator(proposal)   // spacing, ladder lot, RECOVERY cấm ngược hướng, ...
B independent ballot
C4 debate ≤ 2 rounds nếu CHALLENGE
if CONSENSUS_AUTO (or Boss path):
    A execute (OrderSend / Partial Close / Close All)
    A emits ExecutionReport → Orchestrator logs audit & updates PairState
    A set dynamic wake C3
else:
    DEFER → C3 dynamic wake (A tự set theo chart)
```

## 4. Nội dung DcaReview tối thiểu

| Mục | Bắt buộc |
|-----|----------|
| Chart review (H1/D1 ngắn) | Có |
| TotalLot, LadderStep tiếp theo | Có |
| Spacing vs adverse distance | Có nếu DCA |
| Rule ref phuong_phap | Có |
| Lý do WAIT nếu không action | Có |

## 5. Vòng lặp đến FLAT

```
while TotalLot > 0:
  wake → dual review → maybe execute → A set dynamic wake
when TotalLot == 0:
  PairState = FLAT
  A set wake C1/C2
```

Khớp RECOVERY “chỉ dừng khi sạch” ở tầng phương pháp; tầng A2A thêm lớp đồng thuận mỗi action.

## 6. Ví dụ

```
NORMAL Buy TotalLot=0.15, giá chạm spacing
A: đề xuất DCA 0.20 + thesis
B: counter_evidence (vừa down-BOS / tin tức) → CHALLENGE
A revise lot hoặc WAIT
B APPROVE WAIT → không DCA; A set wake 10m (volatile)
---
B APPROVE DCA → A OrderSend 0.20
Nếu TotalLot>=0.3 → state RECOVERY (phuong_phap) + alert trong log A2A
```

Diagram: [diagrams/A04-dca-dual-review.mmd](diagrams/A04-dca-dual-review.mmd).
