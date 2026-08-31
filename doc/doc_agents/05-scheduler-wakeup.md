# 05 — Scheduler & Wakeup

## 1. Vai trò

Orchestrator giữ `next_wake_at` (per symbol hoặc global). Agent A **quyết** thời điểm hẹn qua `WakeRequest`. Boss có thể **interrupt** bằng `BossWake`.

```
priority: BossWake  >  H1_close (bắt buộc)  >  next_wake_at timer  >  idle
```

## 2. Nguyên tắc BẮT BUỘC: FLAT thức đúng MỖI NẾN H1 ĐÓNG

> **QUY TẮC CỨNG (ADR-005):** Khi cặp KHÔNG có lệnh (FLAT), agents PHẢI thức giấc
> **đúng tại thời điểm mỗi nến H1 đóng** để xem xét tín hiệu. Đây là rule nền tảng,
> không được bỏ qua — vì mọi quyết định ENTRY hợp lệ chỉ xét tại H1 close.

```
H1_close_time  = thời điểm nến H1 hiện tại ĐÓNG (broker)
FLAT: next_wake_at = H1_close_time (bắt buộc)   // + đồng hồ chính xác, không trễ
```

Mục đích: agents không ngủ xuyên suốt H1; **tối thiểu** 1 lần dậy đúng lúc nến đóng.
Các quy tắc C1/C2 bên dưới chỉ là **wake bổ sung** giữa nến (tùy chọn), KHÔNG thay thế
việc thức lúc H1 close.

**Chống trùng lặp (bắt buộc):**
- Mỗi nến H1 chỉ xử lý **1 lần** dựa trên `last_processed_bar_id` lưu trong `PairState`
  (giá trị = `iTime(H1)` của nến đã xử lý).
- Khi wake, nếu `H1_close_time` của nến hiện tại == `last_processed_bar_id` → bỏ qua (đã xử lý).
- Nếu khác → xử lý, rồi cập nhật `last_processed_bar_id`.
- Tránh tình trạng 2 lần wake trong cùng 1 nến mà xử lý tín hiệu 2 lần.

## 3. Công thức thời gian H1

```
H1_open      = time mở nến H1 hiện tại (broker)
H1_close     = H1_open + 1 giờ (đồng hồ nến đóng)
ElapsedInH1  = now - H1_open
H1_mid       = H1_open + 30 minutes
```

## 4. FLAT — quy tắc cố định (C0 bắt buộc + C1 / C2 bổ sung)

| Điều kiện | Wake |
|-----------|------|
| **C0 (BẮT BUỘC)** | **`next_wake_at = H1_close_time`** — thức đúng mỗi nến H1 đóng để xét tín hiệu |
| **C1** (bổ sung) FLAT ∧ `ElapsedInH1 >= 30m` | `next_wake_at = now + 30m` (wake giữa nến, xem xét thêm) |
| **C2** (bổ sung) FLAT ∧ `ElapsedInH1 < 30m` | `next_wake_at = H1_mid` (= H1_open + 30m) |

> Khi không có lệnh, agents hiểu rõ quy tắc: **"mỗi cây H1 đóng thì phải thức giấc"**.
> C1/C2 chỉ là các mốc wake phụ trợ để agents có thể bàn luận sớm hơn — không được
> làm trễ mốc H1 close chính.

**Sau ENTRY thành công:** PairState → NORMAL → chuyển sang quy tắc OPEN (C3).

## 5. OPEN (NORMAL / RECOVERY) — timer dynamic (C3) & DCA timing

> **QUY TẮC TIMING DCA (DEC-09):** Khi đang có lệnh (NORMAL hoặc RECOVERY), Agent A thức theo **C3 dynamic interval** (vài phút/lần). Ở MỖI lần wake C3, nếu `spacing_met == true`, Agent A và B **ĐÁNH GIÁ VÀ XÉT DCA NGAY LẬP TỨC** (không cần chờ H1 close), để không bỏ lỡ nhịp lấp rổ khi giá chạy ngược giữa nến.
>
> Ngược lại, **ENTRY (lệnh đầu) và RECOVERY tín hiệu mạnh (Squeeze)** vẫn neo theo H1 close.

Agent A tự chọn `interval` C3 dựa trên diễn biến thị trường:

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

> Tại mỗi lần wake C3:
> 1. Engine cập nhật `MarketSnapshot` (giá Bid/Ask, `spacing_met`, PnL).
> 2. Nếu `spacing_met` (giá adverse đủ khoảng cách) → Agent A đánh giá DCA ngay, Agent B phản biện. Nếu consensus → enqueue DCA ngay giữa nến.
> 3. Không trì hoãn việc DCA sang H1 close nếu điều kiện giá và bối cảnh đã phù hợp.

## 6. BossWake interrupt

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
A issues WakeRequest theo PairState (C0/C1/C2 khi FLAT; C3 khi OPEN)
```

## 7. Quan hệ wake vs H1 close (phuong_phap)

| Khái niệm | Vai trò |
|-----------|---------|
| Wake cycle | Agents **làm việc** (quan sát, bàn, có thể WAIT) |
| H1 bar close | Điều kiện **hợp lệ** để HardValidator cho phép ENTRY/DCA theo signal nến đóng |

Ví dụ: BossWake giữa H1 → agents bàn được; nếu signal cần nến **đã đóng** mà chưa đóng → plan action=WAIT hoặc chờ close (A set wake đúng `H1_close_time`).

## 8. Pseudocode orchestrator

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

## 9. Chống trùng tín hiệu (last_processed_bar_id)

```
on wake:
  bar_id = iTime(symbol, H1, 0)          // nến H1 hiện tại
  if bar_id == PairState.last_processed_bar_id:
      skip  // đã xử lý nến này rồi
  else:
      process_cycle(...)
      PairState.last_processed_bar_id = bar_id
  // Ghi PairState.update (ADL: dca_<symbol>.db)
```

## 10. Tham số scheduler (design defaults)

| Param | Default | Mô tả |
|-------|---------|--------|
| `FlatWakeOnH1Close` | `true` | C0: bắt buộc thức đúng H1 close khi FLAT (khóa cứng) |
| `FlatWakeAfterMidMinutes` | 30 | C1: +30m sau mốc (bổ sung) |
| `H1MidOffsetMinutes` | 30 | C2: H1_open+30 (bổ sung) |
| `WakeMinSeconds` | 180 | 3m |
| `WakeMaxSeconds` | 3600 | 60m |
| `MaxDebateRounds` | 2 | C4 |