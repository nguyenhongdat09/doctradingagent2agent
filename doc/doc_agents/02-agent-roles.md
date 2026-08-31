# 02 — Agent Roles

## 1. Agent A — Planner (không phải Executor sàn)

### Trách nhiệm
- Tự fetch D1/H1; nhận structure features + H1 strength score deterministic.
- `get_memory_pack` trước khi lập plan; đưa pack vào lập luận.
- Soạn `TradePlan` / `DcaReview`; tranh luận với B (≤2 vòng/cycle).
- Trong `BOSS`: tiếp nhận ý Boss; **không** được execute khi B dissent.
- Sau consensus + HardPass → **`enqueue_order(...)`** = INSERT `MarketOrderInfo` status=`PENDING`.
- Set wake C1–C3; sau đóng lệnh gọi `submit_feedback` / `record_lesson` (qua tool / LessonWriter).

### Không được
- Gọi `OrderSend` / đóng lệnh MT5 trực tiếp.
- Enqueue khi thiếu B.APPROVE (AUTO và BOSS).
- Bỏ HardValidator / invent swing.

## 2. Agent B — Independent Challenger

### Trách nhiệm
- Độc lập đọc snapshot + MemoryPack; bắt lỗi A vi phạm bài học AVOID.
- `ReviewBallot` đủ field; CHALLENGE khi cần.
- Trong BOSS: phản biện cả Boss nếu trái data/rails.

### Không được
- APPROVE không `counter_evidence`; ba phải; enqueue/OrderSend.

## 3. Boss — Human (v1)

### Trách nhiệm
- `BossWake` + intent; hội thoại 3 bên; `BossACK` = xác nhận đã bàn xong (không thay ballot B).

### Không được (v1)
- `BossOverride` / ép HardValidator / OrderSend / enqueue thay A.
- Khi B dissent → chấp nhận **DEFER**.

## 4. Orchestrator + Executor

| Thành phần | Làm | Không làm |
|------------|-----|-----------|
| Orchestrator | Wake, bus, session_mode, audit, HardValidator gate trước enqueue | Chọn hướng lệnh |
| Executor Thread | Poll PENDING → claim PROCESSING → MT5 OrderSend/Close → Archive hoặc FAILED | Sinh plan |

## 5. RACI rút gọn

| Việc | A | B | Boss | Orch | Executor |
|------|---|---|------|------|----------|
| Fetch / MemoryPack | R | R | C | I | — |
| Draft plan | R | C | C (BOSS) | I | — |
| Ballot | C | R | I | I | — |
| Enqueue MarketOrderInfo | R | — | — | I (gate) | — |
| OrderSend MT5 | — | — | — | I | **R** |
| Set wake | R | — | C | R (timer) | — |
