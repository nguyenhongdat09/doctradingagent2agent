# 08 — Map A2A ↔ Phương pháp DCA

Tham chiếu đầy đủ: [`../doc_phuong_phap/`](../doc_phuong_phap/).

## 1. Ai tính rule?

| Rule | Agent A | Agent B | HardValidator |
|------|---------|---------|---------------|
| D1 Context (structure + rails) | Diễn giải LLM + ghi plan | Tự diễn giải độc lập | Enforce swing deterministic + rails + matrix |
| H1 Strength Score + rails | Tính/diễn giải | Tự đánh giá độc lập | Enforce PushEnter 0.6 + matrix |
| Decision matrix (FLAT) | Đề xuất OPEN_* | Có thể REJECT nếu lệch matrix | Enforce matrix |
| Spacing / ladder | Đề xuất DCA lot | Phản biện timing | Enforce spacing & lot step |
| Basket TP NORMAL | Đề xuất CLOSE_ALL | Phản biện | Enforce FavorableSqueeze + TpMoney |
| RECOVERY branches | Đề xuất | Phản biện | Cấm mở ngược; stay RECOVERY đến flat |
| OrderSend | **Thực thi** | — | Gate trước exec |

## 2. Map ActionProposal → PairState transition

| A2A action | Điều kiện phuong_phap | State sau |
|------------|----------------------|-----------|
| ENTRY | FLAT + matrix OPEN | NORMAL |
| DCA | NORMAL + spacing | NORMAL hoặc RECOVERY nếu TotalLot≥R_TH |
| CLOSE_ALL | NORMAL + squeeze + TpMoney | FLAT |
| RECOVERY_DCA | RECOVERY + AdverseSqueeze + spacing | RECOVERY |
| PAYOFF_REDUCE | RECOVERY + FavorableSqueeze | RECOVERY hoặc FLAT nếu lot=0 |
| WAIT | bất kỳ | không đổi |

> **Ghi chú về `ENTER_RECOVERY` & `EXIT_TO_FLAT`:** Trong glossary, 2 mục này là **chuyển trạng thái nội bộ** (state machine transition) do biến động `TotalLot` sau khớp lệnh, không phải hành động gửi qua A2A proposal.

## 3. Tín hiệu vs wake

```
HardValidator cho ENTRY/DCA dựa trên signal:
  dùng H1[1] đã đóng (không repaint) — giống doc_phuong_phap

Wake giữa H1:
  agents được bàn → thường action=WAIT
  hoặc chuẩn bị plan dự kiến chờ close
```

## 4. Tham số không đổi

BeginLot 0.05, TP 30 pip, R_TH 0.3, StrongMult 1.5, Breakout 3, spacing coefs, payoff 15–30% — giữ nguyên [08-parameters](../doc_phuong_phap/08-parameters.md). A2A **không** thay số này trừ khi Boss+config change (ngoài scope thường).

## 5. Global direction lock

Nếu `InpGlobalDirectionLock=true` trong phương pháp: HardValidator từ chối ENTRY ngược `GlobalDir`. B có thể nêu thêm lý do risk.

## 6. Kill-switch

Phuong_phap: thủ công. A2A: Boss/orch emergency → A không OrderSend mới; optional flatten (10).
