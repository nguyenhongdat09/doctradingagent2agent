# 10 — Autonomy & Constraints

## 1. Mặc định: 0-human

Trong `session_mode=AUTO`, hệ thống chạy liên tục không cần Boss. A↔B đủ để vào lệnh / DCA / close theo protocol.

## 2. Ngoại lệ có kiểm soát

| Ngoại lệ | Mục đích |
|----------|----------|
| BossWake / BOSS session | Bạn can thiệp khi agents ngủ mà market ok |
| BossOverride | Chốt khi B dissent — **audit bắt buộc** |
| KillSwitch / Flatten | Dừng khẩn cấp out-of-band |
| `BOSS_FORCE` (default OFF) | Experimental: cho phép Boss ép qua HardValidator — **không khuyến nghị** |

## 3. Ràng buộc không đàm phán

1. Chỉ Agent A OrderSend.  
2. AUTO cần B.APPROVE hợp lệ.  
3. BOSS cần BossACK.  
4. HardValidator PASS (khi BOSS_FORCE=false).  
5. Mỗi DCA/material action cần dual-review (hoặc Boss path đủ điều kiện).  
6. RECOVERY: không mở ngược hướng (phuong_phap).  
7. Không max-DD auto-stop (phuong_phap); chỉ sạch lệnh / kill / Boss flatten.  
8. Ballot B thiếu counter_evidence → không APPROVE.

## 4. Wake constraints

- FLAT: tuân C1/C2 (+30m / H1+30m).  
- OPEN: dynamic trong [WakeMin, WakeMax].  
- BossWake luôn interrupt được.

## 5. Audit & trách nhiệm

Mọi `BOSS_OVERRIDE_EXEC` và mọi OrderSend lưu đủ plan_id, ballot, boss reason. Boss chịu trách nhiệm quyết định override; A chịu trách nhiệm thực thi đúng plan đã chốt; B chịu trách nhiệm chất lượng phản biện.

## 6. Bảo mật kênh Boss

- Xác thực Boss channel (token / local-only CLI).  
- Không expose OrderSend ra Boss trực tiếp.  
- Rate-limit BossWake để tránh spam interrupt.
