# 01 — A2A System Overview

## 1. Mục tiêu

Xây hệ thống **Agents-to-Agents** tự chạy giao dịch DCA trên 4 cặp (`AUDCAD`, `AUDNZD`, `GBPUSD`, `NZDCAD`) theo [`doc_phuong_phap`](../doc_phuong_phap/):

- **Mặc định 0-human:** A và B quan sát, tranh luận, đồng thuận; **A chỉ INSERT** lệnh vào SQLite queue.
- **Executor Thread** (thường trực) claim `MarketOrderInfo` → OrderSend MT5 → Archive/FAILED.
- **Boss interrupt (v1):** `BossWake` + bàn luận 3 bên; **không** Override — quyết định cuối luôn A+B + HardValidator.
- **Orchestrator Python:** timer, bus, ingest Boss — không quyết BUY/SELL.

## 2. Phân tầng trách nhiệm

```
┌──────────────────────────────────────────────────────────┐
│ Boss (optional): BossWake + bàn luận — KHÔNG override v1 │
└─────────────┬────────────────────────────────────────────┘
              │ BossWake / BossACK (góp ý)
┌─────────────▼────────────────────────────────────────────┐
│ Orchestrator: scheduler, bus, session_mode, HardValidator│
└───────┬─────────────────────────────┬────────────────────┘
        │                             │
┌───────▼────────┐             ┌──────▼──────────┐
│ Agent A        │◄──debate──►│ Agent B         │
│ Planner        │             │ Challenger      │
└───────┬────────┘             └─────────────────┘
        │ INSERT MarketOrderInfo (PENDING)
┌───────▼────────┐
│ SQLite dca_*.db│
└───────┬────────┘
        │ Executor claim → PROCESSING
┌───────▼────────┐
│ Executor Thread│── OrderSend / Close ──► MT5
└────────────────┘
```

## 3. Hai chế độ vận hành

| Mode | Khi nào | Điều kiện ghi queue |
|------|---------|---------------------|
| `AUTO` | Mặc định | HardPass ∧ B.APPROVE → A INSERT `MarketOrderInfo` |
| `BOSS` | Sau BossWake | HardPass ∧ B.APPROVE (Boss chỉ bàn; **không** Override) → A INSERT |

Nếu B dissent trong BOSS → **DEFER** (kể cả khi Boss muốn đi tiếp).

## 4. Liên kết phương pháp

| Tầng | Ai dùng |
|------|---------|
| D1 structure + SAFETY RAILS | A/B + HardValidator |
| H1 Strength Score / PUSH≥0.6 | A/B + HardValidator |
| Spacing, ladder, RECOVERY | HardValidator + A đề xuất |
| Experience MemoryPack | A/B trước plan; feedback sau đóng lệnh — [`../doc_experience/`](../doc_experience/) |

## 5. Vòng đời mức cao

1. Sleep đến `next_wake_at` **hoặc** BossWake.  
2. `get_memory_pack` → A/B.  
3. A quan sát + draft plan.  
4. B ballot (± Boss chat nếu BOSS).  
5. Consensus / Defer (không Override).  
6. HardPass → **A INSERT queue** → Executor OrderSend.  
7. Sau đóng lệnh: `submit_feedback` / `record_lesson`.  
8. A set WakeRequest → Sleep.

## 6. SAFETY RAILS vs HardValidator

Xem mục chung trong [`../doc_phuong_phap/01-system-overview.md`](../doc_phuong_phap/01-system-overview.md) § Safety.

Tóm tắt:
- **HardValidator** = 5 checks deterministic trong engine (matrix, spacing/ladder, RECOVERY no reverse, NormalizeLot, kill-switch).
- **SAFETY RAILS** = khái niệm bao trùm (HardValidator + hysteresis + ngưỡng PUSH 0.6 + soft-zone WAIT).

## 7. Nguyên tắc thiết kế

1. **Queue-only:** Agents không OrderSend trực tiếp.  
2. **Single writer lệnh sàn:** chỉ Executor Thread.  
3. **Independent challenger:** B có `counter_evidence`.  
4. **Boss v1 advisory only.**  
5. Mọi material action cần dual-review (AUTO) hoặc hội đồng Boss (vẫn cần A+B).  
