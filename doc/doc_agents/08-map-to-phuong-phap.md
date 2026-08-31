# 08 — Map A2A ↔ Phương pháp DCA

Tham chiếu: [`../doc_phuong_phap/`](../doc_phuong_phap/), [`../doc_experience/`](../doc_experience/).

## 1. Ai làm gì

| Rule | A | B | HardValidator | Executor |
|------|---|---|---------------|----------|
| D1 structure + rails | Diễn giải | Độc lập | Enforce | — |
| H1 Strength / PUSH≥0.6 | Diễn giải | Độc lập | Enforce | — |
| Matrix / spacing / RECOVERY | Đề xuất | Phản biện | 5 checks | — |
| MemoryPack | get trước plan | get trước ballot | optional EnforceTopLessons | — |
| Enqueue | **R** | — | Gate | — |
| OrderSend MT5 | — | — | — | **R** |

## 2. Action → PairState

| A2A / queue action | Điều kiện | State sau |
|--------------------|-----------|-----------|
| OPEN_BUY / OPEN_SELL (ENTRY) | FLAT + matrix | NORMAL |
| DCA | NORMAL + spacing | NORMAL hoặc RECOVERY nếu ≥R_TH |
| CLOSE_ALL | Favorable PUSH≥0.6 + TpMoney | FLAT |
| RECOVERY_DCA | RECOVERY + Adverse PUSH≥0.6 | RECOVERY |
| PAYOFF_REDUCE / PARTIAL_CLOSE | RECOVERY favorable | RECOVERY hoặc FLAT |
| WAIT | — | không đổi |

`ENTER_RECOVERY` / `EXIT_TO_FLAT` = transition nội bộ theo TotalLot ([phuong glossary](../doc_phuong_phap/00-glossary.md)).

## 3. Enum chuẩn

Xem [00-glossary.md](00-glossary.md) §7 — thống nhất `OPEN_*`, `DCA`, `RECOVERY_DCA`, `PAYOFF_REDUCE`, `CLOSE_ALL`, `PARTIAL_CLOSE`, `WAIT`.

## 4. Kill-switch

→ không enqueue mới; optional flatten qua queue CLOSE_ALL.
