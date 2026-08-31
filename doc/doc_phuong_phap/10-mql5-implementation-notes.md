# 10 — MQL5 Implementation Notes (Pre-Code)

> **Không chứa code production.** Chỉ ghi chú kiến trúc để phase implement sau khi user duyệt diagram.

## 1. Đề xuất cấu trúc file (tương lai)

```
Experts/DcaTrendAgent/
  DcaTrendAgent.mq5
  Include/
    DcaTypes.mqh
    DcaParams.mqh
    StructureEngine.mqh      // swings radius 3, BOS, range_compress
    ContextRails.mqh         // rule classify + hysteresis (+ LLM hook later)
    SignalEngine.mqh
    DecisionMatrix.mqh
    SpacingCalc.mqh
    LotLadder.mqh
    PairStateMachine.mqh
    RecoveryEngine.mqh
    PositionBasket.mqh
    SnapshotBuilder.mqh      // optional export for A2A
    TradeGateway.mqh
    AlertService.mqh
    PersistState.mqh
```

## 2. Vòng đời runtime

```
OnInit:
  validate inputs
  create indicator handles per symbol
  restore PrevContext/State nếu có
  set timer optional

OnTick:
  if KillFlatten requested → flatten all → return
  for each symbol:
    if IsNewH1Bar(symbol):
      PairAgent.OnH1Close(symbol)

OnDeinit:
  release handles
  persist state
```

## 3. Phát hiện nến H1 mới

```
static datetime last_h1[4]
now = iTime(symbol, PERIOD_H1, 0)
if now != last_h1[i]:
  last_h1[i] = now
  → fire OnH1Close   // xử lý trên bar vừa đóng = shift 1
```

## 4. Trade Gateway checklist

- `CTrade` với magic per symbol
- Deviation / filling mode theo symbol
- Retry nhẹ khi requote (giới hạn lần)
- Mọi volume qua `NormalizeDouble` / volume step
- Comment: `DCA|{SYM}|{STATE}|S{step}`

## 5. Backtest Strategy Tester (phase sau)

| Hạng mục | Gợi ý |
|----------|-------|
| Model | Every tick dựa trên real ticks nếu có |
| Symbols | Chạy lần lượt 4 cặp hoặc multi-symbol nếu build hỗ trợ |
| Period | ≥ 2–3 năm H1 để có đủ D1 context |
| Spread | Theo symbol thực tế |
| Optimization | Không tối ưu max DD stop (không tồn tại); có thể tối ưu K_S, N_B, spacing |

## 6. Acceptance criteria trước khi live

1. Không quyết định trên shift 0; pivot chỉ confirm sau đủ nến sau (unit test / log).  
2. Hysteresis structure: giữ PrevContext trừ khi 2 swing cùng dấu hoặc strong BOS.  
3. Matrix đúng 6 ô hành động.  
4. NORMAL → RECOVERY khi TotalLot ≥ 0.3.  
5. RECOVERY không mở ngược hướng; không về NORMAL giữa chừng.  
6. Kill-switch dừng open mới.  
7. Alert enter/exit recovery.  
8. LLM (nếu bật) không được invent swing; rails clamp ContextFinal.

## 7. Thứ tự implement đề xuất

1. Skeleton EA + 4 symbols + new-bar  
2. StructureEngine (swings) + ContextRails + Signal + Matrix (FLAT entry only)  
3. NORMAL DCA + basket TP  
4. RECOVERY DCA + payoff reduce  
5. Global lock + cooldown + alerts  
6. Persist state + panel  

## 8. Liên kết spec

| Module | Spec |
|--------|------|
| Context / Structure | [02-d1-context.md](02-d1-context.md) — StructureEngine + ContextRails |
| Signal | [03-h1-signal.md](03-h1-signal.md) |
| Matrix | [04-decision-matrix.md](04-decision-matrix.md) |
| Capital | [05-capital-dca.md](05-capital-dca.md) |
| States | [06-state-machine.md](06-state-machine.md) |
| Recovery | [07-recovery-loop.md](07-recovery-loop.md) |
| Params | [08-parameters.md](08-parameters.md) |
| Data | [09-data-sources.md](09-data-sources.md) |
