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

## 2. Mode AUTO

```
CONSENSUS_AUTO ⇔
  session_mode == AUTO
  ∧ HardPass
  ∧ B.decision == APPROVE ∧ ballot_valid(B)
  ∧ A.ready_to_enqueue == true

→ A.enqueue_order(MarketOrderInfo PENDING)
→ Executor thực thi
```

Debate C4: ≤2 vòng CHALLENGE trong cycle; hết → DEFER C1/C2/C3.

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
