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

## 3. PlanSummarizer Worker (Post-Execution AI Worker Của Orchestrator)

> **LƯU Ý KIẾN TRÚC:** `PlanSummarizer` **KHÔNG PHẢI là Subagent** của Agent A hay Agent B. Nó là một AI Worker độc lập do Orchestrator kích hoạt tại luồng sự kiện hậu kỳ (Post-Execution Lifecycle Hook) sau khi lệnh trên MT5 khớp xong. Agent A và B không quản lý, không gọi và không bị ảnh hưởng bởi worker này.

### Trách nhiệm
- **Kích hoạt One-shot:** Chỉ được Orchestrator đánh thức khi một Plan Chốt chuyển sang trạng thái `DONE` (đã khớp lệnh, đã dời SL, đã chốt bớt, hoặc cắt lỗ).
- Sử dụng mô hình AI nhỏ, siêu rẻ và nhanh (`Gemini Flash`, `GPT-4o-mini`) để trích xuất sự thật khách quan (Ground Truth).
- Tóm tắt diễn biến Plan thành 2-3 gạch đầu dòng trung lập (`summary_text`), ghi xuống DB `contingency_plans.summary_text`.
- Không tham gia tranh luận hay biểu quyết lệnh, không làm ảnh hưởng đến latency của Agent A và B.

### Không được
- Tự ý biểu quyết (vote ballot), phân tích biểu đồ hay can thiệp vào quyết định của Agent A & B.
- Đưa cảm xúc cá nhân hoặc đánh giá chủ quan vào bản tóm tắt lịch sử.

---

## 4. Boss — Human (v1)

### Trách nhiệm
- `BossWake` + intent; hội thoại 3 bên; `BossACK` = xác nhận đã bàn xong (không thay ballot B).

### Không được (v1)
- `BossOverride` / ép HardValidator / OrderSend / enqueue thay A.
- Khi B dissent → chấp nhận **DEFER**.

---

## 5. Kiến Trúc Mở Rộng Tương Lai (Future Extensibility)

Hệ thống được thiết kế theo mô hình **Phân tầng (Tiered Architecture)** để chống xung đột khi mở rộng:
1. **Tầng 1 — Core Decision Council (Hội đồng Quyết định):** Hiện tại gồm **Agent A** và **Agent B**. Nếu tương lai bổ sung **Agent C (Macro/Sentiment Director)** thành Agent chính thứ 3, chỉ cần đưa Agent C vào vòng biểu quyết (Consensus Quorum 100%).
2. **Tầng 2 — Background AI Workers / Orchestrator Services (Các Dịch Vụ AI Chạy Ngầm Do Orchestrator Quản Lý):**
   - **PlanSummarizer Worker:** Đã hiện hữu, chuyên tóm tắt Plan khi `DONE`.
   - *NewsScanner Worker (Dự phòng):* Quét tin tức vĩ mô, cảnh báo đỏ cho Orchestrator nạp context.
   - *MathCalculator Worker (Dự phòng):* Tính toán khoảng cách spacing, lot, ATR cho Orchestrator.
   - *PostMortemQA Worker (Dự phòng):* Đúc kết bài học kinh nghiệm khi đóng Bìa Carton (Macro Cycle).
   - Các Worker này hoạt động độc lập (Plug & Play), không có quyền can thiệp vào lệnh hay tham gia biểu quyết.


---

## 6. Orchestrator + Executor

| Thành phần | Làm | Không làm |
|------------|-----|-----------|
| Orchestrator | Wake, bus, session_mode, audit, HardValidator gate, kích hoạt PlanSummarizer khi Plan DONE | Chọn hướng lệnh |
| Executor Thread | Poll PENDING → claim PROCESSING → MT5 OrderSend/Close → Archive hoặc FAILED | Sinh plan |

---

## 7. RACI Ma Trận Vai Trò

| Việc | A (Planner) | B (Challenger) | PlanSummarizer | Boss | Orch | Executor |
|------|---|---|---|---|---|---|
| Fetch / MemoryPack | R | R | — | C | I | — |
| Draft plan | R | C | — | C (BOSS) | I | — |
| Ballot (Phản biện/Biểu quyết) | C | R | — | I | I | — |
| Duy trì Plan ACTIVE (Multi-session) | R | R | — | — | R (lockdown) | — |
| Enqueue MarketOrderInfo | R | — | — | — | I (gate) | — |
| OrderSend MT5 | — | — | — | — | I | **R** |
| Summarize khi Plan DONE | — | — | **R** | — | I (trigger) | — |
| Set wake | R | — | — | C | R (timer) | — |
