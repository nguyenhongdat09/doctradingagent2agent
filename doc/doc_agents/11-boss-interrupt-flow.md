# 11 — Boss Interrupt Flow

## 1. Mục tiêu

Cho phép **Boss (bạn)** prompt can thiệp khi thấy market ổn mà agents còn **SLEEPING**: đánh thức A+B, trao đổi 3 bên, chốt plan, **Agent A** gửi lệnh xuống sàn.

**Khả thi:** có — interrupt scheduler + session_mode=BOSS (xem [01](01-a2a-overview.md)).

## 2. Điểm vào

```
Boss gửi BossWake {
  intent: "AUDCAD nhìn ổn, xem có thể Buy dip không?",
  symbols: ["AUDCAD"],
  priority: HIGH
}
```

Orchestrator:

1. Cancel `sleep_until`  
2. `session_mode = BOSS`  
3. Wake Agent A và Agent B  
4. Gắn `intent` vào cycle context  

## 3. Sequence hội thoại

```
B0  BossWake
B1  A: quan sát market (D1/H1) + đọc intent Boss
B2  A: TradePlan hoặc ActionProposal (HardPass)
B3  B: assessment độc lập + ballot (chống ba phải kể cả trước Boss)
B4  Chat turns (giới hạn MaxBossTurns, gợi ý 6–12):
      Boss hỏi/định hướng ↔ A giải thích ↔ B phản biện
B5  A có thể revise plan (vẫn HardPass)
B6  B ballot lại nếu plan đổi
B7  BossACK
B8  Nếu B.APPROVE → CONSENSUS_WITH_BOSS → A OrderSend
    Nếu B không APPROVE và BossOverride(reason) → BOSS_OVERRIDE_EXEC → A OrderSend
    Nếu BossACK nhưng không override và B dissent → DEFER + A set wake (C1–C3)
B9  session_mode = AUTO; A WakeRequest; sleep
```

## 4. Điều kiện execute (nhắc lại)

```
HardPass
∧ BossACK
∧ ( B.APPROVE  ∨  BossOverride.reason_non_empty )
→ A.OrderSend
```

## 5. Boss wake khi đang có lệnh

Cùng protocol với `DcaReview`: Boss có thể yêu cầu xem DCA/close ngay. A+B dual review trong BOSS mode; execute rules như trên.

## 6. Boss wake giữa H1 (chưa close)

- Agents được bàn và soạn plan dự kiến.  
- Nếu HardValidator yêu cầu nến H1 **đã đóng** mà chưa đóng → `action=WAIT` hoặc plan `pending_until=H1_close`.  
- A có thể set wake sát giờ H1 close sau khi Boss session kết thúc.

## 7. Giới hạn an toàn

| Rule | Giá trị design |
|------|----------------|
| MaxBossTurns / cycle | 12 |
| Max plan revises trong BOSS cycle | 3 |
| Override bắt buộc reason | yes |
| HardValidator | luôn ON (`BOSS_FORCE` default false) |
| Boss OrderSend trực tiếp | **cấm** |

## 8. Ví dụ prompt Boss

```
wake now | symbol=AUDCAD
Market đang ép mạnh xuống trong uptrend D1. 
Cho A lập plan Buy dip theo method; B phản biện độc lập.
Nếu cả hai ổn, tôi ACK để A vào BeginLot.
```

## 9. Diagram

[diagrams/A05-boss-interrupt.mmd](diagrams/A05-boss-interrupt.mmd)
