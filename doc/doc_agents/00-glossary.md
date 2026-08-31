# 00 — Glossary (A2A)

## 1. Actors

| Thuật ngữ | Định nghĩa |
|-----------|------------|
| Agent A | Planner — lập plan, enqueue `MarketOrderInfo`; **không** OrderSend |
| Agent B | Independent Challenger — ballot độc lập |
| Boss | Human — BossWake + bàn luận; **v1 không Override** |
| Orchestrator | Timer, bus, HardValidator gate |
| Executor Thread | Claim queue → MT5 OrderSend/Close → Archive/FAILED |

## 2. Session

| Thuật ngữ | Nghĩa |
|-----------|--------|
| `session_mode` | `AUTO` \| `BOSS` |
| `SLEEPING` | Chờ `next_wake_at` |
| PairState | FLAT / NORMAL / RECOVERY ([phuong_phap](../doc_phuong_phap/06-state-machine.md)) |

## 3. Messages

| Message | Ai | Mục đích |
|---------|-----|----------|
| `TradePlan` / `DcaReview` | A | Đề xuất action |
| `MarketAssessment` / `ReviewBallot` | B | Đối thẩm |
| `WakeRequest` | A | Hẹn thức |
| `BossWake` / `BossACK` | Boss | Interrupt / xác nhận đã bàn |
| `ExecutionReport` | Executor | Kết quả sau MT5 |

**Không còn (v1):** `BossOverride`, `BOSS_OVERRIDE_EXEC`, `BOSS_FORCE`.

## 4. Consensus outcomes

| Outcome | Điều kiện |
|---------|-----------|
| `CONSENSUS_AUTO` | AUTO ∧ HardPass ∧ B.APPROVE → enqueue |
| `CONSENSUS_WITH_BOSS` | BOSS ∧ HardPass ∧ B.APPROVE → enqueue |
| `DEFER` | Không đồng thuận → C1–C4 |

## 5. Wake C1–C4

| Case | `next_wake` |
|------|-------------|
| C1 FLAT ∧ ElapsedInH1≥30m | now+30m |
| C2 FLAT ∧ ElapsedInH1&lt;30m | H1_open+30m |
| C3 OPEN | A dynamic ∈ [WakeMin, WakeMax] |
| C4 | Debate trong cycle (≤2) |

## 6. HardValidator

FAIL → không enqueue. Gồm 5 checks (matrix, spacing/ladder, RECOVERY no reverse, NormalizeLot, kill-switch).

## 7. Action enum (chuẩn chung)

| Canonical | Nghĩa | Queue `action` gợi ý |
|-----------|-------|----------------------|
| `OPEN_BUY` / `OPEN_SELL` | ENTRY theo hướng | `OPEN` + direction |
| `DCA` | Nhồi cùng hướng NORMAL | `DCA` |
| `RECOVERY_DCA` | Nhồi trong RECOVERY | `RECOVERY_DCA` hoặc `DCA` |
| `PAYOFF_REDUCE` | Payoff + cắt lỗ | `PAYOFF` / `PARTIAL_CLOSE` |
| `CLOSE_ALL` | Đóng cả rổ | `CLOSE_ALL` |
| `PARTIAL_CLOSE` | Đóng một phần | `PARTIAL_CLOSE` |
| `WAIT` | Không enqueue — agents chủ động quyết định | — |

> **ALL-LLM:** MỌI action trên (kể cả DCA, WAIT) phải qua Agent A+B consensus. Engine chỉ cung cấp dữ liệu.

## 8. Ballot decision enum

| Decision | Ý nghĩa | Ghi chú |
|----------|---------|---------|
| `APPROVE` | B đồng ý — **BẮT BUỘC** có `counter_evidence` | Approve trống = `INVALID` |
| `CHALLENGE` | B yêu cầu A sửa — nêu `requested_changes` | Tối đa 2 vòng/cycle |
| `VETO` | B từ chối — rủi ro nghiêm trọng → DEFER | A không enqueue |
| `INVALID` | Ballot không đủ field / approve trống | System tự đánh dấu |

> Alias cũ `REJECT` tương đương `VETO`. Dùng `VETO` trong schema mới.

## 9. SYSTEM_FREEZE

| Thuật ngữ | Định nghĩa |
|-----------|-------------|
| `SYSTEM_FREEZE` | Flag toàn cục (không phải pair state). `true` khi LLM API không khả dụng → đóng băng mọi action |
| `ALERT_LLM_OUTAGE` | Event gửi Boss khi freeze — severity CRITICAL |
| Auto-resume | LLM khôi phục → `SYSTEM_FREEZE = false` tự động |
| Auto-degrade | **KHÔNG CÓ** — không chuyển về rule-only khi LLM down |

## 10. similarity_score (P2)

| Thuật ngữ | Định nghĩa |
|-----------|-------------|
| `similarity_score` | Đo mức tương đồng giữa thesis Agent A và thesis Agent B. P2 — thuật toán: cosine similarity hoặc embedding distance giữa `A.thesis` và `B.thesis`. Lưu trong bảng `Ballots` |

