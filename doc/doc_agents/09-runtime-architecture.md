# 09 — Runtime Architecture

## 1. Thành phần

```
┌─────────────┐   BossWake/ACK    ┌──────────────────┐
│ Boss Channel│──────────────────►│ Orchestrator     │
│ CLI/Chat/API│                   │ - scheduler      │
└─────────────┘                   │ - message bus    │
                                  │ - audit log      │
                                  │ - session_mode   │
                                  └────────┬─────────┘
                         wake/msgs         │
                ┌──────────────────────────┼──────────────────────────┐
                ▼                          ▼                          ▼
         ┌────────────┐             ┌────────────┐             ┌────────────┐
         │  Agent A   │◄──debate───►│  Agent B   │             │HardValidator│
         │ LLM+tools  │             │ LLM+tools  │             │ rules eng.  │
         └─────┬──────┘             └────────────┘             └──────▲─────┘
               │ OrderSend tools                                      │
               ▼                                                      │
         ┌────────────┐          market/positions ────────────────────┘
         │ MT5 Adapter│
         └────────────┘
```

## 2. Orchestrator (Python) — trách nhiệm hẹp

- Sleep / wake / Boss interrupt.
- Pub-sub message giữa A, B, Boss.
- Gọi HardValidator trước khi cho phép tool OrderSend của A (defense in depth).
- Persist: PairState, PrevContext, next_wake_at, audit JSONL.

**Không:** tự sinh hướng lệnh.

## 3. Tools Agent A được dùng

| Tool | Mục đích |
|------|----------|
| `fetch_bars` / `fetch_more` | OHLC D1/H1 — xem [12](12-market-data-fetch.md) |
| `get_structure_features` | Swings/BOS deterministic |
| `build_market_snapshot` | Gói snapshot LLM |
| `get_h1_strength_score` | Score + components + DQ |
| `fetch_indicators` | ATR… |
| `get_positions(symbol)` | rổ lệnh |
| `get_account()` | margin/equity |
| `hard_validate(plan)` | pre-check rails + matrix |
| `order_send(...)` | MARKET / close — **chỉ sau consensus gate** |
| `set_wake(next_wake_at, case)` | scheduler |

Agent B: tools đọc market/positions/validate — **không** `order_send`.

## 4. Boss channel ingest (design)

Một trong các cách (phase implement chọn):

- CLI: `python -m orch boss-wake --symbol AUDCAD --msg "..."`  
- File drop: `inbox/boss_wake.json`  
- Chat API / Telegram bot → Orchestrator  

## 5. Multi-symbol

4 PairAgent logical; có thể tuần tự trong một wake global hoặc wake per symbol. Doc khuyến nghị: **per-symbol `next_wake_at`** để C3 độc lập.

## 6. Audit store

```
logs/audit.jsonl
logs/plans/{plan_id}.json
logs/ballots/{ballot_id}.json
```

## 7. Failure handling

| Lỗi | Xử lý |
|-----|--------|
| OrderSend reject | ExecutionReport fail; A thông báo B/Boss; set wake ngắn C3 |
| LLM timeout | retry 1; rồi DEFER + wake |
| MT5 disconnect | không consensus exec; alert Boss channel |
