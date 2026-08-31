# PROMPT — Gemini A2A Diagrams

Dùng khi nhờ Gemini tạo lại / sửa Mermaid cho `doc/doc_agents`.

## Constraints (luôn dán kèm)

```
CHỈ xuất mã Mermaid hợp lệ. Không giải thích dài. Không viết code.
- Không space trong node ID
- Nhãn có () : , → bọc trong ""
- Ghi điều kiện công thức trên cạnh (HardPass, B.APPROVE, ElapsedInH1>=30m, BossACK…)
- Không emoji
```

## Prompt A01 — Sequence AUTO

```
Đọc 06-entry-flow.md, 03-consensus-protocol.md, 13-experience-loop.md.
sequenceDiagram: wake → get_memory_pack → A plan → HV → B ballot
→ challenge ≤2 → A INSERT MarketOrderInfo PENDING → Executor claim OrderSend MT5
→ Archive/FAILED → WakeRequest C3 hoặc DEFER C1/C2.
Output ONLY sequenceDiagram.
```

Tham chiếu: [A01-a2a-sequence.mmd](A01-a2a-sequence.mmd)

## Prompt A02 — State

```
Đọc 03 + 11. stateDiagram-v2: SLEEPING, AUTO_CYCLE, BOSS_SESSION
Enqueueing (INSERT PENDING), Deferring; BOSS: B.APPROVE mới enqueue;
B dissent → DEFER (KHÔNG BossOverride).
Output ONLY stateDiagram-v2.
```

Tham chiếu: [A02-consensus-state.mmd](A02-consensus-state.mmd)

## Prompt A03 — Wake

```
Đọc 05-scheduler-wakeup.md. flowchart TD:
Wait timer|BossWake|Kill → cycle → FLAT C1/C2 (+30m / H1+30m) vs OPEN C3 dynamic clamp 3–60m → sleep.
BossWake priority over timer.
Output ONLY flowchart TD.
```

Tham chiếu: [A03-wakeup-and-monitor.mmd](A03-wakeup-and-monitor.mmd)

## Prompt A04 — DCA dual review

```
Đọc 07-dca-dual-review-loop.md. flowchart TD:
wake → memory pack → review → HV → B → A INSERT PENDING → Executor → wake C3 đến flat.
Output ONLY flowchart TD.
```

Tham chiếu: [A04-dca-dual-review.mmd](A04-dca-dual-review.mmd)

## Prompt A05 — Boss interrupt

```
Đọc 11-boss-interrupt-flow.md. sequenceDiagram:
BossWake → A/B → memory → plan → HV → chat → B.APPROVE → enqueue → Executor
OR B dissent → DEFER (no Override v1).
Output ONLY sequenceDiagram.
```

Tham chiếu: [A05-boss-interrupt.mmd](A05-boss-interrupt.mmd)

## Prompt A06 — D1 structure pipeline

```
Đọc doc/doc_agents/12-market-data-fetch.md và doc/doc_phuong_phap/02-d1-context.md.
flowchart TD: fetch D1 30 → eyes swings deterministic → fetch_more nếu thiếu
→ LLM brain narrative → SAFETY RAILS → ContextFinal → fetch H1 20-30 → plan/ballot.
Nhấn mạnh mắt ≠ não; LLM không bịa swing.
Output ONLY flowchart TD.
```

Tham chiếu: [A06-d1-context-pipeline.mmd](A06-d1-context-pipeline.mmd)

## Prompt A07 — H1 strength

```
Đọc doc_phuong_phap/03-h1-signal.md và doc_agents/12-market-data-fetch.md.
flowchart TD: fetch H1 → eyes strength score 4 components + DQ
→ LLM strength_final/verdict → rails → threshold 0.6 → matrix.
Score deterministic Phase1; LLM veto/EXHAUSTION Phase2.
Output ONLY flowchart TD.
```

Tham chiếu: [A07-h1-strength-pipeline.mmd](A07-h1-strength-pipeline.mmd)

## Prompt A08 — DB queue

```
Đọc doc_phuong_phap/10-sqlite-design.md và A08-db-queue-flow.mmd.
stateDiagram: PENDING → PROCESSING → ARCHIVED_DONE / FAILED / CANCELLED.
Agents chỉ INSERT PENDING; Executor claim OrderSend.
Output ONLY stateDiagram-v2.
```

## Checklist

- [ ] A01–A08 render Mermaid v10  
- [ ] A enqueue; Executor OrderSend; B không enqueue  
- [ ] Không BossOverride  
- [ ] get_memory_pack trước plan trên A01/E03  
 
