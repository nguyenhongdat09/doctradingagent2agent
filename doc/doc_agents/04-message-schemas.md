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

## 0b. DeltaMarketSnapshot (nạp cho các Micro Cycle tiếp nối — tiết kiệm Token)

```json
{
  "macro_cycle_id": "MC_AUDCAD_001",
  "micro_cycle_id": 2,
  "symbol": "AUDCAD",
  "active_plan_id": "uuid_plan_truoc",
  "current_bid": 0.8952,
  "current_ask": 0.8954,
  "elapsed_minutes": 30,
  "latest_bar": {"t": 1718000000, "o": 0.8945, "h": 0.8955, "l": 0.8942, "c": 0.8953, "v": 450},
  "trigger_check": {
    "hit_scenario": "NONE|UPSIDE|DOWNSIDE|INVALIDATION",
    "matched_condition": "string"
  },
  "basket": {
    "total_lot": 0.05,
    "orders": 1,
    "profit": 4.5,
    "state": "NORMAL"
  }
}
```

## 0c. MacroPlanTimelineMemory (Ký ức xuyên suốt các Plan đã thực hiện trong Macro Cycle)

```json
{
  "macro_cycle_id": "MC_AUDCAD_001",
  "symbol": "AUDCAD",
  "current_basket": {
    "orders": 1,
    "total_lot": 0.05,
    "basket_dir": "BUY",
    "avg_price": 0.8950,
    "floating_profit": 12.5
  },
  "plan_history_timeline": [
    {
      "plan_id": "PLAN_001",
      "micro_cycle_id": 1,
      "plan_status": "EXECUTED",
      "action_taken": "ENTRY BUY 0.05 lot @ 0.8950",
      "executed_at": "ISO-8601",
      "rationale": "D1 UPTREND, H1 ép giá chạm hỗ trợ EMA200 hãm lực nến rút râu."
    }
  ],
  "instruction": "Kế hoạch trước đã khớp lệnh xong. Hãy phân tích vị thế mới và lập PLAN CHỐT TIẾP THEO để quản lý vị thế (DCA ở đâu, TP ở đâu, Invalidation ở đâu)."
}
```

## 2. MarketAssessment (Agent B — độc lập)

```json
{
  "assessment_id": "uuid",
  "plan_id": "uuid|null",
  "symbol": "AUDCAD",
  "context_independent": "UPTREND|...",
  "signal_independent": "PUSH_DOWN|PUSH_UP|NEUTRAL|EXHAUSTION",
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
  "round": 1,
  "counter_plan": {
    "waiting_for": "string — BẮT BUỘC nếu decision != APPROVE (chờ nến H1 đóng, chờ giá hồi về đâu...)",
    "scenarios_override": {
      "UPSIDE": {"price_level": 0.0, "action": "ENTRY|DCA|TP|WAIT", "rationale": "string"},
      "DOWNSIDE": {"price_level": 0.0, "action": "ENTRY|DCA|TP|WAIT", "rationale": "string"}
    }
  }
}
```

## 3b. UnifiedContingencyPlan (Kế hoạch hành động thống nhất 2 đầu lưu vào DB)

```json
{
  "plan_id": "uuid",
  "macro_cycle_id": "string",
  "micro_cycle_id": 1,
  "created_at": "ISO-8601",
  "symbol": "AUDCAD",
  "plan_state": "PROVISIONAL|COMMITTED",
  "plan_status": "ACTIVE|EXECUTED|CANCELLED",
  "executed_at": "ISO-8601|null",
  "execution_notes": "string|null",
  "base_price": 0.8950,
  "context_trend": "UPTREND_PULLBACK|DOWNTREND_PULLBACK|SIDEWAY_BOUNDARY",
  "scenarios": {
    "UPSIDE": {
      "zone": "0.8980 - 0.9000",
      "approach_momentum": "WEAKENING|STRONG|EXHAUSTION",
      "trigger_condition": {
        "price_level": 0.8980,
        "candle_reaction": [
          "Nến H1 rút râu trên >= 40% thân nến",
          "HOẶC xuất hiện cụm nến đảo chiều đỏ (Bearish Engulfing)"
        ]
      },
      "action": "CLOSE_ALL|TAKE_PROFIT_ALL|TAKE_PROFIT_PARTIAL|OPEN_SELL",
      "params": {"close_ratio": 1.0, "reason": "EARLY_STALL_EXIT"},
      "rationale": "Chạm kháng cự hoặc xuất hiện nến cạn đà/đảo chiều, chốt sạch bảo toàn lãi"
    },
    "DOWNSIDE": {
      "zone": "0.8915 - 0.8925",
      "approach_momentum": "EXHAUSTION",
      "trigger_condition": {
        "price_level": 0.8920,
        "candle_reaction": [
          "Nến đỏ chạm hỗ trợ rút chân râu dưới dài",
          "Nến tiếp theo đóng xanh xác nhận đảo chiều"
        ]
      },
      "action": "DCA|OPEN_BUY",
      "params": {"lot": 0.1, "max_total_lot": 0.25},
      "rationale": "Test hỗ trợ EMA trong xu hướng tăng, lực xả cạn kiệt"
    },
    "INVALIDATION": {
      "trigger_condition": {
        "price_level": 0.8880,
        "candle_reaction": ["Nến H1 đóng cửa thủng hỗ trợ thân đặc"]
      },
      "action": "CLOSE_ALL",
      "params": {},
      "rationale": "Gãy cấu trúc sóng, cắt lỗ toàn bộ"
    },
    "STANDBY": {
      "trigger_condition": {
        "price_range": [0.8921, 0.8979],
        "description": "Giá trong vùng sideway chưa có nến hãm lực xác nhận"
      },
      "action": "WAIT",
      "params": {"next_wake_type": "H1_CLOSE"},
      "rationale": "Chưa chạm mốc hành động, giữ nguyên lệnh"
    }
  }
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
  "note": "string — xác nhận đã tham gia bàn; không thay B.APPROVE"
}
```

> **v1:** Không có `BossOverride`.

## 7. ExecutionReport (từ Executor sau MT5)

```json
{
  "exec_id": "uuid",
  "plan_id": "uuid",
  "queue_row_id": 123,
  "outcome_consensus": "CONSENSUS_AUTO|CONSENSUS_WITH_BOSS",
  "tickets": [123456],
  "fill_price": 0.91234,
  "status": "FILLED|REJECTED|PARTIAL|FAILED",
  "error": "string|null"
}
```

## 8. SystemFreeze & AlertLlmOutage (khi LLM không khả dụng)

### SystemFreezeEvent
```json
{
  "type": "SystemFreezeEvent",
  "freeze": true,
  "reason": "LLM_TIMEOUT|LLM_ERROR|LLM_RATE_LIMIT",
  "detail": "string — mô tả lỗi cụ thể",
  "positions_snapshot": {
    "AUDCAD": {"state":"NORMAL","total_lot":0.15,"dir":"BUY","profit":-8.50},
    "AUDNZD": {"state":"FLAT","total_lot":0,"dir":"NONE","profit":0}
  },
  "created_at": "ISO-8601"
}
```

### AlertLlmOutage (gửi Boss)
```json
{
  "type": "ALERT_LLM_OUTAGE",
  "severity": "CRITICAL",
  "message": "LLM API không khả dụng — hệ thống FREEZE. Boss can thiệp thủ công nếu cần.",
  "reason": "string",
  "positions_snapshot": {},
  "retry_count": 3,
  "last_error_at": "ISO-8601",
  "created_at": "ISO-8601"
}
```

Khi LLM khôi phục:
```json
{
  "type": "SystemFreezeEvent",
  "freeze": false,
  "reason": "LLM_RECOVERED",
  "detail": "LLM API khôi phục — auto-resume hoạt động bình thường",
  "created_at": "ISO-8601"
}
```

> **KHÔNG** có cơ chế auto-degrade về rule-only. **KHÔNG** có auto-flatten.
> Boss là bộ não dự phòng duy nhất khi FREEZE.

## 9. Validation rules (schema)

- `ReviewBallot.APPROVE` mà `counter_evidence` rỗng → `INVALID`.
- `lot` khớp ladder / BeginLot / PayoffPct.
- `action=ENTRY` / OPEN_* chỉ khi `pair_state=FLAT`.
- Enqueue chỉ sau HardPass ∧ B.APPROVE.
- **ALL-LLM:** MỌI action (kể cả DCA NORMAL, WAIT) phải qua A+B consensus. Engine KHÔNG tự enqueue.
- **SYSTEM_FREEZE:** Khi `freeze=true`, mọi enqueue bị chặn — chỉ Boss can thiệp thủ công.

## 10. UncertaintyEscalation (Agent A hoặc B → Orchestrator → Telegram → Boss)

> **Tính năng mới:** Agent chủ động hỏi Boss qua Telegram khi mơ hồ về phân tích.
> Agent A và B có quyền escalate **NGANG HÀNG**. Xem chi tiết: [15-uncertainty-escalation.md](15-uncertainty-escalation.md).

```json
{
  "type": "UncertaintyEscalation",
  "escalation_id": "uuid",
  "source_agent": "A|B",
  "symbol": "AUDCAD",
  "pair_state": "FLAT|NORMAL|RECOVERY",
  "uncertainty_score": 0.75,
  "category": "CONFLICTING_SIGNALS|MEMORY_CONFLICT|NEAR_RESISTANCE|UNUSUAL_PATTERN|RECOVERY_RISK",
  "context_summary": "string — tóm tắt tình huống tiếng Việt",
  "question": "string — câu hỏi cụ thể cho Boss, tiếng Việt",
  "analysis_so_far": {
    "proposed_action": "DCA|WAIT|CLOSE_ALL|RECOVERY_DCA|PAYOFF_REDUCE|ENTRY",
    "confidence": 0.45,
    "concerns": ["string"]
  },
  "snapshot_id": "uuid",
  "created_at": "ISO-8601",
  "timeout_at": "ISO-8601"
}
```

Categories:
- `CONFLICTING_SIGNALS`: D1 và H1 nói ngược nhau
- `MEMORY_CONFLICT`: MemoryPack có bài AVOID liên quan nhưng không chắc áp dụng
- `NEAR_RESISTANCE`: Gần vùng cản/hỗ trợ D1 mạnh
- `UNUSUAL_PATTERN`: Pattern bất thường chưa từng gặp
- `RECOVERY_RISK`: RECOVERY rủi ro cao, lot lớn

## 11. BossAdvisory (Boss → Telegram → Orchestrator → Agent)

```json
{
  "type": "BossAdvisory",
  "escalation_id": "uuid",
  "boss_response": "string — nguyên văn reply tiếng Việt của Boss (text tự do, chi tiết)",
  "is_late": false,
  "responded_at": "ISO-8601"
}
```

> Agent nhận `boss_response` như **một prompt chỉ đạo trực tiếp cấp cao** — inject vào context LLM cùng với snapshot và memory pack.
> **Ràng buộc tối cao:** Nếu Boss từ chối phân tích, bác bỏ đề xuất hoặc yêu cầu WAIT/HỦY/DỪNG, `boss_response` mang tính chất **Mệnh lệnh bắt buộc (Boss Directive)**. Cả Agent A và B bắt buộc phải tuân theo chỉ đạo của Boss, tuyệt đối KHÔNG được tự ý làm trái ý Boss.

> `is_late = true` khi Boss reply sau 30 phút timeout. Response vẫn được ghi nhận nhưng Agent đã tự quyết.

## 12. SelfResolutionNotice (Khi timeout — gửi Boss qua Telegram)

```json
{
  "type": "SelfResolutionNotice",
  "escalation_id": "uuid",
  "symbol": "AUDCAD",
  "self_resolution": "string — giải pháp Agent đã chọn",
  "reasoning": "string — lý do tự quyết",
  "plan_id": "uuid|null",
  "resolved_at": "ISO-8601"
}
```

> Khi Boss reply sau khi đã timeout, Agent gửi thông báo:
> "Do thời gian đợi quá lâu nên tôi đã tự quyết theo giải pháp [ABC]"
