# 03 — Consensus Protocol

## 1. Hard gate

```
HardPass = HardValidator(plan) == PASS
Nếu ¬HardPass → FORBIDDEN_ENQUEUE
```

HardValidator (5 checks) — xem phuong_phap overview:
1. Matrix action hợp lệ (PUSH≥0.6 + Context)  
2. Spacing / ladder đúng  
3. RECOVERY cấm mở ngược  
4. NormalizeLot  
5. Kill-switch off  

## 2. Mode AUTO & Giao thức Đồng Thuận Kế Hoạch (Contingency Consensus)

```
CONSENSUS_AUTO ⇔
  session_mode == AUTO
  ∧ HardPass
  ∧ B.decision == APPROVE ∧ ballot_valid(B)
  ∧ A.ready_to_enqueue == true

→ A.enqueue_order(MarketOrderInfo PENDING)
→ Executor thực thi
→ A & B sinh PLAN CHỐT (COMMITTED) cho chu kỳ tới
```

### Quy tắc Vòng Đời: Plan Tạm (Provisional) vs Plan Chốt (Committed) & ACTIVE / DONE
1. **Plan Tạm (`PROVISIONAL`):** Mọi bản thảo do A khởi tạo hoặc trong các vòng tranh luận đều là Plan Tạm. Plan Tạm chỉ nằm trong bộ nhớ đệm trao đổi giữa các Agent, **tuyệt đối không được kích hoạt lệnh hay lưu đè `is_active = TRUE` vào DB**.
2. **Plan Chốt (`COMMITTED`):** Chỉ khi **100% Agent trong Core Decision Council đồng thuận (`APPROVE`)**, Plan Tạm mới được phong cấp thành **Plan Chốt (`COMMITTED`)** và lưu vào DB với `is_active = TRUE`, `plan_status = 'ACTIVE'`.
3. **Quy tắc Duy Trì Xuyên Suốt & Khóa Phân Tích (Multi-session Persistence & Lockdown Rule):**
   - Một Plan Chốt `ACTIVE` có thể kéo dài qua 1 chu kỳ, 5 chu kỳ hoặc nhiều chu kỳ nến cho đến khi có một nhánh hành động được thỏa mãn.
   - Ở tất cả các chu kỳ này: **CẤM các Agent phân tích lại biểu đồ từ đầu (No re-analysis)**, **CẤM tự ý vào lệnh mới bừa bãi**. Các Agent chỉ đóng vai trò giám sát: đối chiếu nến mới với kịch bản trong Plan Chốt (chưa khớp $\rightarrow$ STANDBY; khớp $\rightarrow$ thực thi).
4. **Chuyển sang trạng thái `DONE` & Kích hoạt Subagent C (Scribe):**
   - Khi một nhánh hành động then chốt (vào lệnh, dời SL, chốt bớt, cắt lỗ) đã thực thi xong $\rightarrow$ Plan chuyển sang `plan_status = 'DONE'`, `is_active = FALSE`.
   - Ngay lập tức, Orchestrator kích hoạt **Subagent C (The Scribe)** tóm tắt trung lập diễn biến thành 2-3 gạch đầu dòng (`summary_text`) và lưu vào DB.
   - Ở chu kỳ sau, toàn bộ chuỗi các `summary_text` được đính kèm vào context để A và B thảo luận cho Plan Chốt tiếp theo trong Macro Cycle.

### Quy tắc Bắt Buộc Khi B Không Đồng Thuận (Dissent Protocol):
1. **Không cho phép "từ chối khống":** Nếu `B.decision ∈ {REJECT, CHALLENGE}`, ballot của B **BẮT BUỘC** phải chứa trường `counter_plan`:
   - `waiting_for`: Chỉ rõ đang chờ đợi điều kiện gì (chờ nến rút râu, chờ cụm nến đỏ/xanh đảo chiều, hãm lực...).
   - `scenarios_override`: Kịch bản chi tiết 2 đầu kèm yêu cầu Price Action nến cụ thể.
2. **Vòng Hòa Giải (Reconciliation Loop - ≤2 vòng/cycle):**
   - Vòng 1: A đề xuất `TradePlan` + `ContingencyPlan` (`PROVISIONAL`). B phản hồi `ballot` kèm `counter_plan`.
   - Vòng 2: A tiếp thu `counter_plan` của B, điều chỉnh lại các mốc giá và điều kiện nến thành `Reconciled Plan` (`PROVISIONAL`).
   - B ký duyệt `APPROVE` trên `Reconciled Plan` → Chuyển trạng thái sang `COMMITTED` (Plan Chốt) và lưu vào DB.
3. **Nếu sau 2 vòng vẫn xung đột:**
   - Hệ thống tự động chuyển sang kịch bản an toàn nhất: `action = WAIT` (STANDBY), hẹn giờ wake nến kế tiếp.
   - Luôn luôn phải có 1 `COMMITTED PLAN` (tối thiểu là kịch bản STANDBY/Cắt lỗ bảo vệ) được lưu vào DB.

## 3. Mode BOSS (v1 — không Override)

```
CONSENSUS_WITH_BOSS ⇔
  session_mode == BOSS
  ∧ HardPass
  ∧ B.decision == APPROVE ∧ ballot_valid(B)
  → A.enqueue_order(...)

Nếu B ≠ APPROVE (kể cả Boss muốn đi tiếp):
  → DEFER (C1/C2/C3) — KHÔNG có BOSS_OVERRIDE_EXEC
```

`BossACK` chỉ ghi nhận Boss đã tham gia bàn; **không** thay thế B.APPROVE.

## 4. Case DEFER C1–C4

Giữ như [05-scheduler-wakeup.md](05-scheduler-wakeup.md): C1 +30m FLAT; C2 H1+30m; C3 dynamic OPEN; C4 debate trong cycle.

## 5. Action types cần consensus rồi enqueue

ENTRY, DCA, RECOVERY_DCA, PAYOFF_REDUCE, CLOSE_ALL, PARTIAL_CLOSE.  
WAIT: A có thể tự WAIT + set wake (không enqueue).

## 6. Audit

`timestamp, symbol, session_mode, plan_id, HardPass, B.decision, BossACK?, outcome, queue_row_id?, tickets?`
