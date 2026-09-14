# 02 — Agent Roles

## 1. Agent A — Planner (không phải Executor sàn)

### Trách nhiệm
- Tự fetch D1/H1 khi bắt đầu Macro Cycle; ở Micro Cycle sau chỉ nạp Active Plan + Delta Data.
- `get_memory_pack` trước khi lập plan; đưa pack vào lập luận.
- Soạn `TradePlan` kèm `ContingencyPlan` đa kịch bản (UPSIDE / DOWNSIDE / INVALIDATION / STANDBY).
- Tiếp nhận `CounterPlan` từ Agent B để hòa giải (Reconcile) thành Unified Plan (≤2 vòng/cycle).
- Trong `BOSS`: tiếp nhận ý Boss; **không** được execute khi B dissent.
- Sau consensus + HardPass → **`enqueue_order(...)`** = INSERT `MarketOrderInfo` status=`PENDING`.
- Lưu `Unified Contingency Plan` vào DB để làm kim chỉ nam cho Micro Cycle kế tiếp.
- Set wake C1–C3; sau khi đóng sạch rổ lệnh (kết thúc Macro Cycle) gọi `submit_feedback` / `record_lesson`.

### Không được
- Gọi `OrderSend` / đóng lệnh MT5 trực tiếp.
- Enqueue khi thiếu B.APPROVE (AUTO và BOSS).
- Bỏ HardValidator / invent swing.
- Kết thúc chu kỳ mà không sinh Unified Contingency Plan 2 đầu (Tăng / Giảm).

## 2. Agent B — Independent Challenger

### Trách nhiệm
- Độc lập đọc snapshot/delta + MemoryPack; bắt lỗi A vi phạm bài học AVOID.
- `ReviewBallot` đủ field; CHALLENGE khi cần.
- **Bắt buộc cung cấp `CounterPlan` cụ thể khi không đồng thuận:** Chỉ rõ đang chờ điều kiện gì (mốc giá, nến xác nhận), nếu thị trường TĂNG thì làm gì, nếu GIẢM thì làm gì.
- Trong BOSS: phản biện cả Boss nếu trái data/rails.

### Không được
- APPROVE không `counter_evidence`; ba phải; enqueue/OrderSend.
- **Từ chối khống (Passive Dissent):** Cấm chỉ REJECT/CHALLENGE chung chung mà không đưa ra Counter-Plan định lượng mốc giá/điều kiện chờ.

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
