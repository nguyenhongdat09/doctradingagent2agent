# 07 — DCA Dual-Review Loop

> **NGUYÊN TẮC BẤT BIẾN (ALL-LLM):** MỌI action thay đổi vị thế — kể cả DCA trong NORMAL — phải qua Agent A đề xuất + Agent B phản biện → consensus → HardPass → enqueue. **Không có DCA tự động** chạy bởi engine.

## 1. Quy tắc & Timing
- **ENTRY:** Neo theo H1 close.
- **DCA (NORMAL & RECOVERY):** Xét tại **MỖI LẦN WAKE C3** (dynamic intra-bar, vài phút/lần) và tại H1 close. Khi `spacing_met == true`, Agent A+B đánh giá và ra quyết định ngay, **KHÔNG chờ H1 close**.
- Từ lệnh thứ 2 trở đi: A phân tích toàn bộ bức tranh → đề xuất action → B ballot → HardPass → **A enqueue** → Executor thực thi.  
- **Cấm** DCA câm / OrderSend trực tiếp / engine tự enqueue.

### 1.1 DCA NORMAL — không phải rule cứng, xét mỗi wake

Engine cung cấp **input** cho LLM ở mỗi wake:
- `spacing_met`: giá adverse đủ spacing? (điều kiện **cần**, KHÔNG đủ)
- `suggested_lot`: lot theo ladder (gợi ý, không bắt buộc)
- `adverse_distance_pips`: khoảng cách thực tế so spacing tối thiểu

Agent A **QUYẾT ĐỊNH NGAY TRONG CYCLE WAKE** có DCA hay WAIT dựa trên toàn bộ bức tranh:
- Spacing đủ? ✅ — nhưng cú ép đang mạnh? → có thể WAIT
- Context D1 vẫn hỗ trợ hướng rổ? Hay đã lật?
- Gần vùng S/R D1 mạnh? Tin tức? Exhaustion?
- MemoryPack có bài học AVOID tương tự? → tuân thủ

→ Đây là **giá trị cốt lõi** của hệ thống: agents suy nghĩ trước khi lấp rổ, và lấp kịp thời giữa nến khi điều kiện đạt.

## 2. Cycle khi có lệnh

```
Wake (C3 hoặc BossWake)
  get_memory_pack → inject vào A+B
  Engine build MarketSnapshot:
    - spacing_met? (flag)
    - basket status (TotalLot, profit, adverse_distance)
    - D1 structure, H1 strength score, DQ flags
  A phân tích snapshot → proposed_action (DCA/WAIT/CLOSE_ALL/PAYOFF_REDUCE)
  HardValidator → B ballot → consensus
  → Nếu consensus: A.enqueue_order(...)
  → Executor MT5
  → Refresh: nếu TotalLot==0 → FLAT → wake C0/C1/C2
  → Trên CLOSE_ALL / exit RECOVERY: submit_feedback / record_lesson
```

## 3. Soft zone H1

`0.4 ≤ strength_final < 0.6` → Agent A/B xem xét trong phân tích; không dùng làm Favorable/Adverse squeeze cho close/DCA recovery; log soft zone; có thể WAIT.

## 4. Ví dụ

### 4.1 DCA NORMAL — agents quyết định
```
Engine: spacing_met=true, suggested_lot=0.10 (ladder step 1)
Agent A: "Spacing đủ (19 pip > 15 min), nhưng Context D1 vẫn UPTREND, rổ BUY
          phù hợp. Giá gần swing low D1 = vùng dip tốt. → Đề xuất DCA BUY 0.10"
Agent B: "Đồng ý. Counter: chuỗi H1 bearish đang mạnh nhưng chưa phá BOS D1.
          → APPROVE"
→ A INSERT PENDING → Executor → TotalLot = 0.15 < 0.3 → vẫn NORMAL
```

### 4.2 DCA NORMAL — agents từ chối
```
Engine: spacing_met=true, suggested_lot=0.10
Agent A: "Spacing đủ nhưng H1 đang streak 5 nến xuống liên tục (DQ_STREAK),
          sát cản D1 mạnh. MemoryPack: [AVOID] streak>4 đâm vào cản → chờ.
          → Đề xuất WAIT"
Agent B: "Đồng ý WAIT. Cú ép chưa kiệt sức."
→ Không enqueue. A set WakeRequest C3 (10 phút)
```

### 4.3 DCA → RECOVERY
```
Agent A đề xuất DCA 0.15 → B APPROVE → A INSERT PENDING
Executor OrderSend 0.15 → TotalLot = 0.05+0.10+0.15 = 0.30 ≥ R_TH → RECOVERY
```

Diagram: [A04](diagrams/A04-dca-dual-review.mmd).
