# 01 — A2A System Overview

## 1. Mục tiêu

Xây hệ thống **Agents-to-Agents** tự chạy giao dịch DCA trên 4 cặp (`AUDCAD`, `AUDNZD`, `GBPUSD`, `NZDCAD`) theo phương pháp đã khóa trong [`doc_phuong_phap`](../doc_phuong_phap/):

- **Mặc định 0-human:** A và B tự quan sát, tranh luận, đồng thuận; **A gửi lệnh** xuống MT5.
- **Boss interrupt (optional):** Bạn có thể prompt đánh thức agents đang ngủ, trao đổi, chốt plan; A vẫn execute.
- **Orchestrator Python:** chỉ timer, bus, ingest Boss — không quyết BUY/SELL.

## 2. Phân tầng trách nhiệm

```
┌──────────────────────────────────────────────────────────┐
│ Boss (optional interrupt)                                 │
└─────────────┬────────────────────────────────────────────┘
              │ BossWake / ACK / Override
┌─────────────▼────────────────────────────────────────────┐
│ Orchestrator (Python): scheduler, bus, session_mode      │
└───────┬─────────────────────────────┬────────────────────┘
        │ wake / messages             │ wake / messages
┌───────▼────────┐             ┌──────▼──────────┐
│ Agent A        │◄──debate──►│ Agent B         │
│ Plan+Execute   │             │ Challenge       │
└───────┬────────┘             └─────────────────┘
        │ OrderSend (tools)
┌───────▼────────┐
│ MT5 / Broker   │
└────────────────┘
        ▲
┌───────┴────────┐
│ HardValidator  │◄── doc_phuong_phap rules
└────────────────┘
```

## 3. Hai chế độ vận hành

| Mode | Khi nào | Điều kiện vào lệnh |
|------|---------|-------------------|
| `AUTO` | Mặc định | HardPass ∧ B.APPROVE → A OrderSend |
| `BOSS` | Sau BossWake | HardPass ∧ BossACK ∧ (B.APPROVE ∨ BossOverride) → A OrderSend |

## 4. Liên kết phương pháp

| Tầng phương pháp | Ai dùng |
|------------------|---------|
| D1 structure swings + SAFETY RAILS (+ LLM não) | A/B diễn giải; HardValidator clamp |
| H1 signal, matrix | A lập plan; B phản biện |
| Spacing, ladder, R_TH, RECOVERY | HardValidator + A đề xuất |
| State FLAT/NORMAL/RECOVERY | Persist; A cập nhật sau fill |

Chi tiết map: [08-map-to-phuong-phap.md](08-map-to-phuong-phap.md).

## 5. Vòng đời mức cao

1. Sleep đến `next_wake_at` **hoặc** BossWake.  
2. A (và B) quan sát market.  
3. A draft plan / proposal.  
4. B ballot độc lập (± Boss hội thoại nếu BOSS).  
5. Consensus / Defer / Override.  
6. Nếu execute-ok → **A OrderSend**.  
7. A set WakeRequest theo C1–C3 → Sleep.

## 6. Phạm vi phase này

| In scope (doc) | Out of scope |
|----------------|--------------|
| Protocol, schema, diagram | Implement LLM prompts production |
| Boss channel design | UI chat đầy đủ |
| Map sang phuong_phap | Code MT5 / backtest |

## 7. Nguyên tắc thiết kế

1. **Single executor:** chỉ A gọi lệnh sàn → audit một điểm.  
2. **Independent challenger:** B phải có `counter_evidence`.  
3. **Hard rules > ý kiến LLM/Boss** (BossOverride không phá HardValidator khi `BOSS_FORCE=false`).  
4. **Interruptible sleep:** BossWake luôn thắng timer.  
5. **Mỗi material action** (entry, DCA, payoff, close basket) cần dual-review (AUTO) hoặc Boss path.
