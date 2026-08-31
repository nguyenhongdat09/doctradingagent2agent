# 02 — Agent Roles

## 1. Agent A — Planner-Executor

### Trách nhiệm
- **Tự fetch** D1 rồi H1 theo [12-market-data-fetch.md](12-market-data-fetch.md); thiếu thì `fetch_more`.
- Nhận swing/features **deterministic** — không bịa pivot; diễn giải cấu trúc như trader (LLM).
- Soạn `TradePlan` / `ActionProposal` / `DcaReview` đủ chi tiết (symbol, hướng, lot, lý do, rule refs).
- Tranh luận với B (revise ≤ 2 vòng/cycle khi CHALLENGE).
- Trong `BOSS` mode: tiếp nhận ý Boss, giải thích plan bằng ngôn ngữ rõ.
- **Sau đủ điều kiện consensus → tự gọi tool OrderSend / partial close.**
- Sau mỗi cycle: `WakeRequest` theo C1–C3; theo dõi PnL để chọn dynamic timer khi có lệnh.

### Không được
- OrderSend khi thiếu B.APPROVE ở `AUTO`.
- OrderSend khi `BOSS` thiếu BossACK.
- Bỏ qua `HardValidator` / SAFETY RAILS.
- Tự invent swing points.
- Set wake ngoài biên `[WakeMin, WakeMax]` khi OPEN (trừ C1/C2 cố định +30m).

## 2. Agent B — Independent Challenger

### Trách nhiệm
- Tự fetch snapshot/features (hoặc dùng raw cache) và **tự diễn giải** cấu trúc D1 — không copy A.
- Trả `ReviewBallot` với đủ: thesis, counter_evidence, agree_points, dissent_points, decision.
- Có thể CHALLENGE khi LLM A confidence thấp / narrative lệch rails.
- Trong BOSS mode: phản biện cả gợi ý Boss nếu trái structure data.

### Không được
- APPROVE không có `counter_evidence`.
- Đồng ý chỉ vì “Boss bảo vậy” hoặc paraphrase A (sycophancy).
- Tự OrderSend.

### Anti-sycophancy checks (orchestrator/heuristic)
```
Ballot INVALID nếu:
  - thiếu counter_evidence, OR
  - similarity(text_B, text_A) > Threshold (gợi ý 0.85), OR
  - decision=APPROVE nhưng dissent_points rỗng và không nêu rủi ro residual
```

## 3. Boss — Human (bạn)

### Trách nhiệm
- Gửi `BossWake` + intent khi thấy market ok / cần bàn gấp.
- Hội thoại với A/B; `BossACK` khi chốt.
- `BossOverride` chỉ khi B không APPROVE nhưng Boss vẫn muốn execute (bắt buộc `reason`).
- Emergency kill / flatten qua kênh out-of-band (xem 10).

### Không được (design chuẩn)
- Gọi trực tiếp OrderSend (tránh lệch audit; mọi lệnh đi qua A).
- Ép HardValidator FAIL trở thành PASS (trừ experimental `BOSS_FORCE`, mặc định OFF).

## 4. Orchestrator — Python

### Trách nhiệm
- `sleep_until(next_wake_at)`; hủy khi BossWake.
- Định tuyến message A↔B↔Boss.
- Gắn `session_mode`, đếm debate rounds, ghi audit log.
- Cung cấp tool surface cho A (market data, positions, OrderSend wrapper).

### Không được
- Tự chọn BUY/SELL/DCA.
- Auto-approve thay B.

## 5. Ma trận RACI (rút gọn)

| Việc | A | B | Boss | Orch |
|------|---|---|------|------|
| Quan sát / fetch nến | R | R | C | I (tools) |
| Structure eyes (deterministic) | I | I | — | R (engine) |
| Diễn giải context LLM | R | R | C | I |
| Draft plan | R | C | C (BOSS) | I |
| Ballot | C | R | I | I |
| ACK / Override | I | I | R (BOSS) | I |
| OrderSend | R | — | — | I (tool host) |
| Set wake | R | — | C | R (fire timer) |
| Hard validate | R/I | I | I | R (gate) |
