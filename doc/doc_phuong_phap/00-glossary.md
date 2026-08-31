# 00 — Glossary & Quy ước

## 1. Thuật ngữ nghiệp vụ

| Thuật ngữ | Ký hiệu / Alias | Định nghĩa |
|-----------|-----------------|------------|
| Cặp tiền | `Symbol` | Một trong: `AUDCAD`, `AUDNZD`, `GBPUSD`, `NZDCAD` |
| Bối cảnh D1 | `Context` | `SIDEWAY` \| `UPTREND` \| `DOWNTREND` |
| Tín hiệu H1 | `Signal` / `Push` | `PUSH_UP` \| `PUSH_DOWN` \| `NEUTRAL` \| `EXHAUSTION` (+ `strength_final` 0–1) |
| Hướng rổ | `BasketDir` | `BUY` \| `SELL` \| `NONE` (FLAT) |
| Tổng lot cặp | `TotalLot` | Σ volume các position cùng magic+symbol còn mở |
| Khoảng cách DCA | `Spacing` | Khoảng giá tối thiểu (pip) giữa entry mới và giá bất lợi nhất của rổ |
| Ngưỡng recovery | `RecoveryThresholdLot` | Default `0.3` lot — khi `TotalLot ≥` ngưỡng → state RECOVERY |
| Lệnh khởi đầu | `BeginLot` | Lot lệnh đầu khi FLAT → NORMAL (default `0.05`) |
| Lệnh DCA | `DcaLot` | Lot theo ladder bậc kế tiếp |
| Lệnh payoff | `PayoffLot` | Lot lệnh thuận chiều trong RECOVERY để lấy lãi cắt lỗ (15–30% `TotalLot`) |
| Lãi rổ | `BasketProfit` | Tổng floating P/L (account currency) của mọi position cặp |
| Mục tiêu chốt NORMAL | `BasketTpMoney` | Tương đương `TP_Pips × TotalLot` quy đổi tiền |
| Kill-switch | `KillSwitch` | Cờ thủ công: pause agent và/hoặc đóng toàn bộ lệnh |
| Cooldown | `CooldownBars` | Số nến H1 tối thiểu sau khi về FLAT trước khi được mở lại |

## 2. Ký hiệu giá & nến

| Ký hiệu | Nghĩa |
|---------|--------|
| `O`, `H`, `L`, `C` | Open, High, Low, Close của nến đang xét |
| `Bar[i]` | Nến tại shift `i` (MT5: `i=0` đang chạy, `i=1` vừa đóng) |
| `H1[1]` | Nến H1 **vừa đóng** — nguồn tín hiệu duy nhất |
| `D1[1]` | Nến D1 **đã đóng** gần nhất — nguồn context duy nhất |
| `ATR14_H1` | ATR(14) trên H1, shift 1 — spacing / signal body |
| `ATR14_D1` | ATR(14) trên D1, shift 1 — đo range nén; **không** quyết context đơn lẻ |
| `Swing PH/PL` | Pivot High/Low D1 bán kính 3, confirmed sau 3 nến sau |
| `BOS` | Structure break: close D1 vượt PH gần (up) hoặc dưới PL gần (down) |
| `RSI14_H1` | RSI(14) trên H1, shift 1 (optional filter signal) |
| `Pip` | Đơn vị giá chuẩn hóa theo symbol (xem quy ước pip bên dưới) |
| `Point` | `_Point` của symbol MT5 |

## 3. Quy ước thời điểm & không repaint (BẮT BUỘC)

```
OnTick / OnTimer
  └─ Chỉ chạy Decision Cycle khi: NewBar_H1 == true
       ├─ Swings/Features := f(D1 closed bars)     // deterministic mắt
       ├─ Context := SAFETY_RAILS(Rule ± LLM)     // KHÔNG ADX/EMA
       ├─ Signal  := f(H1[1], ATR @ shift 1)
       └─ Action  := StateMachine(Context, Signal, Positions)
```

| Quy tắc | Chi tiết |
|---------|----------|
| Trigger | Quyết định **chỉ** tại thời điểm nến H1 **đóng** |
| Context | Cấu trúc giá D1 đã đóng (+ LLM diễn giải optional); clamp SAFETY RAILS |
| Signal | Luôn đọc H1 **vừa đóng** (`shift = 1`) |
| Không repaint | Cấm D1/H1 `shift = 0`; pivot chỉ confirm sau đủ nến sau |
| Entry | MARKET ngay khi cycle xác nhận hành động ENTRY |

## 4. Quy ước pip

| Nhóm symbol | Digits điển hình | 1 pip |
|-------------|------------------|-------|
| `GBPUSD` (xxxUSD majors) | 5 | `10 × Point` (0.0001) |
| `AUDCAD`, `AUDNZD`, `NZDCAD` (cross) | 5 | `10 × Point` (0.0001) |

Công thức chuẩn trong doc:

```
PriceToPips(delta) = |delta| / PipSize
ATR_Pips = ATR14_H1 / PipSize
```

`PipSize` cấu hình theo symbol (hoặc auto-detect từ Digits).

## 5. Trạng thái cặp (Pair State)

| State | Điều kiện nhận diện | Ý nghĩa |
|-------|---------------------|---------|
| `FLAT` | `TotalLot == 0` | Không có lệnh; chờ tín hiệu |
| `NORMAL` | `0 < TotalLot < RecoveryThresholdLot` | DCA + TP kiểu basket |
| `RECOVERY` | `TotalLot ≥ RecoveryThresholdLot` | Vòng recovery tới khi sạch |

> Edge: nếu broker khớp làm `TotalLot` nhảy qua ngưỡng trong một lệnh DCA → chuyển **RECOVERY ngay** trong cùng cycle (sau khi lệnh được xác nhận).

## 6. Hướng & tín hiệu

| Enum | Giá trị |
|------|---------|
| `BasketDir` | `BUY`, `SELL`, `NONE` |
| `Signal` | `PUSH_UP`, `PUSH_DOWN`, `NEUTRAL`, `EXHAUSTION` |
| `Context` | `SIDEWAY`, `UPTREND`, `DOWNTREND` |
| `Action` | `WAIT`, `OPEN_BUY`, `OPEN_SELL`, `DCA`, `CLOSE_ALL`, `PARTIAL_CLOSE`, `RECOVERY_DCA`, `PAYOFF_REDUCE`, `ENTER_RECOVERY`, `EXIT_TO_FLAT` |

Map queue: `OPEN_*`→`OPEN`, `PAYOFF_REDUCE`→`PAYOFF`/`PARTIAL_CLOSE` (xem [doc_agents/00-glossary](../doc_agents/00-glossary.md)).

> Alias cũ `STRONG_*` chỉ còn ghi chú lịch sử trong [03](03-h1-signal.md) §7 — không dùng trong schema mới.

## 7. Magic / isolation

| Khái niệm | Quy ước thiết kế |
|-----------|------------------|
| Magic number | Mỗi EA instance / mỗi cặp có magic riêng (hoặc base magic + symbol index) |
| Comment | Prefix cố định ví dụ `DCA|AUDCAD|NORMAL|L2` để audit |
| Isolation | Agent chỉ quản lý position do chính nó mở (filter magic + symbol) |

## 8. Viết tắt tham số (xem đầy đủ ở 08-parameters.md)

| Alias ngắn | Tham số đầy đủ | Default |
|------------|----------------|---------|
| `SW_R` | `InpSwingRadius` | 3 |
| `SW_MAX` | `InpMaxSwings` | 6 |
| `RC_MAX` | `InpRangeCompressMax` | 1.5 |
| `ATR_P` | ATR period (D1/H1) | 14 |
| `K_S` | `InpStrongMult` (full momentum) | 1.5 |
| `N_B` | `InpBreakoutBars` | 3 |
| `P_IN` / `P_IG` | PushEnter / PushIgnore | 0.6 / 0.4 |
| `L0` | `InpBeginLot` | 0.05 |
| `TP` | `InpTpPips` | 30 |
| `R_TH` | `InpRecoveryThresholdLot` | 0.3 |
| `S_MIN` | `InpMinSpacingPips` | 15 |
| `D1_N` / `H1_N` | Snapshot bars | 30 / 20–30 |
