# ERRATA & Decision Log

> Tài liệu ghi nhận các quyết định thiết kế đã chốt, bao gồm những thay đổi so với phiên bản trước.
> Ngày cập nhật: 2026-08-31.

---

## DEC-01 ❌ BÃI BỎ — DCA NORMAL deterministic

| | |
|---|---|
| **Quyết định cũ** | DCA NORMAL = engine tự enqueue khi spacing đủ (deterministic), không qua agents |
| **Trạng thái** | **BÃI BỎ HOÀN TOÀN** |
| **Thay thế bởi** | Nguyên tắc ALL-LLM (xem DEC-01-NEW) |
| **Lý do bãi bỏ** | Mâu thuẫn với giá trị cốt lõi: agents có bộ não phán đoán, không phải EA rule cứng |

## DEC-01-NEW ✅ Nguyên tắc ALL-LLM (BẤT BIẾN)

| | |
|---|---|
| **Quyết định** | MỌI action thay đổi vị thế (ENTRY, DCA, RECOVERY_DCA, PAYOFF_REDUCE, CLOSE_ALL, PARTIAL_CLOSE, kể cả WAIT) phải do Agent A phân tích + Agent B phản biện → consensus → HardValidator → enqueue |
| **Bản chất** | Engine (mắt) = cảm biến dữ liệu. LLM A+B (não) = người quyết định duy nhất. Executor (tay) = thực thi cơ khí. KHÔNG có rule cứng tự động ra lệnh |
| **Lý do** | DCA không phải "giá đi ngược là lấp" → mà là "lúc này lấp có khôn ngoan không?" — giá trị cốt lõi là sự phán đoán của LLM |
| **Chi phí chấp nhận** | Tăng đáng kể LLM calls (ước ~192–384 calls/ngày, ~$0.05–$0.20/ngày) — user ưu tiên chất lượng phán đoán |
| **Files ảnh hưởng** | `06-state-machine.md`, `05-capital-dca.md`, `07-dca-dual-review-loop.md`, `10-autonomy-constraints.md`, `04-message-schemas.md`, `09-runtime-architecture.md` |

## DEC-02 ✅ DCA/Action vẫn qua Executor queue + HardValidator

| | |
|---|---|
| **Quyết định** | Dù A+B consensus, mọi action vẫn phải qua HardValidator 5 checks trước enqueue, và chỉ Executor mới OrderSend MT5 |
| **Giữ nguyên** | Không thay đổi |

## DEC-03 ✅ Gộp Error/Startup/Monitoring → 1 file

| | |
|---|---|
| **Quyết định** | Gộp vào `doc_phuong_phap/12-operations-reliability.md` |
| **Giữ nguyên** | Không thay đổi |

## DEC-04 ✅ Monitoring Phase 1 = heartbeat + MT5 health + queue backlog

| | |
|---|---|
| **Quyết định** | Phase 1 chỉ 3 mục monitoring tối thiểu. Phase 2 mở rộng |
| **Giữ nguyên** | Không thay đổi |

## DEC-05 ✅ Swap cost = P1 advisory

| | |
|---|---|
| **Quyết định** | Bổ sung swap vào BasketProfit calculation. RECOVERY kéo dài → swap ảnh hưởng payoff |
| **Giữ nguyên** | Sẽ patch vào `05-capital-dca.md` |

## DEC-06 ✅ similarity_score = P2

| | |
|---|---|
| **Quyết định** | Cosine/embedding similarity giữa A thesis và B thesis. Bổ sung thuật toán sau |
| **Giữ nguyên** | Không thay đổi |

## DEC-07 ✅ Config/Deployment/Versioning = P2

| | |
|---|---|
| **Quyết định** | Defer, không chặn Phase 1 code |
| **Giữ nguyên** | Không thay đổi |

## DEC-08 ✅ SYSTEM_FREEZE — Fallback khi LLM không khả dụng

| | |
|---|---|
| **Quyết định** | LLM down → SYSTEM_FREEZE = true (flag toàn cục). Đóng băng hoàn toàn — engine KHÔNG tự DCA/close/entry. Mọi position giữ nguyên. Alert Boss ngay |
| **Boss = bộ não dự phòng** | Boss (con người) là người duy nhất được phép can thiệp khi FREEZE |
| **KHÔNG auto-degrade** | Không có cơ chế chuyển về rule-only khi LLM down |
| **KHÔNG auto-flatten** | Kill-switch chỉ Boss/operator bật thủ công |
| **Thoát FREEZE** | LLM khôi phục → auto-resume + light reconcile (so khớp MT5 positions vs PairState) trước khi agents tiếp tục chu kỳ bình thường |
| **Lý do** | Khi "bộ não" hỏng, đúng đắn là dừng + gọi người. Không đổi sang "bộ não tự động cấp thấp" vì phản bội mục đích ALL-LLM |
| **Files ảnh hưởng** | `06-state-machine.md` (§7.2), `04-message-schemas.md` (§8), `10-autonomy-constraints.md`, `12-operations-reliability.md`, `14-llm-prompt-spec.md` |

## DEC-09 ✅ DCA Timing — Xét Ở Mọi Lần Wake C3 (Dynamic Intra-bar)

| | |
|---|---|
| **Quyết định** | **ENTRY:** Neo theo nến H1 đóng.<br>**DCA (NORMAL & RECOVERY):** Xét tại **MỖI LẦN WAKE C3** (dynamic intra-bar, vài phút/lần). Khi `spacing_met == true`, Agent A+B đánh giá và ra quyết định ngay trong cycle wake đó, **KHÔNG chờ H1 close**, để không bỏ lỡ nhịp lấp rổ khi giá chạy ngược giữa nến |
| **An toàn** | Vẫn tuân thủ HardValidator: spacing đủ, NormalizeLot, kill-switch off, không mở ngược BasketDir |
| **Lý do** | Tránh mâu thuẫn giữa "quyết định neo H1 close" và việc cần lấp rổ kịp thời giữa nến khi giá biến động mạnh |
| **Files ảnh hưởng** | `05-capital-dca.md` (§3.3), `06-state-machine.md` (§5.2), `doc_agents/05-scheduler-wakeup.md` (§5), `doc_agents/07-dca-dual-review-loop.md` (§1) |
