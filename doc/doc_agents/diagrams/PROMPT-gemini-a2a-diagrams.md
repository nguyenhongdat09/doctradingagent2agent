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
Đọc doc/doc_agents/06-entry-flow.md và 03-consensus-protocol.md.
Vẽ sequenceDiagram: Orchestrator wake → AgentA plan → HardValidator → AgentB ballot
→ challenge ≤2 → A OrderSend MT5 → WakeRequest C3 hoặc DEFER C1/C2.
Output ONLY sequenceDiagram.
```

Tham chiếu: [A01-a2a-sequence.mmd](A01-a2a-sequence.mmd)

## Prompt A02 — State

```
Đọc 03 + 11. stateDiagram-v2: SLEEPING, AUTO_CYCLE, BOSS_SESSION
với Executing_A, Deferring, BossACK, BossOverride, về SLEEPING.
BossWake từ SLEEPING và mid AUTO_CYCLE.
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
Đọc 07-dca-dual-review-loop.md. flowchart TD từ wake OPEN:
refresh lot → review → HardValidator → B ballot → exec/defer → wake C3 đến TotalLot=0.
Output ONLY flowchart TD.
```

Tham chiếu: [A04-dca-dual-review.mmd](A04-dca-dual-review.mmd)

## Prompt A05 — Boss interrupt

```
Đọc 11-boss-interrupt-flow.md. sequenceDiagram:
BossWake interrupts sleep → A/B wake → plan → HardPass → chat → BossACK
→ CONSENSUS_WITH_BOSS hoặc BOSS_OVERRIDE_EXEC → A OrderSend → WakeRequest → sleep.
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

## Checklist

- [ ] A01–A07 render trên Mermaid v10  
- [ ] A có OrderSend; B không  
- [ ] A06/A07 tách eyes / brain / rails  
- [ ] Push threshold 0.6 trên cạnh matrix  
 
