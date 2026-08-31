# 09 — Data Sources & Architecture

## 1. Tổng quan luồng dữ liệu

```
Bars(D1,H1)
  → StructureEngine (swings, BOS, range_compress)   // mắt deterministic
  → [optional LLM interpret] → SAFETY_RAILS → Context
  → SignalEngine (H1 ATR breakout)
  → Decision / StateMachine
  → PositionManager ↔ AccountInfo
       ↑
  Inputs / KillSwitch / Snapshot(for A2A)
       ↓
  Alerts / Logs
```

Diagram: [D04-data-architecture.mmd](diagrams/D04-data-architecture.mmd), [D05-d1-structure-pipeline.mmd](diagrams/D05-d1-structure-pipeline.mmd).

## 2. Nến (Bars)

| Nguồn | Shift / count | Mục đích |
|-------|---------------|----------|
| D1 rates | closed only; tối thiểu đủ pivot confirm; snapshot **30** OHLC mới nhất cho LLM | Structure + context |
| H1 rates | **1** + 2..1+N_B; snapshot **20–30** OHLC | Signal + LLM |
| New bar H1 | `iTime(H1,0)` đổi | Trigger cycle |

**Cấm:** OHLC `shift=0` cho quyết định / swing confirm.

## 3. Chỉ báo & cấu trúc

| Thành phần | TF | Vai trò |
|------------|-----|---------|
| Swing PH/PL radius 3 | D1 | Mắt — deterministic |
| HH/HL/LH/LL, BOS, range_compress | D1 | Features cấu trúc |
| ATR14 | D1 | Đo nén / BOS strength — **không** tự phân context |
| ATR14 | H1 | Signal body + spacing |
| RSI14 | H1 | Optional signal filter |
| ~~ADX / EMA context~~ | — | **Đã loại bỏ** |

## 4. Engines

| Module | Input | Output | Persist |
|--------|-------|--------|---------|
| `StructureEngine` | D1 OHLC closed | swings≤6, features | last swings |
| `SignalEngine` / Strength | H1 OHLC, ATR, swings H1, Context D1 | score, components, DQ, (LLM) verdict | — |
| `ContextRails` | features + PrevContext (+ LLM optional) | `ContextFinal` | `PrevContext` |
| `SnapshotBuilder` | bars + features + basket | `MarketSnapshot` (A2A) | — |

## 5–8. Account / Positions / Config / Alerts

Giữ như trước (account margin, magic filter, inputs, recovery alerts). Persist thêm: swing list, `PrevContext`, `last_BOS`.

## 9. Data → Decision

| Dữ liệu | Check | Ảnh hưởng |
|---------|-------|-----------|
| D1 structure + rails | ContextFinal | Matrix FLAT |
| H1 body/ATR/breakout | Signal | Matrix / TP / Recovery |
| TotalLot vs R_TH | state | NORMAL/RECOVERY |
| Spacing vs AdverseRef | DCA | |
| BasketProfit vs TpMoney | CLOSE_ALL | |
| KillSwitch | gate | |

## 10. Đa cặp

Duyệt tuần tự 4 symbol khi H1 new bar (như trước).
