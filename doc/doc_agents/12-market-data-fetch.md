# 12 — Market Data Fetch & LLM Snapshot

Agents **tự lấy** nến/chỉ báo cần thiết theo tầng — không chờ orchestrator nhét sẵn cả chart.

Tham chiếu: D1 [`../doc_phuong_phap/02-d1-context.md`](../doc_phuong_phap/02-d1-context.md); H1 [`../doc_phuong_phap/03-h1-signal.md`](../doc_phuong_phap/03-h1-signal.md).

## 1. Pipeline mỗi cycle (A và B độc lập)

```
Wake
 → (1) Fetch D1 batch
 → (2) Nhận / yêu cầu StructureEngine features (swings deterministic)
 → (3) Phân tích bối cảnh D1 (LLM diễn giải + rails)
 → (4) Fetch H1 batch + tính Strength Score (mắt) + ATR14_H1
 → (5) LLM diễn giải strength_final / verdict (Phase 2) → rails
 → (6) Nếu chưa đủ tin cậy → fetch_more (có trần)
 → (7) Lập TradePlan / Ballot
```

## 2. Lượng nến mặc định

| Tầng | Batch đầu | Expand | Max | Ghi chú |
|------|-----------|--------|-----|---------|
| D1 OHLC closed | **30** | +30 | 120 | Snapshot LLM context |
| D1 StructureEngine buffer | **max(60, …)** | — | 300 | Swing confirm |
| H1 OHLC closed | **20–30** (default **30**) | +20 | 200 | Score + LLM push |
| H1 swing mini | radius 3, ≤6 | — | — | Thành phần structure score |
| ATR14_H1 / ATR14_D1 | trên cửa sổ | — | — | Momentum / zone |

`exclude_forming = true` luôn (không lấy nến đang chạy).

## 3. Tools

| Tool | Mô tả |
|------|--------|
| `fetch_bars(symbol, tf, count, exclude_forming=true)` | OHLC đóng |
| `get_structure_features(symbol)` | swings≤6, HH/HL, BOS, range_compress — **deterministic** |
| `get_h1_strength_score(symbol)` | Score 0–1 + components + DQ flags — deterministic |
| `fetch_indicators(symbol, tf, names[], count)` | ATR… |
| `fetch_more(symbol, tf, add_count, reason)` | Chỉ khi dưới max và `fetch_rounds < MaxFetchRounds` (default 3) |
| `build_market_snapshot(symbol)` | Gói snapshot mục 4 |
| `get_data_coverage(symbol)` | Đã cache bao nhiêu bar |

## 4. MarketSnapshot gửi LLM (mỗi H1 close / mỗi wake phân tích)

1. **30** nến D1 OHLC đã đóng (mới nhất)  
2. **20–30** nến H1 OHLC đã đóng (mới nhất)  
3. Danh sách swing D1 ≤ 6 (loại / giá / thời gian) — EA tính  
4. Đặc trưng: HH/HL/LH/LL, BOS gần nhất, range nén vs ATR14_D1  
5. Trạng thái rổ: hướng, TotalLot, số lệnh, P/L, state FLAT/NORMAL/RECOVERY  
6. ATR14_H1 + **H1 strength_score + từng thành phần + DQ**  
7. Tin tức/event nếu có  

## 5. Khi nào fetch_more

| Lý do (`reason`) | Hành động |
|------------------|-----------|
| `d1_structure_unclear` | +D1 bars |
| `h1_score_borderline` | +H1 bars (score gần 0.4–0.6) |
| `h1_need_more_structure` | +H1 bars |
| `llm_low_confidence` | +D1 hoặc +H1 một lần; nếu vẫn thấp → WAIT |

## 6. Vai trò mắt vs não (D1 + H1)

| | Mắt (deterministic) | Não (LLM) |
|--|---------------------|-----------|
| D1 | Swing, BOS, features | Narrative context + veto |
| H1 | Strength Score 4 phần + DQ | strength_final, verdict, EXHAUSTION veto |
| Cấm | — | Bịa OHLC/swing; bỏ rails |

## 7. A vs B

- Cùng raw snapshot/features/score (cache MT5).  
- Phân tích độc lập.  
- HardValidator: ContextFinal + Push ≥ 0.6 + matrix.

## 8. Chèn vào entry flow

`MDA → ContextFinal + H1 score/rails → Matrix → Plan`

Diagrams: [A06](diagrams/A06-d1-context-pipeline.mmd), [A07-h1-strength-pipeline.mmd](diagrams/A07-h1-strength-pipeline.mmd).
