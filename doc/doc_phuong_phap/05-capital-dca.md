# 05 — Capital Management & DCA

## 1. Tham chiếu vốn

| Hạng mục | Giá trị default | Ghi chú |
|----------|-----------------|---------|
| Vốn tham chiếu | `$1,000` | Baseline thiết kế lot (không auto-scale trừ khi sau này thêm) |
| Begin lot `L0` | `0.05` | Lệnh đầu khi FLAT → NORMAL |
| TP mặc định | `30` pip | Dùng cho mục tiêu basket NORMAL |
| Recovery threshold `R_TH` | `0.3` lot | `TotalLot ≥ 0.3` → RECOVERY |
| Max lot ceiling | **Không có** | Ladder tăng không trần |

## 2. Ladder lot (bậc cố định)

```
Step k = 0, 1, 2, 3, 4, ...
Lot(k) = L0 + k × LotStep
LotStep = 0.05   // InpLotStep

Ví dụ:
  k=0 → 0.05
  k=1 → 0.10
  k=2 → 0.15
  k=3 → 0.20
  k=4 → 0.25
  k=5 → 0.30
  ...
```

| Sự kiện | Cập nhật `LadderStep` |
|---------|------------------------|
| OPEN Begin | `LadderStep = 0`, lot = `Lot(0)` |
| Mỗi DCA thành công (NORMAL hoặc RECOVERY_DCA) | `LadderStep += 1`, lot = `Lot(LadderStep)` |
| Về FLAT | reset `LadderStep = 0` |

> **Không** có `MaxLot`. Broker vẫn có volume max riêng — nếu `OrderSend` fail do volume, log + alert, không đổi state giả.

## 3. Spacing (khoảng cách DCA)

### 3.1 Công thức

```
ATR_Pips = ATR14_H1[1] / PipSize

Coef = SelectSpacingCoef(Context, StructureFeatures, State)

SpacingPips = max( InpMinSpacingPips, Coef × ATR_Pips )
              // InpMinSpacingPips default = 15

SpacingPrice = SpacingPips × PipSize
```

### 3.2 Chọn hệ số Coef

| Tình huống | Coef | Default |
|------------|------|---------|
| Base / tham chiếu | `InpSpacingCoefBase` | `1.0` |
| State NORMAL, không strong-trend | mid/range `[InpSpacingCoefNormalMin, InpSpacingCoefNormalMax]` | `1.2 – 1.5` |
| Strong trend: `Context ∈ {UPTREND,DOWNTREND}` ∧ BOS cùng hướng ∧ `range_compress > InpRangeCompressMax` | `InpSpacingCoefStrong` | `0.7` |
| RECOVERY DCA adverse | **Strong `0.7`** (dense khi ép ngược) | `0.7` |

> Strong-trend **không** còn dựa ADX — xem [02-d1-context.md](02-d1-context.md) §7.

**Quyết định thiết kế cho NORMAL coef trong khoảng 1.2–1.5:**

```
InpSpacingNormalMode = FIXED_MID | RANDOM_RANGE
  FIXED_MID (default): Coef = (Min+Max)/2 = 1.35
  RANDOM_RANGE: Coef ~ Uniform(Min, Max) mỗi lần tính spacing (seed theo bar)
```

### 3.3 Điều kiện kích hoạt DCA theo giá

Với rổ hướng `BUY`:

```
// DCA khi giá đi XUỐNG đủ xa so với giá vào BẤT LỢI nhất của rổ
AdverseRef = min_i OpenPrice_i     // giá mua thấp nhất (worst-case buy entry)
Trigger DCA BUY khi: Bid <= AdverseRef - SpacingPrice
```

Với rổ hướng `SELL`:

```
AdverseRef = max_i OpenPrice_i
Trigger DCA SELL khi: Ask >= AdverseRef + SpacingPrice
```

> DCA chỉ cùng `BasketDir`. Không hedged.

## 4. Mục tiêu chốt NORMAL (Basket TP)

Không gắn TP từng lệnh riêng (hoặc TP ảo); chốt **cả rổ** khi:

```
FavorableSqueeze = Push thuận BasketDir với strength_final ≥ InpPushEnter
                   (BUY + PUSH_UP) OR (SELL + PUSH_DOWN)

BasketTpMoney ≈ ValueOfPips(TP_Pips × TotalLot)
  // quy đổi: TP_Pips * TotalLot * pip_value_per_lot

CLOSE_ALL khi:
  State == NORMAL
  AND FavorableSqueeze
  AND BasketProfit >= BasketTpMoney
```

`BasketProfit` = tổng floating profit (và optionally swap) của mọi position magic+symbol.

## 5. Recovery threshold & chuyển state

```
Sau mỗi lần thay đổi vị thế (open/DCA/partial/close):
  TotalLot = Σ volume

  nếu TotalLot == 0 → State = FLAT
  else nếu TotalLot >= R_TH (0.3) → State = RECOVERY (+ alert enter nếu vừa chuyển)
  else → State = NORMAL
```

Khi lệnh DCA trong NORMAL làm `TotalLot` từ `< 0.3` lên `≥ 0.3` → **sang RECOVERY ngay** trong cùng chu kỳ cập nhật.

## 6. Payoff lot trong RECOVERY

```
PayoffLot = clamp(
  TotalLot × InpPayoffLotPct,           // pct trong [0.15, 0.30]
  broker_min_lot,
  broker_max_lot_for_symbol
)

InpPayoffLotPct default = 0.20          // giữa 15–30%
InpPayoffLotPctMin = 0.15
InpPayoffLotPctMax = 0.30
```

Payoff **cùng hướng** `BasketDir` (thuận) khi có ép thuận — dùng lãi để partial close lệnh lỗ nhỏ nhất. Chi tiết: [07-recovery-loop.md](07-recovery-loop.md).

## 7. Bảng tóm tắt số liệu mặc định

| Tham số | Default |
|---------|---------|
| Ref capital | 1000 USD |
| BeginLot | 0.05 |
| LotStep | 0.05 |
| Ladder | 0.05 → 0.10 → 0.15 → 0.20 → 0.25 → … |
| TP_Pips | 30 |
| RecoveryThresholdLot | 0.3 |
| SpacingCoef Base / Normal / Strong | 1.0 / 1.2–1.5 / 0.7 |
| MinSpacingPips | 15 |
| PayoffLotPct | 15–30% (default 20%) |
| MaxLot | *(none)* |

## 8. Ví dụ minh họa (NORMAL)

```
Begin BUY 0.05 @ 1.00000
SpacingPips = max(15, 1.35 × ATR_Pips)  giả sử = 18 pip
Giá giảm → Bid <= 0.99820 → DCA BUY 0.10
TotalLot = 0.15 < 0.3 → vẫn NORMAL
...
DCA tới TotalLot = 0.30 → RECOVERY
```
