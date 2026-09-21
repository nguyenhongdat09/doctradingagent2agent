# ERRATA & Decision Log

> Tài liệu ghi nhận các quyết định thiết kế đã chốt, bao gồm những thay đổi so với phiên bản trước.
> Ngày cập nhật: 2026-09-21 (thêm DEC-10..DEC-18 — phần chốt cho kiến trúc v2.x).

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

---

# PHẦN II — QUYẾT ĐỊNH CHO KIẾN TRÚC v2.x (Contingency Plan / Plan Lifecycle)

> Các DEC dưới đây hợp thức hóa và vá các mâu thuẫn phát sinh từ bộ nâng cấp v2.0–v2.3 (`NANG_CAP_*.md`, `UPGRADE_CONTINGENCY_PLAN_SPEC.md`). Khi doc cũ (v1.x) mâu thuẫn với DEC này → **DEC v2.x thắng**.

## DEC-10 ✅ Plan-Trigger Execution = Thực Thi Consent Đã Ký (Ngoại Lệ ALL-LLM Duy Nhất)

| | |
|---|---|
| **Quyết định** | Khi một `contingency_plans` đã COMMITTED (A draft → B review → reconcile → chốt), việc **khớp trigger của các nhánh trong plan đó là execution cơ khí**, không phải "rule tự ra lệnh" — vì quyết định đã được A+B ký duyệt tại thời điểm commit |
| **Phân quyền nhánh** | `INVALIDATION` → **deterministic auto-execute** (không chờ LLM), vẫn qua HardValidator + Executor. `STANDBY` → không action, không cần LLM. `UPSIDE`/`DOWNSIDE` (ENTRY/DCA/PAYOFF/TP) → **Fast Consensus** A→B xác nhận trước khi enqueue |
| **INVALIDATION trong SYSTEM_FREEZE** | **VẪN CHẠY.** Stop bảo vệ đã được consent không bị đóng băng bởi LLM outage — FREEZE đóng băng *quyết định mới*, không đóng băng *cam kết bảo vệ đã ký* |
| **Lý do** | Giải quyết mâu thuẫn giữa spec v2.x (auto-execute) và DEC-01-NEW (ALL-LLM): ALL-LLM áp cho việc *tạo plan*, còn *khớp trigger của plan đã commit* là bước thực thi — giống Executor OrderSend |
| **Files ảnh hưởng** | `UPGRADE_CONTINGENCY_PLAN_SPEC.md` (§6), `doc_agents/05-scheduler-wakeup.md` (§5), `doc_phuong_phap/01-system-overview.md`, `doc_phuong_phap/12-operations-reliability.md` |

## DEC-11 ✅ candle_reaction Bắt Buộc Predicate Máy-Đọc + Delta ≥3 Nến

| | |
|---|---|
| **Quyết định** | `candle_reaction` trong trigger/scenario phải chứa **predicate structured** máy đọc được (vd `wick_ratio_min`, `close_dir`, `body_atr_min`, `engulfing`) song song text mô tả cho LLM. `DeltaMarketSnapshot.latest_bars` tối thiểu **3 nến đã đóng** (đủ kiểm pattern nhiều nến: Engulfing, chuỗi nến hãm lực) |
| **Lý do** | Nếu trigger chỉ là natural language thì PreTriggerFilter deterministic không đánh giá được → mọi lần chạm vùng đều phải gọi LLM → claim "trigger 1–3s không LLM" không đạt |
| **Files ảnh hưởng** | `UPGRADE_CONTINGENCY_PLAN_SPEC.md` (§4.1, §4.3), `doc_agents/04-message-schemas.md` |

## DEC-12 ✅ last_processed_bar_id Chỉ Chống Trùng Cho C0

| | |
|---|---|
| **Quyết định** | Dedupe `bar_id == last_processed_bar_id` **chỉ áp dụng cho xử lý tín hiệu H1-close (C0)**. Wake C3 intra-bar (DEC-09) dùng dedupe riêng theo event/trigger, không bị chặn bởi cùng `bar_id` |
| **Lý do** | Bản v1 của rule dedupe vô tình skip toàn bộ wake C3 thứ 2+ trong cùng nến — triệt tiêu DEC-09 |
| **Files ảnh hưởng** | `doc_agents/05-scheduler-wakeup.md` (§9) |

## DEC-13 ✅ Fallback Plan Bắt Buộc Kế Thừa Bảo Vệ + Transition SUPERSEDED

| | |
|---|---|
| **Quyết định** | Plan fallback sau reconcile-fail (hết `InpMaxDebateRounds` vòng, mặc định 2) **bắt buộc kế thừa** `INVALIDATION` + các kịch bản bảo vệ vị thế của plan trước. Plan bị thay thế bởi pruning/replan → `plan_status = 'SUPERSEDED'` (không phải CANCELLED — CANCELLED dành cho plan hủy chủ động chưa từng active) |
| **Lý do** | Tránh rổ lệnh mất stop bảo vệ trong cửa sổ giữa 2 plan; đóng lỗ hổng lifecycle enum |
| **Files ảnh hưởng** | `doc_agents/03-consensus-protocol.md`, `UPGRADE_CONTINGENCY_PLAN_SPEC.md` (§5, §6) |

## DEC-14 ✅ Pruning Thuộc A+B; Engine Chỉ Flag prune_hint

| | |
|---|---|
| **Quyết định** | Engine/PreTriggerFilter chỉ được set cờ `prune_hint` trong `DeltaMarketSnapshot`. Quyết định prune/viết lại Plan Chốt = **consensus A+B** (plan mới PROVISIONAL → reconcile → COMMITTED; plan cũ → SUPERSEDED) |
| **Lý do** | Engine tự viết lại Plan Chốt = engine tự quyết định → vi phạm phân tầng "mắt/não/tay" |
| **Files ảnh hưởng** | `NANG_CAP_PLAN_TAM_CHOT_PRICE_ACTION_PRUNING.md`, `UPGRADE_CONTINGENCY_PLAN_SPEC.md` (§6) |

## DEC-15 ✅ Escalation Là Async — Không Block C0

| | |
|---|---|
| **Quyết định** | Khi A/B escalate lên Boss, ticket được **park async**: scheduler vẫn xử lý C0/C3 bình thường (trong đó không có action mới cần consensus bị treo). Boss reply resume ticket. Timeout 30' → action theo default của spec (WAIT/không-đổi-vị-thế), không block wake |
| **Lý do** | Escalation blocking 30' có thể lỡ H1 close → vi phạm ADR-005 (C0 bắt buộc mỗi nến) |
| **Files ảnh hưởng** | `doc_agents/15-uncertainty-escalation.md`, `doc_agents/05-scheduler-wakeup.md` |

## DEC-16 ✅ Macro Cycle Mở Khi Có Entry Đầu Tiên + Plan TTL

| | |
|---|---|
| **Quyết định** | `macro_cycles` chỉ được tạo khi **ENTRY đầu tiên được fill thực sự** (không tạo khi còn FLAT chỉ vì có plan). Plan ACTIVE có TTL: `plan_age > PlanTtlDays` (default 7) hoặc `d1_context_changed == true` → bắt buộc replan trước khi trigger tiếp |
| **Lý do** | Plan STANDBY mãi không entry → macro cycle treo vĩnh viễn; D1 context đóng băng lúc tạo plan sẽ lạc hậu nếu plan sống nhiều ngày |
| **Files ảnh hưởng** | `UPGRADE_CONTINGENCY_PLAN_SPEC.md` (§4.3, §5), `doc_phuong_phap/08-parameters.md` |

## DEC-17 ✅ Enum Chuẩn Thống Nhất Toàn Bộ Doc

| | |
|---|---|
| **plan_status** | `ACTIVE` \| `DONE` \| `SUPERSEDED` \| `CANCELLED` (bỏ `EXECUTED` — dùng DONE) |
| **Ballot.decision** | `APPROVE` \| `CHALLENGE` \| `VETO` (bỏ `REVISE`, `REJECT`, `INVALID`) |
| **action_type** | `ENTRY` \| `DCA` \| `RECOVERY_DCA` \| `PAYOFF_REDUCE` \| `CLOSE_ALL` \| `PARTIAL_CLOSE` \| `WAIT` (bỏ `OPEN`, `PAYOFF` trần) |
| **plan_state** | `PROVISIONAL` \| `COMMITTED` (như v2.1) |
| **Files ảnh hưởng** | `doc_phuong_phap/10-sqlite-design.md` (DDL CHECK), `doc_agents/04-message-schemas.md`, `doc_agents/14-llm-prompt-spec.md` |

## DEC-18 ✅ Experience Memory — Write-Path, Retrieval Level, Fail-Open

| | |
|---|---|
| **Write-path** | `UnifiedContingencyPlan` có field `lessons_proposed[]` (tối đa 3, mỗi cái ≤200 ký tự theo template). LessonWriter đọc field này sau `evaluate()` — agents không ghi trực tiếp `Lessons` |
| **Retrieval level** | Ranking lọc ở mức `symbol/context/action` + score; `trigger_cond` là metadata cho LLM diễn giải, không machine-match. `scope='group'` = nhóm cùng base currency risk (AUD nhóm: AUDCAD+AUDNZD; NZD/CAD cross; GBPUSD độc lập) — định nghĩa bảng map trong doc_experience |
| **Lesson expiry** | Thêm `strategy_version` (mặc định `v2.3`) + `valid_until` (nullable). Lesson của version cũ → auto `ARCHIVED` khi strategy bump |
| **Fail-open** | External judge/reranker (vd Jev) sập → rớt về formula builder hiện tại; **KHÔNG kích SYSTEM_FREEZE** vì memory là advisory. `get_memory_pack()` là interface trừu tượng, backend hoán đổi được |
| **Files ảnh hưởng** | `doc_experience/01-experience-db-spec.md`, `doc_experience/02-map-to-agents.md`, `doc_agents/04-message-schemas.md`, `doc_agents/13-experience-loop.md` |
