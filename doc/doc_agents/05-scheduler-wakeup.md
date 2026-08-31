# 05 — Scheduler & Wakeup

## 1. Vai trò

Orchestrator giữ `next_wake_at` (per symbol hoặc global). Agent A **quyết** thời điểm hẹn qua `WakeRequest`. Boss có thể **interrupt** bằng `BossWake`.

```
priority: BossWake  >  next_wake_at timer  >  idle
```

## 2. Công thức thời gian H1

```
H1_open      = time mở nến H1 hiện tại (broker)
ElapsedInH1  = now - H1_open
H1_mid       = H1_open + 30 minutes
```

## 3. FLAT — quy tắc cố định (C1 / C2)

| Điều kiện | Wake |
|-----------|------|
| FLAT ∧ `ElapsedInH1 >= 30m` (C1) | `next_wake_at = now + 30m` **bắt buộc** khi DEFER / hết cycle không entry |
| FLAT ∧ `ElapsedInH1 < 30m` (C2) | `next_wake_at = H1_mid` (= H1_open + 30m) |

Mục đích: agents không ngủ xuyên suốt H1; tối thiểu một lần dậy giữa nến / sau mốc 30p để sẵn sàng quanh tín hiệu H1 close (phuong_phap).

**Sau ENTRY thành công:** PairState → NORMAL → chuyển sang quy tắc OPEN (C3).

## 4. OPEN (NORMAL / RECOVERY) — timer dynamic (C3)

Agent A tự chọn `interval` dựa trên chart:

| Gợi ý heuristic (doc, không hard-code duy nhất) | Interval gợi ý |
|------------------------------------------------|----------------|
| Biến động mạnh / gần spacing / PnL biến nhanh | gần WakeMin (vd 3–10m) |
| Sideway chậm, xa spacing | trung bình (15–30m) |
| Chờ H1 close sắp tới | wake trước close vài phút |
| RECOVERY đang adverse squeeze | sát hơn (WakeMin–15m) |

```
WakeMin = 3 minutes   // input
WakeMax = 60 minutes  // input
interval = clamp(A_choice, WakeMin, WakeMax)
next_wake_at = now + interval
```

## 5. BossWake interrupt

```
on BossWake:
  cancel pending sleep
  session_mode = BOSS
  wake Agent A and Agent B immediately
  attach boss.intent to cycle context
```

Sau khi BOSS session kết thúc (exec hoặc defer):

```
session_mode = AUTO
A issues WakeRequest theo PairState (C1/C2/C3)
```

## 6. Quan hệ wake vs H1 close (phuong_phap)

| Khái niệm | Vai trò |
|-----------|---------|
| Wake cycle | Agents **làm việc** (quan sát, bàn, có thể WAIT) |
| H1 bar close | Điều kiện **hợp lệ** để HardValidator cho phép ENTRY/DCA theo signal nến đóng |

Ví dụ: BossWake giữa H1 → agents bàn được; nếu signal cần nến **đã đóng** mà chưa đóng → plan action=WAIT hoặc chờ close (A có thể set wake sát `H1_close_time`).

## 7. Pseudocode orchestrator

```
loop:
  wait_for: timer(next_wake_at) OR event(BossWake) OR event(Kill)
  if Kill: handle_emergency; continue
  if BossWake: session_mode=BOSS; ctx=boss.intent
  else: session_mode=AUTO

  run_cycle(A, B, session_mode, ctx)  // consensus protocol
  // A must leave a WakeRequest unless killed
  next_wake_at = A.last_WakeRequest.next_wake_at
```

## 8. Tham số scheduler (design defaults)

| Param | Default | Mô tả |
|-------|---------|--------|
| `FlatWakeAfterMidMinutes` | 30 | C1: +30m sau mốc |
| `H1MidOffsetMinutes` | 30 | C2: H1_open+30 |
| `WakeMinSeconds` | 180 | 3m |
| `WakeMaxSeconds` | 3600 | 60m |
| `MaxDebateRounds` | 2 | C4 |
