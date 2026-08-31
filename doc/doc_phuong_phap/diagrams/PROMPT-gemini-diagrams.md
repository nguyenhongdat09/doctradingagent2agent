# PROMPT — Gemini Diagram Generation / Refinement

Dùng khi nhờ Gemini tạo lại / tinh chỉnh Mermaid từ `doc/doc_phuong_phap`.

## System constraints

```
CHỈ xuất Mermaid hợp lệ. Không code MQL5. Không giải thích dài.
- Không space trong node ID
- Nhãn đặc biệt bọc ""
- Điều kiện trên cạnh: HH+HL, BOS, K_S*ATR14, TotalLot>=R_TH…
- Context D1 = market STRUCTURE (swings) — KHÔNG ADX/EMA
- Không emoji
```

## Prompt D01 — Lifecycle

```
Đọc 01, 02-d1-context (structure), 03, 04, 05, 06.
flowchart TD: OnTick → H1 new bar → StructureEngine swings radius 3
→ RuleClassify + hysteresis → SAFETY_RAILS ContextFinal
→ H1 Signal K_S*ATR + breakout → FLAT/NORMAL/RECOVERY branches.
Params: SW_R=3, K_S=1.5, N_B=3, L0=0.05, TP=30, R_TH=0.3, S_MIN=15.
Output ONLY flowchart TD.
```

## Prompt D05 — D1 structure pipeline

```
Đọc 02-d1-context.md.
flowchart TD: D1 OHLC → EYES swing detect → features HH/HL/BOS/compress
→ RuleClassify + hysteresis → BRAIN LLM optional → SAFETY_RAILS → ContextFinal → Matrix.
Nhấn mạnh mắt deterministic vs não LLM; LLM không bịa swing.
Output ONLY flowchart TD.
```

Tham chiếu: [D05-d1-structure-pipeline.mmd](D05-d1-structure-pipeline.mmd)

## Prompt D02 / D03

Giữ như trước (state machine / recovery) — không đổi ADX.

## Prompt D04 — Data architecture

```
Đọc 09-data-sources.md.
flowchart LR: Bars D1/H1 → SwingDetect + ATR_D1/H1 → ContextRails + SignalEngine
→ Matrix/Spacing/Ladder → 4 pair states → Basket/Trade/Account.
KHÔNG vẽ ADX/EMA context.
Output ONLY flowchart LR.
```

## Prompt D06 — H1 strength pipeline

```
Đọc 03-h1-signal.md.
flowchart TD: H1 OHLC → 4 score components + disqualifiers
→ optional LLM → SAFETY_RAILS → strength_final>=0.6 → Decision Matrix.
Nhấn mạnh score backtestable; LLM chỉ interpret/veto.
Output ONLY flowchart TD.
```

Tham chiếu: [D06-h1-strength-pipeline.mmd](D06-h1-strength-pipeline.mmd)

## Checklist

- [ ] D01–D06 render Mermaid v10  
- [ ] Không ADX/EMA context; H1 dùng Strength Score không nhị phân thuần  
- [ ] D05/D06 có Eyes / Brain / Rails  
