# GỬI CHO GEMINI — TẠO FOLDER diagram_review (DIAGRAM TRỰC QUAN CHO DEVELOPER KHÔNG CHUYÊN TRADING)

> Copy TOÀN BỘ nội dung từ dòng `---` đến hết, gửi cho Gemini.
> Mục tiêu: tạo 1 thư mục CON NGANG CẤP với `doc` (cùng cấp, nằm cạnh `doc`), tên là
> **`diagram_review`**, chứa các diagram Mermaid CỰC KỲ CHI TIẾT và DỄ HIỂU để một
> developer KHÔNG chuyên về trading đọc vào là hình dung được toàn bộ hệ thống.

---

Bạn là kiến trúc sư hệ thống + chuyên gia UX diagram. Hãy tạo thư mục **`diagram_review`**
ngang cấp với `doc` (nghĩa là: `D:\TradingAgents\PlanToCode\diagram_review\`), dựa trên
TOÀN BỘ các spec trong `doc/` (doc_phuong_phap, doc_agents, doc_experience, doc_flow_code).

## MỤC TIÊU & ĐỐI TƯỢNG
- Người đọc: **developer không chuyên trading** (biết code nhưng không rõ DCA/trend/sideway
  /S/R/swing là gì). Sau khi xem diagram phải HIỂU ĐƯỢC toàn hệ thống hoạt động thế nào.
- Phong cách: **mỗi diagram kèm CHÚ GIẢI bằng lời tiếng Việt** (dưới mỗi file .mmd viết
  thêm file .md hoặc phần chú thích) giải thích: khái niệm trading cần biết, luồng chạy,
  ý nghĩa từng node.
- Diagram phải **chính xác 100% theo spec đã chốt** (ALL-LLM, per-cặp instance, queue,
  FREEZE, DCA timing C3...). Không bịa thêm logic.

## CẤU TRÚC THƯ MỤC diagram_review
```
diagram_review/
├── README.md                    # BẢN ĐỒ (MAP) toàn bộ diagram + thứ tự nên xem
├── 00-trading-101.md            # Giải thích khái niệm trading cho dev: DCA, trend,
│                                #  sideway, R_TH, spread, pip, lot, recovery...
├── 01-helicopter-view.mmd       # TỔNG QUAN 1 BỨC TRANH: toàn hệ thống 1 instance
│                                #  (Market Data -> Mắt -> Snapshot -> A+B -> Queue -> Executor -> MT5)
├── 02-instance-per-pair.mmd     # Vì sao 1 cặp = 1 process (ADR-001), nhiều cặp = nhiều
│                                #  process song song; experience.db dùng chung
├── 03-eyes-engine.mmd           # "Mắt": D1 swing/BOS -> Context; H1 Strength Score -> Signal
├── 04-brain-agents.mmd          # "Não": Agent A lập plan, Agent B phản biện, consensus
├── 05-queue-executor.mmd        # "Tay": MarketOrderInfo queue PENDING->PROCESSING->ARCHIVED
├── 06-state-machine.mmd         # FLAT -> NORMAL -> RECOVERY -> FLAT (giải thích cho dev)
├── 07-dca-and-timing.mmd        # DCA là gì, spacing, vì sao xét DCA mỗi wake C3
├── 08-recovery-loop.mmd         # Vòng cứu lỗ: DCA khi ép ngược, payoff cắt lỗ, về FLAT
├── 09-experience-memory.mmd     # Bộ nhớ kinh nghiệm: bài học -> MemoryPack -> inject A/B
├── 10-freeze-and-reliability.mmd# SYSTEM_FREEZE, auto-resume, reconcile, kill-switch
├── 11-boss-channel.mmd          # Boss góp ý 3 bên, chỉ advisory, không override
├── 12-dataflow-overview.mmd     # Sơ đồ luồng dữ liệu + DB: dca_<symbol>.db vs experience.db
└── 13-sequence-one-cycle.mmd    # Sequence đầy đủ 1 chu kỳ từ wake -> quyết định -> lệnh
```

## YÊU CẦU CHI TIẾT TỪNG FILE

### README.md (Bản đồ + lộ trình đọc)
- Giới thiệu: đây là bộ diagram giúp developer hiểu hệ thống (không cần biết trading).
- Bảng: tên file | nội dung | khái niệm trading cần biết trước | độ dài đọc ~phút.
- Thứ tự đề xuất: 00 -> 01 -> 02 -> 03 -> 06 -> 07 -> 08 -> 05 -> 04 -> 09 -> 10 -> 11 -> 12 -> 13.

### 00-trading-101.md
- Giải thích NGẮN gọn, dễ hiểu các thuật ngữ: Forex pair (AUDCAD...), Lot, Pip, Spread,
  Trend (uptrend/downtrend), Sideway, Swing high/low, BOS (break of structure),
  Support/Resistance (S/R), ATR (độ biến động), DCA (gồm cả "lấp rổ, hạ giá trung bình"),
  Take-profit, Recovery threshold (R_TH=0.3 lot), Payoff. Kèm ví dụ đơn giản bằng số.

### 01-helicopter-view.mmd (flowchart TD — TOÀN HỆ THỐNG 1 BỨC TRANH)
- Từ Market Data (MT5 nến D1/H1) -> "Mắt" (Structure + Signal) -> MarketSnapshot ->
  "Não" (Agent A -> Agent B -> Consensus + HardValidator) -> SQLite Queue ->
  "Tay" Executor -> MT5 Order -> Archive + PairState + Experience feedback.
- Ghi chú bên mỗi cụm: "ĐÂY LÀ BỘ PHẬN GÌ", "AI QUYẾT ĐỊNH", "AI CHỈ THỰC THI".

### 02-instance-per-pair.mmd (flowchart LR)
- Vẽ 2-3 instance (AUDCAD, AUDNZD...) mỗi cái 1 ô lớn (process riêng, DB riêng,
  scheduler/executor/agents riêng) + experience.db DÙNG CHUNG ở giữa.
- Chú thích: chạy `python main.py --symbol AUDCAD`; thêm cặp = thêm process.

### 03-eyes-engine.mmd (flowchart TD)
- Phần a: D1 -> pivot swing -> HH/HL LH/LL -> BOS -> Context (UPTREND/DOWNTREND/SIDEWAY)
  -> Hysteresis -> ContextFinal.
- Phần b: H1 -> Strength Score (Mom 0.4 + Str 0.3 + Loc 0.2 + Conf 0.1) -> DQ (streak,
  D1 wall) -> strength_final; ngưỡng: >=0.6 PUSH, <0.4 ignore, giữa = soft zone WAIT.
- Chú thích bằng lời: "đây là bộ máy tính toán, KHÔNG quyết định lệnh".

### 04-brain-agents.mmd (flowchart/sequence)
- Agent A: nhận snapshot + memory_pack -> phân tích -> TradePlan (ENTRY/DCA/CLOSE/PAYOFF/WAIT).
- Agent B: tự phân tích độc lập -> ReviewBallot (APPROVE/CHALLENGE/VETO) + counter_evidence.
- Vòng lặp: CHALLENGE ≤ 2 vòng -> consensus -> HardValidator 5 checks -> ENQUEUE.
- Nêu rõ: "Không có DCA tự động; AGENTS quyết định mọi thứ (ALL-LLM)".

### 05-queue-executor.mmd (stateDiagram/flowchart)
- Vòng đời row: PENDING -> (atomic claim) PROCESSING -> OrderSend
  -> thành công: Archive + xóa row + update PairState; thất bại: FAILED + alert.
- Chú thích: "sao chỉ 1 executor claim được 1 row" (atomic UPDATE), "tránh đánh 2 lần".

### 06-state-machine.mmd (stateDiagram-v2) — GIẢI THÍCH CHO DEV
- FLAT (không lệnh, chờ H1 close) -> NORMAL (có 1 rổ < 0.3 lot, có thể DCA/close)
  -> RECOVERY (tổng lot >= 0.3, vòng cứu lỗ) -> FLAT.
- Chú thích: TOTAL_LOT là gì, vì sao 0.3 (R_TH), vì sao RECOVERY giữ đến khi sạch.

### 07-dca-and-timing.mmd (flowchart/sequence)
- DCA = đánh thêm lệnh cùng hướng khi giá đi ngược khoảng Spacing (tính từ ATR).
- Timing: ENTRY neo H1 close; DCA xét MỖI wake C3 (intra-bar) khi spacing_met, A+B
  quyết định ngay (không chờ H1 close) — vì sao (DEC-09).
- Vẽ luôn C0/C1/C2/C3 scheduler mini.

### 08-recovery-loop.mmd (flowchart TD) — VÒNG CỨU LỖ
- Adverse squeeze -> RECOVERY_DCA (thêm cùng hướng). Favorable squeeze -> mở PayoffLot
  (15-30% TotalLot) -> dùng lãi payoff cắt lệnh lỗ nhỏ nhất (partial/full) -> giảm TotalLot
  -> lặp -> TotalLot==0 -> FLAT.
- Chú thích cho dev: "payoff là con bài tạm thời để kiếm lãi nhanh cắt lỗ".

### 09-experience-memory.mmd (flowchart)
- Sau lệnh đóng -> evaluate -> record_lesson (AVOID/PREFER/WARNING, dedupe)
  -> invalidate cache -> MemoryPack Builder (T1 profile ≤150 token + T2 top6 ≤350 token)
  -> get_memory_pack -> inject A/B trước quyết định -> LessonFeedback -> update stats.
- Chú thích: "bộ não rút kinh nghiệm, ≤500 token để rẻ".

### 10-freeze-and-reliability.mmd (flowchart)
- LLM down -> FREEZE (giữ lệnh, alert Boss, không auto-degrade) -> retry backoff ->
  LLM hồi -> auto-resume + light reconcile.
- Kèm: MT5 disconnect, startup reconcile, kill-switch thủ công.

### 11-boss-channel.mmd (sequence)
- BossWake -> 3 bên bàn (≤12 turn) -> Boss chỉ góp ý -> vẫn cần A approve + HardValidator
  -> enqueue. Không BossOverride. Chú thích "Boss không bấm lệnh, không ép".

### 12-dataflow-overview.mmd (flowchart LR + ghi chú DB)
- Vẽ quan hệ: MT5 <-> Mắt <-> Agents <-> experience.db (chung) <-> dca_<symbol>.db (riêng)
  <-> Executor <-> MT5. Kèm bảng liệt kê 9 bảng dca_<symbol>.db + 4 bảng experience.db
  (1 dòng mô tả mỗi bảng).

### 13-sequence-one-cycle.mmd (sequenceDiagram — ĐẦY ĐỦ, CHI TIẾT)
- Sequence từ Scheduler wake -> Engine build snapshot -> Agent A (get_memory_pack -> plan)
  -> HardValidator -> Agent B (memory + ballot) -> consensus -> INSERT queue ->
  Executor claim -> MT5 -> archive -> update PairState + LLMRuns (ghi token/$) ->
  set next wake. Đánh số bước (autonumber) để dev dễ theo dõi.

## QUY TẮC CHUNG
1. Mỗi file `.mmd` PHẢI kèm 1 file `.md` cùng tên (vd `01-helicopter-view.md`) HOẶC chú
   thích ngay đầu file (comment + mục "Giải thích") — nên làm cả 2: comment trong .mmd +
   file .md giải thích chi tiết.
2. Trong mỗi node/label: dùng tiếng Việt ngắn gọn + giữ tên kỹ thuật (Agent A, HardValidator,
   MarketOrderInfo, R_TH, TotalLot...) để dev map được với code.
3. Ghi rõ TRÁCH NHIỆM mỗi thành phần: ✅ quyết định (LLM), 🔧 tính toán (engine mắt),
   ⚙️ thực thi (executor), 👤 góp ý (boss).
4. KHỚP 100% spec: ALL-LLM, per-cặp, queue-only, FREEZE, DEC-09 DCA timing, R_TH=0.3,
   L0=0.05, TP=30, payoff 15-30%, memory ≤500 token, HardValidator 5 checks, C0/C1/C2/C3,
   Boss advisory.

## SAU KHI XONG
Báo cáo: danh sách file đã tạo trong `diagram_review/` + xác nhận từng file đã kèm chú
thích tiếng Việt + 1 câu "đã sẵn sàng để developer đọc hiểu & code".