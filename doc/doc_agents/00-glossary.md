# 00 — Glossary (A2A)

## 1. Actors

| Thuật ngữ | Alias | Định nghĩa |
|-----------|-------|------------|
| Agent A | Planner-Executor | Phân tích chart, lập plan, tranh luận, **OrderSend** xuống sàn sau đủ điều kiện; set wake timer |
| Agent B | Independent Challenger | Đánh giá market độc lập; APPROVE / REJECT / CHALLENGE; cấm ba phải |
| Boss | Human operator (bạn) | Force-wake, hội thoại, BossACK / BossOverride; **không** OrderSend trong design chuẩn |
| Orchestrator | Python runtime | Timer sleep/wake, message bus, ingest BossWake; **không** quyết hướng lệnh |

## 2. Session & state

| Thuật ngữ | Nghĩa |
|-----------|--------|
| `session_mode` | `AUTO` (mặc định A↔B) \| `BOSS` (có Boss trong vòng) |
| `SLEEPING` | Đang chờ `next_wake_at` |
| `Cycle` | Một lần agents được đánh thức và chạy protocol đến sleep |
| `PairState` | FLAT / NORMAL / RECOVERY theo [doc_phuong_phap](../doc_phuong_phap/06-state-machine.md) |

## 3. Messages (xem chi tiết 04)

| Message | Ai gửi | Mục đích |
|---------|--------|----------|
| `TradePlan` | A | Kế hoạch entry/DCA/close chi tiết |
| `MarketAssessment` | B (và A có thể có bản riêng) | Nhận định market độc lập |
| `ReviewBallot` | B | Quyết định + luận điểm + counter_evidence |
| `ActionProposal` | A | Đề xuất action khi đã có vị thế |
| `DcaReview` | A | Review chart trước DCA (lệnh ≥ 2) |
| `WakeRequest` | A | Hẹn `next_wake_at` (+30m hoặc dynamic) |
| `BossWake` | Boss | Interrupt sleep, nâng `session_mode=BOSS` |
| `BossACK` | Boss | Xác nhận chốt plan trong BOSS mode |
| `MarketSnapshot` | Orch/A build | 30 D1 + 20–30 H1 + swings + features + basket + ATR_H1 |
| `StructureFeatures` | StructureEngine | swings≤6, BOS, HH/HL, range_compress — deterministic |

## 4. Ballot decisions

| Decision | Nghĩa |
|----------|--------|
| `APPROVE` | Đồng ý plan/action (có evidence) |
| `REJECT` | Từ chối; không execute |
| `CHALLENGE` | Yêu cầu A revise trong cùng cycle |
| `INVALID` | Ballot thiếu field bắt buộc → không count |

## 5. Consensus outcomes

| Outcome | Điều kiện rút gọn |
|---------|-------------------|
| `CONSENSUS_AUTO` | `session_mode=AUTO` ∧ B.APPROVE ∧ HardPass ∧ (A sẵn sàng execute) |
| `CONSENSUS_WITH_BOSS` | `BOSS` ∧ BossACK ∧ B.APPROVE ∧ HardPass |
| `BOSS_OVERRIDE_EXEC` | `BOSS` ∧ BossACK ∧ BossOverride ∧ HardPass ∧ B ≠ APPROVE |
| `DEFER` | Chưa đồng thuận → áp case C1–C4 + sleep |

## 6. Wake cases (C1–C4)

| Case | Điều kiện | `next_wake` |
|------|-----------|-------------|
| C1 | FLAT ∧ ElapsedInH1 ≥ 30m | `now + 30m` |
| C2 | FLAT ∧ ElapsedInH1 &lt; 30m | `H1_open + 30m` |
| C3 | Có lệnh (NORMAL/RECOVERY) | A chọn dynamic ∈ [WakeMin, WakeMax] |
| C4 | Trong cycle còn lượt revise | Tiếp debate (≤ 2 vòng); hết → C1/C2/C3 |

## 7. Hard validation

`HardValidator(plan)` = kiểm tra plan có khớp [doc_phuong_phap](../doc_phuong_phap/) (context matrix, signal, spacing, ladder, RECOVERY cấm mở ngược, v.v.). **FAIL → không được OrderSend** kể cả BossOverride (trừ flag experimental `BOSS_FORCE` mặc định tắt).

## 8. Ký hiệu thời gian

```
ElapsedInH1 = now - Time_H1_open(current_bar)
WakeMin, WakeMax   // default gợi ý 3m .. 60m khi OPEN
H1_mid_mark        // H1_open + 30 minutes
```
