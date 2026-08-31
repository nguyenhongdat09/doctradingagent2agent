# 08 — Bảng tham số (Inputs) & Default

Tất cả tham số dưới đây sẽ map sang `input` MQL5 ở phase code. Giai đoạn này chỉ khóa **tên logic + default + miền giá trị**.

## 1. Symbols & vận hành

| ID tham số | Kiểu | Default | Mô tả |
|------------|------|---------|--------|
| `InpSymbol1` | string | `AUDCAD` | Cặp 1 (cố định list) |
| `InpSymbol2` | string | `AUDNZD` | Cặp 2 |
| `InpSymbol3` | string | `GBPUSD` | Cặp 3 |
| `InpSymbol4` | string | `NZDCAD` | Cặp 4 |
| `InpMagicBase` | long | `260830` | Magic base; + index cặp |
| `InpGlobalDirectionLock` | bool | `false` | Khóa hướng toàn cục |
| `InpKillSwitch` | bool | `false` | Pause mở lệnh mới |
| `InpKillFlatten` | bool | `false` | Đóng hết khi kill |
| `InpUseCooldown` | bool | `false` | Bật cooldown sau FLAT |
| `InpCooldownH1Bars` | int | `3` | Số nến H1 cooldown |
| `InpAlertOnRecoveryEnterExit` | bool | `true` | Alert vào/ra RECOVERY |
| `InpAlertOnTrade` | bool | `false` | Alert mỗi lệnh |

## 2. D1 Context — Market structure (KHÔNG ADX/EMA)

| ID tham số | Kiểu | Default | Mô tả |
|------------|------|---------|--------|
| `InpSwingRadius` | int | `3` | Bán kính pivot PH/PL |
| `InpMaxSwings` | int | `6` | Số swing giữ tối đa |
| `InpRangeCompressMax` | double | `1.5` | `range ≤ X×ATR14_D1` → nghiêng SIDEWAY |
| `InpDualBreakLookbackBars` | int | `10` | Cửa sổ phá 2 chiều |
| `InpHysteresisNeedTwoSwings` | bool | `true` | Đổi context cần 2 swing cùng dấu |
| `InpHysteresisAllowStrongBOS` | bool | `true` | Đổi ngay nếu BOS ngược mạnh |
| `InpBosStrengthATR` | double | `0.5` | Ngưỡng “BOS mạnh” theo ATR14_D1 |
| `InpAtrPeriodD1` | int | `14` | ATR D1 (nén / BOS strength) |
| `InpSnapshotD1Bars` | int | `30` | Số nến D1 OHLC gửi LLM |
| `InpLlmContextMinConf` | double | `0.55` | Dưới ngưỡng → veto / giữ PrevContext |
| `InpUseLlmContext` | bool | `false` | Phase 1 EA: false; A2A Phase 2: true |

> **Đã loại bỏ:** `InpAdxPeriod/Sideway/Confirm`, `InpEmaFast/Slow` khỏi phân loại bối cảnh.

## 3. H1 Signal — Strength Score (không còn nhị phân thuần)

| ID tham số | Kiểu | Default | Mô tả |
|------------|------|---------|--------|
| `InpAtrPeriod` | int | `14` | ATR H1 |
| `InpStrongMult` | double | `1.5` | `K_S`: body/ATR đạt full điểm momentum |
| `InpMomNormFloor` | double | `0.5` | body/ATR bắt đầu có điểm momentum |
| `InpBreakoutBars` | int | `3` | `N_B` prior high/low |
| `InpH1SwingRadius` | int | `3` | Pivot H1 mini |
| `InpWMom` | double | `0.4` | Trọng số momentum |
| `InpWStr` | double | `0.3` | Trọng số structure/breakout |
| `InpWLoc` | double | `0.2` | Trọng số vị trí vùng |
| `InpWConf` | double | `0.1` | Trọng số xác nhận thân |
| `InpZoneNearATR` | double | `1.5` | Gần swing D1 ≤ X×ATR_D1 |
| `InpDqMult` | double | `0.35` | Nhân score khi trúng disqualifier |
| `InpMaxPushStreak` | int | `4` | DQ: chuỗi nến cùng hướng ≥ 4 |
| `InpPushEnter` | double | `0.6` | Ngưỡng PUSH mạnh cho matrix |
| `InpPushIgnore` | double | `0.4` | Dưới mức → bỏ qua |
| `InpSnapshotH1Bars` | int | `30` | Nến H1 gửi LLM (20–30) |
| `InpUseLlmSignal` | bool | `false` | Phase 1 false; A2A Phase 2 true |
| `InpLlmSignalMinConf` | double | `0.55` | LLM conf thấp → NEUTRAL |

> RSI filter nhị phân cũ **không** còn là điều kiện chính; có thể bỏ hoặc dùng phụ trong Location/Confirm sau này.

## 4. Vốn & lot

| ID tham số | Kiểu | Default | Mô tả |
|------------|------|---------|--------|
| `InpRefCapital` | double | `1000` | Vốn tham chiếu (doc) |
| `InpBeginLot` | double | `0.05` | `L0` lot lệnh đầu |
| `InpLotStep` | double | `0.05` | Bước ladder |
| `InpTpPips` | double | `30` | TP basket NORMAL (pip) |
| `InpRecoveryThresholdLot` | double | `0.3` | `R_TH` vào RECOVERY |
| `InpMaxLot` | double | `0` | `0` = **không trần** |

## 5. Spacing DCA

| ID tham số | Kiểu | Default | Mô tả |
|------------|------|---------|--------|
| `InpSpacingCoefBase` | double | `1.0` | Coef base |
| `InpSpacingCoefNormalMin` | double | `1.2` | NORMAL range min |
| `InpSpacingCoefNormalMax` | double | `1.5` | NORMAL range max |
| `InpSpacingNormalMode` | enum | `FIXED_MID` | `FIXED_MID` → 1.35; hoặc `RANDOM_RANGE` |
| `InpSpacingCoefStrong` | double | `0.7` | Trend mạnh / RECOVERY adverse |
| `InpMinSpacingPips` | double | `15` | Sàn pip tối thiểu |

## 6. RECOVERY payoff

| ID tham số | Kiểu | Default | Mô tả |
|------------|------|---------|--------|
| `InpPayoffLotPct` | double | `0.20` | % TotalLot cho payoff |
| `InpPayoffLotPctMin` | double | `0.15` | Sàn 15% |
| `InpPayoffLotPctMax` | double | `0.30` | Trần 30% |
| `InpRecoveryReduceMode` | enum | `PROFIT_FUNDED_PARTIAL` | Cách cắt loser |
| `InpStayRecoveryUntilFlat` | bool | `true` | Không tụt NORMAL khi lot &lt; R_TH |

## 7. Timeframe (khóa)

| ID tham số | Kiểu | Default | Mô tả |
|------------|------|---------|--------|
| `InpTfContext` | ENUM_TIMEFRAMES | `PERIOD_D1` | Cố định D1 |
| `InpTfSignal` | ENUM_TIMEFRAMES | `PERIOD_H1` | Cố định H1 |

> Implement có thể hard-code D1/H1 thay vì input để tránh lệch spec.

## 8. Bảng tra cứu nhanh (ký hiệu trên diagram)

| Ký hiệu diagram | Tham số | Default |
|-----------------|---------|---------|
| `SW_R` | SwingRadius | 3 |
| `SW_MAX` | MaxSwings | 6 |
| `RC_MAX` | RangeCompressMax | 1.5 |
| `ATR_P` | AtrPeriod | 14 |
| `K_S` | StrongMult full mom | 1.5 |
| `N_B` | BreakoutBars | 3 |
| `P_IN` / `P_IG` | PushEnter / PushIgnore | 0.6 / 0.4 |
| `W_*` | Score weights | 0.4/0.3/0.2/0.1 |
| `L0` | BeginLot | 0.05 |
| `TP` | TpPips | 30 |
| `R_TH` | RecoveryThresholdLot | 0.3 |
| `C_BASE` / `C_NORM` / `C_STR` | Spacing coefs | 1.0 / 1.2–1.5 / 0.7 |
| `S_MIN` | MinSpacingPips | 15 |
| `P_PCT` | PayoffLotPct | 15–30% (0.20) |
| `D1_N` / `H1_N` | Snapshot bars | 30 / 20–30 |

## 9. Validation rules (khi implement input)

```
SwingRadius >= 1
MaxSwings >= 4
RangeCompressMax > 0
BosStrengthATR >= 0
K_S > 0 AND MomNormFloor >= 0 AND MomNormFloor < K_S
N_B >= 1
W_MOM+W_STR+W_LOC+W_CONF ≈ 1.0 (±0.01)
0 < PushIgnore <= PushEnter <= 1
DqMult ∈ (0, 1]
MaxPushStreak >= 2
SnapshotH1Bars >= 20
L0 > 0 AND LotStep > 0
R_TH > L0
S_MIN > 0
C_NORM_MIN <= C_NORM_MAX
0.15 <= P_PCT <= 0.30
MaxLot == 0 OR MaxLot >= L0
SnapshotD1Bars >= 20
LlmContextMinConf ∈ (0, 1]
```
