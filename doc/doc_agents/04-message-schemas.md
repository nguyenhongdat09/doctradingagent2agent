# 04 — Message Schemas

Schema logic (JSON-like). Implement sau có thể dùng Pydantic / typed dict.

## 0. MarketSnapshot (gửi LLM mỗi phân tích)

```json
{
  "symbol": "AUDCAD",
  "d1_ohlc_closed": [{"t":0,"o":0,"h":0,"l":0,"c":0}],
  "d1_count": 30,
  "h1_ohlc_closed": [],
  "h1_count": 30,
  "swings": [{"type":"PH","price":0,"time":"ISO","bar_index":0}],
  "structure": {
    "hh_hl_lh_ll": "HH+HL|LH+LL|mixed",
    "last_bos": {"dir":"up|down|none","time":"ISO"},
    "range_compress": 1.2,
    "atr14_d1": 0.001
  },
  "basket": {
    "dir":"NONE","total_lot":0,"orders":0,"profit":0,"state":"FLAT"
  },
  "atr14_h1": 0.0005,
  "h1_strength": {
    "score": 0.0,
    "components": {},
    "disqualifiers": []
  },
  "news": null
}
```

## 1. TradePlan (Agent A)

```json
{
  "plan_id": "uuid",
  "symbol": "AUDCAD",
  "created_at": "ISO-8601",
  "pair_state": "FLAT|NORMAL|RECOVERY",
  "action": "ENTRY|DCA|CLOSE_ALL|RECOVERY_DCA|PAYOFF_REDUCE|WAIT",
  "direction": "BUY|SELL|NONE",
  "lot": 0.05,
  "ladder_step": 0,
  "entry_style": "MARKET",
  "context": {
    "d1": "UPTREND|DOWNTREND|SIDEWAY",
    "confidence": 0.8,
    "narrative": "string trader-style",
    "rule_context": "UPTREND|DOWNTREND|SIDEWAY",
    "source": "rails_clamped"
  },
  "signal": {
    "verdict": "PUSH_UP|PUSH_DOWN|NEUTRAL|EXHAUSTION",
    "strength_score": 0.72,
    "strength_final": 0.68,
    "components": {"mom":0.35,"str":0.25,"loc":0.1,"conf":0.05},
    "disqualifiers": [],
    "narrative": "string"
  },
  "rule_refs": ["structure:HH+HL", "matrix:UPTREND×PUSH_DOWN→BUY"],
  "thesis": "string",
  "risks": ["string"],
  "invalidation": "string",
  "session_mode": "AUTO|BOSS",
  "snapshot_id": "uuid"
}
```

## 2. MarketAssessment (Agent B — độc lập)

```json
{
  "assessment_id": "uuid",
  "plan_id": "uuid|null",
  "symbol": "AUDCAD",
  "context_independent": "UPTREND|...",
  "signal_independent": "STRONG_DOWN|...",
  "thesis": "string",
  "market_notes": "string"
}
```

## 3. ReviewBallot (Agent B)

```json
{
  "ballot_id": "uuid",
  "plan_id": "uuid",
  "decision": "APPROVE|REJECT|CHALLENGE|INVALID",
  "thesis": "string",
  "counter_evidence": "string — BẮT BUỘC nếu muốn APPROVE hợp lệ",
  "agree_points": ["..."],
  "dissent_points": ["..."],
  "requested_changes": ["..."],
  "round": 1
}
```

## 4. DcaReview / ActionProposal (Agent A, lệnh ≥ 2)

```json
{
  "review_id": "uuid",
  "symbol": "AUDCAD",
  "pair_state": "NORMAL|RECOVERY",
  "total_lot": 0.15,
  "basket_dir": "BUY",
  "basket_profit": -12.5,
  "spacing_pips": 18,
  "adverse_distance_pips": 19,
  "proposed_action": "DCA|WAIT|CLOSE_ALL|RECOVERY_DCA|PAYOFF_REDUCE",
  "proposed_lot": 0.20,
  "chart_review": "string",
  "rule_refs": ["..."]
}
```

## 5. WakeRequest (Agent A)

> **Lưu ý:** Case **C4** (debate tiếp trong cycle) không phát sinh `WakeRequest` vì agents tiếp tục phản biện ngay mà không vào trạng thái SLEEPING.

```json
{
  "wake_id": "uuid",
  "symbol": "AUDCAD|ALL",
  "case": "C1|C2|C3|POST_EXEC|BOSS_EXIT",
  "next_wake_at": "ISO-8601",
  "interval_seconds": 1800,
  "reason": "H1_elapsed_ge_30m|dynamic_volatile|..."
}
```

## 6. Boss messages

### BossWake
```json
{
  "type": "BossWake",
  "boss_id": "boss",
  "intent": "string — ví dụ market AUDCAD ok xem Buy",
  "symbols": ["AUDCAD"],
  "priority": "HIGH",
  "created_at": "ISO-8601"
}
```

### BossACK
```json
{
  "type": "BossACK",
  "plan_id": "uuid",
  "approved": true,
  "note": "string"
}
```

### BossOverride
```json
{
  "type": "BossOverride",
  "plan_id": "uuid",
  "reason": "string — BẮT BUỘC non-empty",
  "acknowledge_b_dissent": true
}
```

## 7. ExecutionReport (sau OrderSend của A)

```json
{
  "exec_id": "uuid",
  "plan_id": "uuid",
  "outcome_consensus": "CONSENSUS_AUTO|CONSENSUS_WITH_BOSS|BOSS_OVERRIDE_EXEC",
  "tickets": [123456],
  "fill_price": 0.91234,
  "status": "FILLED|REJECTED|PARTIAL",
  "error": "string|null"
}
```

## 8. Validation rules (schema)

- `ReviewBallot.APPROVE` mà `counter_evidence` rỗng → ép `INVALID`.
- `BossOverride.reason` rỗng → bỏ qua Override.
- `lot` phải khớp ladder / BeginLot / PayoffPct theo phuong_phap.
- `action=ENTRY` chỉ khi `pair_state=FLAT` (sau refresh).
