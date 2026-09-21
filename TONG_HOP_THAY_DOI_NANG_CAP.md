# 📋 TỔNG HỢP CÁC THAY ĐỔI & NÂNG CẤP HỆ THỐNG (CHANGELOG & UPGRADE SUMMARY)
> **Ngày cập nhật:** 14/09/2026 (đợt chuẩn hóa v2.3 — xem mục 5)  
> **Phiên bản:** Kiến trúc A2A v2.3 — *Macro/Micro Cycle & Unified Contingency Planning* (đã đồng bộ toàn bộ bộ doc)  
> **Dành cho:** Toàn bộ đội ngũ Phát triển (Backend Dev, AI Agent Engineer, Database Admin, QA/Tester)
>
> ⚠️ **Đợt v2.3:** Toàn bộ quyết định kiến trúc đã được chốt tại [`doc/ERRATA.md`](doc/ERRATA.md) (DEC-10..18). `doc_flow_code` và `doc_phuong_phap` đã được nâng lên v2.x — xem mục 5 bên dưới.

---

## 🎯 1. Mục Đích & Ý Tưởng Cốt Lõi Của Lần Cập Nhật Này

Lần nâng cấp này giải quyết triệt để 3 bài toán lớn nhất của hệ thống giao dịch A2A hiện tại:
1. **Tiết kiệm 70% - 80% chi phí Token LLM:** Không gửi lặp đi lặp lại 30-50 nến lịch sử ở mỗi nhịp nến. Thay vào đó, dùng cơ chế **Delta Snapshot** (chỉ gửi Plan cũ + nến mới nảy sinh).
2. **Loại bỏ hiện tượng "Mất trí nhớ & Đổi ý thất thường (Flip-flop)":** LLM bắt buộc phải tuân theo triết lý *"Trade the plan"* — kết thúc mỗi chu kỳ luôn có một **Kế hoạch kịch bản thống nhất 2 đầu (TĂNG làm gì, GIẢM làm gì, mốc nào HỦY/CẮT LỖ, khi nào CHỜ)**.
3. **Phản biện có trách nhiệm (Bãi bỏ ý định thêm Agent C):** Agent B khi không đồng ý với Agent A thì **không được từ chối khống**, mà bắt buộc phải đưa ra **Counter-Plan** (chờ điều kiện gì, giá nào mới chịu làm gì). Agent A và B tự hòa giải (Reconcile trong $\le$ 2 vòng) để ra Plan chung, **không cần tốn thêm chi phí tạo Agent C làm thư ký**.

---

## 🌟 2. Bảng So Sánh Trước & Sau Khi Nâng Cấp

| Hạng mục | Phiên bản cũ (v1.0) | Phiên bản mới nâng cấp (v2.0) |
| :--- | :--- | :--- |
| **Mô hình tư duy** | **Stateless**: Mỗi nến thức dậy phân tích lại từ đầu như mới. | **Stateful**: Kế thừa kịch bản (`Active Plan`) của chu kỳ trước, chỉ kiểm tra điều kiện kích hoạt (`Trigger`). |
| **Dữ liệu đầu vào nạp LLM** | 30 - 50 nến D1/H1 đầy đủ ($\approx$ 4,000 - 6,000 tokens/lần). | `Active Plan` + `DeltaMarketSnapshot` (giá hiện tại + 1 nến mới nhất) ($\approx$ **800 - 1,500 tokens/lần**). |
| **Quản lý vòng đời** | Chu kỳ đơn lẻ, rời rạc giữa các nến. | **Phân cấp 2 tầng**: **Macro Cycle** (tổng thể chiến dịch từ 0 lệnh đến clear sạch vị thế) và **Micro Cycle** (từng bước phản biện / khớp lệnh). |
| **Hành vi khi Agent B từ chối** | B chỉ trả về `REJECT` chung chung rồi dừng. | B bắt buộc cung cấp `Counter-Plan` định lượng (mốc giá, điều kiện chờ). |
| **Cơ chế ra quyết định** | Cần xem xét thêm Agent C để hòa giải. | **Loại bỏ Agent C**: A và B tự hòa giải (Reconcile $\le$ 2 vòng). |
| **Độ trễ khớp lệnh** | 8 - 15 giây (phải chờ LLM phân tích lại biểu đồ). | **1 - 3 giây** (nhiều chu kỳ tự động khớp trigger kịch bản mà code tự xử lý được ngay). |

---

## 📁 3. Chi Tiết Các File Thay Đổi & Tạo Mới

### 3.1. File Tạo Mới
- **[`doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md`](doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md)**:
  - Tài liệu đặc tả kỹ thuật chi tiết nhất dành cho Dev.
  - Chứa biểu đồ Sequence Diagram luồng trao đổi A - B.
  - Toàn bộ Schema JSON: `UnifiedContingencyPlan`, `DeltaMarketSnapshot`, `CounterPlan`.
  - Thiết kế Database DDL chuẩn: 3 bảng `macro_cycles`, `micro_cycles`, `contingency_plans`.

---

### 3.2. Các File Tài Liệu Đã Cập Nhật

#### 1. [`doc/doc_agents/02-agent-roles.md`](doc/doc_agents/02-agent-roles.md) (Vai trò Agent)
- **Agent A (Planner):**
  - Bổ sung trách nhiệm: Soạn `ContingencyPlan` đa kịch bản (UPSIDE / DOWNSIDE / INVALIDATION / STANDBY).
  - Tiếp nhận `CounterPlan` của B để hòa giải (Reconcile) thành Unified Plan.
  - Cấm: Kết thúc chu kỳ mà không sinh Unified Contingency Plan 2 đầu.
- **Agent B (Challenger):**
  - Cập nhật trách nhiệm: Khi không đồng thuận (`decision != APPROVE`), **bắt buộc** phải đưa ra `CounterPlan` (nêu rõ điều kiện chờ và kịch bản thay thế).
  - Cấm: **Từ chối khống (Passive Dissent)** mà không có cơ sở định lượng.

#### 2. [`doc/doc_agents/03-consensus-protocol.md`](doc/doc_agents/03-consensus-protocol.md) (Giao thức Đồng thuận)
- Bổ sung mục **Giao thức Đồng Thuận Kế Hoạch (Contingency Consensus)**.
- Thêm quy tắc **Dissent Protocol** (quy định cấu trúc dữ liệu khi B từ chối).
- Thêm quy trình **Reconciliation Loop** ($\le$ 2 vòng giữa A và B).
- Quy định hành vi an toàn (Fallback): Nếu sau 2 vòng vẫn chưa thống nhất thì chuyển sang `action = WAIT` (STANDBY) để bảo toàn tài khoản.

#### 3. [`doc/doc_agents/04-message-schemas.md`](doc/doc_agents/04-message-schemas.md) (Cấu trúc Dữ liệu JSON)
- Thêm mục `0b. DeltaMarketSnapshot`: Payload siêu nhẹ cho các Micro Cycle tiếp nối.
- Cập nhật mục `3. ReviewBallot`: Bổ sung trường `counter_plan` của Agent B.
- Thêm mục `3b. UnifiedContingencyPlan`: Kế hoạch hành động 4 nhánh (`UPSIDE`, `DOWNSIDE`, `INVALIDATION`, `STANDBY`) được lưu vào DB.

#### 4. [`doc/doc_agents/05-scheduler-wakeup.md`](doc/doc_agents/05-scheduler-wakeup.md) (Cơ chế Đánh thức)
- Cập nhật hành vi khi Scheduler thức dậy:
  - Nạp `Active Contingency Plan` từ chu kỳ trước + `DeltaMarketSnapshot`.
  - Kiểm tra **Pre-Trigger**: Nếu giá chạm kịch bản có sẵn (`DCA`, `TP`, `INVALIDATION`) thì kích hoạt quy trình xác nhận nhanh (Fast Consensus) và thực thi ngay, không cần gọi LLM "học lại biểu đồ".

#### 5. [`doc/doc_agents/07-dca-dual-review-loop.md`](doc/doc_agents/07-dca-dual-review-loop.md) (Vòng lặp DCA)
- Chuyển sang mô hình **Contingency Plan Driven**: Lệnh DCA được định trước mốc giá và khối lượng trong kịch bản `DOWNSIDE` của Plan kỳ trước.
- Định nghĩa rõ việc đóng `Macro Cycle`: Khi rổ lệnh clear sạch (`TotalLot == 0`) thì mới kết thúc chu kỳ tổng và ghi nhận bài học kinh nghiệm (`record_lesson`).

#### 6. [`README.md`](README.md) (Trang chủ tài liệu)
- Thêm banner thông báo nổi bật dẫn thẳng đến bản đặc tả kỹ thuật `UPGRADE_CONTINGENCY_PLAN_SPEC.md`.

---

## 🛠️ 4. Hướng Dẫn Nhanh Cho Đội Ngũ Phát Triển (Dev Action Items)

### 1. Database Engineer:
- Tạo 3 bảng mới theo DDL trong mục 5 của [`doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md`](doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md):
  - `macro_cycles`
  - `micro_cycles`
  - `contingency_plans`

### 2. Backend / Orchestrator Dev:
- Thay đổi hàm nạp dữ liệu ở Scheduler: Không query 30 bar D1/H1 nữa nếu chu kỳ hiện tại đang có `Active Plan`.
- Viết module **Deterministic Pre-Trigger Filter**: Code Python so sánh giá `Bid/Ask` hiện tại với các điều kiện trong `active_plan.scenarios` trước khi quyết định có cần gọi LLM hay không.
- Quản lý vòng đời `macro_cycle_id`: Tự động tạo mã mới khi tài khoản sạch lệnh (`FLAT`) và đóng mã khi toàn bộ lệnh đã chốt.

### 3. AI Agent Dev (Prompt Engineer):
- Cập nhật System Prompt Agent A: Định dạng JSON trả về phải bao gồm cấu trúc 4 nhánh của `UnifiedContingencyPlan`.
- Cập nhật System Prompt Agent B: Ràng buộc nếu vote `REJECT` / `CHALLENGE` thì JSON bắt buộc phải có key `counter_plan`.
- Thêm hàm Reconcile Prompt cho Agent A khi nhận được `counter_plan` từ Agent B.


---

## 📌 5. Đợt Chuẩn Hóa v2.3 — Đồng Bộ Toàn Bộ Tài Liệu (Doc Consistency Pass)

Sau khi v2.0–v2.3 phát hành, toàn bộ bộ tài liệu đã được rà soát và đồng bộ một lần (xem `doc/ERRATA.md`, DEC-10..18). Các thay đổi chính:

1. **Chốt quyết định bằng DEC mới (DEC-10..18):**
   - DEC-10: Phân quyền trigger — `INVALIDATION` của Plan COMMITTED auto-exec (kể cả khi FREEZE); `UPSIDE`/`DOWNSIDE` → fast-consensus; `STANDBY` không gọi LLM.
   - DEC-11: `candle_reaction` đổi thành `candle_predicates` (machine-checkable).
   - DEC-12: `last_processed_bar_id` chỉ dedupe C0; trigger dedupe qua `trigger_event_id`.
   - DEC-13: Reconcile-fail → fallback plan COMMITTED kế thừa INVALIDATION cũ; plan cũ `SUPERSEDED`.
   - DEC-14: `prune_hint` chỉ là cờ — engine không tự sửa plan.
   - DEC-15: `DeltaMarketSnapshot.latest_bars[]` giữ tối thiểu 3 nến (đủ pattern đa-nến).
   - DEC-16: Plan TTL (`PlanTtlDays`) + `d1_context_changed` → bắt buộc replan.
   - DEC-17: Chuẩn hóa enum `plan_status`, `Ballot.decision`, `action_type`, `Lessons.src` ở mọi file.
   - DEC-18: Write-path lesson qua `lessons_proposed[]`; `get_memory_pack()` là interface (v1 deterministic, v2 external judge fail-open).

2. **`doc_flow_code` nâng lên v2.x:** Phase 1 = 14 bảng (thêm `MarketSnapshots`, `macro_cycles`, `micro_cycles`, `contingency_plans`); Phase 3 output `UnifiedContingencyPlan`; Phase 4 thêm `plan_gate.py` (PreTriggerFilter) + `plan_summarizer.py`; Phase 5 thêm 7 test scenario plan-lifecycle (P1–P7); `01-architecture` cập nhật file tree.

3. **`doc_phuong_phap` nâng lên v2.x:** `10-sqlite-design` vá DDL (enum DEC-17, thêm `MarketSnapshots` + 3 bảng plan); `08-parameters` thêm registry tham số v2.x; `01`/`06` loại bỏ mô tả deterministic cũ.

4. **`doc_experience` hoàn thiện:** sửa `Lessons.src` default ngoài enum; định nghĩa `scope='group'`; `LessonFeedback` thêm `retrieval_score`/`retrieval_rank`; write-path `lessons_proposed[]`; `get_memory_pack()` interface + fail-open backend (DEC-18).

5. **README gốc:** banner v2.3, đánh dấu §§1–5 là legacy v0.x (MDA/SA/RA/EA) — không phải kiến trúc hiện hành.
