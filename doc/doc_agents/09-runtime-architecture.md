# 09 — Runtime Architecture

> **NGUYÊN TẮC BẤT BIẾN (ALL-LLM):** Engine = mắt (cảm biến + máy tính). LLM A+B = não (người quyết định duy nhất). Executor = tay (thực thi cơ khí). **Không có rule cứng tự động ra lệnh.**

## 1. Thành phần

```
Boss → Orchestrator (scheduler, bus, HardValidator, FREEZE monitor)
         ├─ Agent A (plan, enqueue)         ← NÃO quyết định
         ├─ Agent B (ballot)                ← NÃO phản biện
         ├─ Engine / Mắt (snapshot, score)  ← CẢM BIẾN dữ liệu
         ├─ ExperienceDB tools (memory pack / lessons)
         ├─ SQLite dca_<symbol>.db (MarketOrderInfo + state)
         └─ Executor Thread → MT5 Adapter   ← TAY thực thi
```

## 2. Phân tầng rõ ràng

| Thành phần | Vai trò | Được làm | KHÔNG được làm |
|---|---|---|---|
| **Engine (mắt)** | Cảm biến + máy tính | Tính swing, BOS, strength score, spacing, snapshot; đặt flag `spacing_met`, `favorable_squeeze`; gợi ý lot/action | **Enqueue lệnh**, quyết định BUY/SELL, tự ra lệnh |
| **LLM A+B (não)** | Người quyết định duy nhất | Phân tích snapshot → đề xuất action → phản biện → consensus → enqueue | Gọi OrderSend trực tiếp |
| **Executor (tay)** | Thực thi cơ khí | Claim PENDING → OrderSend/Close MT5 → Archive/FAILED | Sinh plan, sửa lot/hướng, quyết định |
| **Orchestrator** | Điều phối | Wake, bus, session_mode, HardValidator gate, FREEZE monitor, audit | Chọn hướng lệnh, enqueue thay A |

## 3. Orchestrator

Wake/Boss interrupt; message bus; HardValidator **trước** cho phép enqueue; audit; **FREEZE monitor** (phát hiện LLM outage → SYSTEM_FREEZE + alert Boss).  
**Không** OrderSend; **không** chọn hướng; **không** tự enqueue.

### 3.1 FREEZE Monitor

```
Trước mỗi cycle:
  if not can_reach_llm():
    SYSTEM_FREEZE = true
    emit AlertLlmOutage(...)
    skip agent cycle — giữ nguyên mọi position
    retry sau interval (exponential backoff)
  else:
    SYSTEM_FREEZE = false
    proceed agent cycle bình thường
```

## 4. Tools Agent A

| Tool | Mục đích |
|------|----------|
| `fetch_bars` / `fetch_more` | OHLC |
| `get_structure_features` | D1 swings — **dữ liệu cho A phân tích** |
| `get_h1_strength_score` | Score + DQ — **dữ liệu cho A phân tích** |
| `build_market_snapshot` | Snapshot LLM (bao gồm spacing_met, favorable flags) |
| `get_memory_pack` | Experience MemoryPack |
| `record_lesson` / `submit_feedback` / `evaluate` | Experience loop |
| `get_positions` / `get_account` | Basket / margin |
| `hard_validate` | Pre-check (safety gate — KHÔNG thay consensus) |
| `enqueue_order(...)` | INSERT `MarketOrderInfo` PENDING — **chỉ sau consensus** |
| `set_wake` | Scheduler |
| `escalate_to_boss` | Gửi câu hỏi cho Boss qua Telegram khi mơ hồ (uncertainty > 0.6). Trả về `BossAdvisory` hoặc timeout signal sau 30 phút |

**Không có** `order_send` trên Agent A/B.  
**Không có** tool nào cho phép engine tự enqueue.

Agent B: đọc market + memory + validate + **`escalate_to_boss`** khi mơ hồ — không enqueue.

## 5. Executor

Poll PENDING → atomic claim PROCESSING → OrderSend/Close → success: delete + Archive; fail: FAILED + alert.  
Executor **chỉ** thực thi lệnh đã được A+B consensus + HardPass. Không tự sinh lệnh.

## 6. Multi-symbol / audit / failure

Per-symbol DB + wake; audit JSONL; FAILED không đổi state giả; reconnect MT5 không enqueue mới đến khi healthy.

## 7. Luồng dữ liệu đầy đủ

```
Market data (MT5 API)
  → Engine (mắt): tính swing, BOS, strength score, spacing, snapshot
     → Output: MarketSnapshot (dữ liệu thuần, không quyết định)
  → Orchestrator: nạp snapshot + MemoryPack → gửi Agent A+B
  → Agent A (não): phân tích + đề xuất action
  → Agent B (não): phản biện độc lập + ballot
  → Consensus + HardValidator
  → A.enqueue_order(...) → SQLite queue
  → Executor (tay): claim → MT5 OrderSend → Archive/FAILED
```

> Không có đường tắt nào từ Engine → SQLite queue mà bỏ qua LLM A+B.
