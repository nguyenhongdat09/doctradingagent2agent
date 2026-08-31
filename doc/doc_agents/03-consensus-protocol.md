# 03 — Consensus Protocol

## 1. Mục tiêu

Quy định khi nào được **execute**, khi nào **defer + sleep**, và khi nào **Boss** tham gia chốt.

## 2. Hard gate (luôn trước mọi consensus)

```
HardPass = HardValidator(plan_or_proposal) == PASS
Nếu ¬HardPass → FORBIDDEN_EXEC (kể cả BossOverride khi BOSS_FORCE=false)
```

## 3. Mode AUTO — đồng thuận A↔B

```
CONSENSUS_AUTO ⇔
  session_mode == AUTO
  ∧ HardPass
  ∧ B.decision == APPROVE
  ∧ ballot_valid(B)
  ∧ A.ready_to_execute == true

→ Agent A OrderSend
```

### Debate trong cycle (C4)

```
round = 0
loop:
  A publishes plan
  B ballots
  if B.APPROVE → CONSENSUS_AUTO
  if B.CHALLENGE and round < 2:
      round += 1
      A revises
      continue
  else:
      DEFER → áp C1/C2/C3 theo PairState
      break
```

## 4. Mode BOSS — đồng thuận có Boss

```
CONSENSUS_WITH_BOSS ⇔
  session_mode == BOSS
  ∧ HardPass
  ∧ BossACK == true
  ∧ B.decision == APPROVE
  ∧ ballot_valid(B)
  → A OrderSend

BOSS_OVERRIDE_EXEC ⇔
  session_mode == BOSS
  ∧ HardPass
  ∧ BossACK == true
  ∧ BossOverride.present == true
  ∧ BossOverride.reason.length > 0
  ∧ B.decision ∈ {REJECT, CHALLENGE, INVALID}
  → A OrderSend + audit BOSS_OVERRIDE
```

Nếu BossACK nhưng không Override và B ≠ APPROVE → DEFER (A set wake theo C1–C3), không execute.

## 5. Case DEFER C1–C4 (khi A≠B hoặc hết debate)

| Case | Điều kiện PairState / H1 | Hành động |
|------|--------------------------|-----------|
| **C1** | FLAT ∧ `ElapsedInH1 >= 30m` | `WakeRequest(now+30m)` bắt buộc |
| **C2** | FLAT ∧ `ElapsedInH1 < 30m` | `WakeRequest(H1_open+30m)` |
| **C3** | NORMAL ∨ RECOVERY | A chọn dynamic wake ∈ [WakeMin, WakeMax] theo chart/PnL/spacing |
| **C4** | Còn lượt CHALLENGE trong cycle | Tiếp revise; không sleep |

`BossWake` có thể cắt ngang DEFER sleep bất kỳ lúc nào.

## 6. Action types cần consensus

| Action | AUTO cần | BOSS cần |
|--------|----------|----------|
| ENTRY BeginLot | CONSENSUS_AUTO | CONSENSUS_WITH_BOSS hoặc OVERRIDE |
| DCA (lệnh ≥ 2) | CONSENSUS_AUTO trên DcaReview | tương tự |
| RECOVERY_DCA / PAYOFF_REDUCE | CONSENSUS_AUTO | tương tự |
| CLOSE_ALL (NORMAL TP) | CONSENSUS_AUTO | tương tự |
| WAIT | Không cần B (A có thể tự WAIT + set wake) | Boss có thể yêu cầu replan |

## 7. Conflict A vs B vs Boss (tóm tắt)

```
if ¬HardPass: block
elif BOSS and BossACK and B.APPROVE: exec CONSENSUS_WITH_BOSS
elif BOSS and BossACK and BossOverride: exec BOSS_OVERRIDE_EXEC
elif AUTO and B.APPROVE: exec CONSENSUS_AUTO
elif CHALLENGE and rounds left: C4
else: DEFER C1/C2/C3
```

## 8. Audit bắt buộc mỗi outcome

Ghi: `timestamp, symbol, session_mode, plan_id, HardPass, B.decision, BossACK, BossOverride.reason?, outcome, order_tickets?`
