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
→ A & B sinh Unified Contingency Plan cho chu kỳ tới
```

### Quy tắc Bắt Buộc Khi B Không Đồng Thuận (Dissent Protocol):
1. **Không cho phép "từ chối khống":** Nếu `B.decision ∈ {REJECT, CHALLENGE}`, ballot của B **BẮT BUỘC** phải chứa trường `counter_plan`:
   - `waiting_for`: Chỉ rõ đang chờ đợi điều kiện gì (nến H1 đóng rút chân, phá vỡ kháng cự/hỗ trợ, biên độ pip...).
   - `scenarios_override`: Kịch bản chi tiết 2 đầu (nếu giá TĂNG đến X thì làm gì, nếu giá GIẢM về Y thì làm gì).
2. **Vòng Hòa Giải (Reconciliation Loop - ≤2 vòng/cycle):**
   - Vòng 1: A đề xuất `TradePlan` + `ContingencyPlan`. B phản hồi `ballot` kèm `counter_plan`.
   - Vòng 2: A tiếp thu `counter_plan` của B, điều chỉnh lại các mốc giá và điều kiện kích hoạt thành `Reconciled Plan`.
   - B ký duyệt `APPROVE` trên `Reconciled Plan` → Lưu thành `UNIFIED CONTINGENCY PLAN` vào DB/Cache.
3. **Nếu sau 2 vòng vẫn xung đột:**
   - Hệ thống tự động chuyển sang kịch bản an toàn nhất: `action = WAIT` (STANDBY), hẹn giờ wake nến kế tiếp.
   - Luôn luôn phải có 1 `UNIFIED PLAN` (tối thiểu là kịch bản STANDBY/Cắt lỗ bảo vệ) được lưu vào DB.

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
