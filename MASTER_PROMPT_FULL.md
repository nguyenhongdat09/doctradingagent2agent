# ═══════════════════════════════════════════════════════════════════
# MASTER PROMPT — Trading Agent DCA (MT5/Python) — FULL SYSTEM DESIGN
# Dán TOÀN BỘ nội dung này vào Cursor. Đây là bản cập nhật chính thức,
# THAY THẾ mọi phiên bản trước. Chỉ THIẾT KẾ + VẼ DIAGRAM (Mermaid),
# CHƯA code production.
# ═══════════════════════════════════════════════════════════════════

Bạn là kiến trúc sư hệ thống trading. Thiết kế (design doc) + vẽ diagram (Mermaid:
flowchart, stateDiagram, sequenceDiagram, erDiagram) cho hệ thống **Trading Agent DCA
tự động chạy trên MetaTrader 5**, vận hành nhiều cặp FX. GIAI ĐOẠN NÀY CHỈ THIẾT KẾ,
CHƯA viết code. Mọi nhánh quyết định phải ghi rõ điều kiện bằng công thức/ký hiệu tham số.

# ═══════════════════════════════════════════════════════════════════
# PHẦN A — MÔ HÌNH INSTANCE (đã chốt, bất biến)
# ═══════════════════════════════════════════════════════════════════

A1. **1 cặp = 1 instance phần mềm độc lập**, gồm:
    - 2 agents LLM: **Agent A (Planner-Executor)** + **Agent B (Independent Challenger)**
    - 1 **executor thread** (luôn thường trực, là NGƯỜI DUY NHẤT chạm sàn)
    - 1 database SQLite riêng: `dca_<symbol>.db`
    - "Mắt" deterministic engine (Python) tính nến/swing/score
A2. Đa cặp = chạy N instance song song (như bật N phần mềm). **Toàn bộ thiết kế và
    ước lượng chi phí chỉ tính trên 1 cặp**.
A3. Test trước trên **2 cặp** để đo chi phí LLM rồi mới mở rộng: `AUDCAD`, `AUDNZD`
    (sau đó `GBPUSD`, `NZDCAD`).
A4. **Bỏ Global Direction Lock** — mỗi cặp hoàn toàn độc lập.

# ═══════════════════════════════════════════════════════════════════
# PHẦN B — CHIẾN LƯỢC GIAO DỊCH (core, giữ nguyên)
# ═══════════════════════════════════════════════════════════════════

B1. **Khung thời gian:** D1 = bối cảnh trend (bộ lọc chiều), H1 = tín hiệu vào lệnh.
    Duyệt quyết định tại thời điểm **NẾN H1 ĐÓNG** (`H1[1]`), dùng **D1 ĐÃ ĐÓNG**.
    Không repaint: cấm dùng shift 0; pivot chỉ xác nhận sau đủ nến sau.
    Vào lệnh **MARKET ngay khi H1 đóng** khi có tín hiệu + đồng thuận.

B2. **Ma trận quyết định (FLAT → Entry):**
    | D1 Context | H1 PUSH ĐI XUỐNG ≥ 0.6 | H1 PUSH LÊN ≥ 0.6 |
    |------------|--------------------------|---------------------|
    | UPTREND    | **MUA** (buy dip)         | đứng chờ (KHÔNG bán) |
    | DOWNTREND  | đứng chờ (KHÔNG mua)     | **BÁN** (sell rally) |
    | SIDEWAY    | **MUA** (fade đáy)        | **BÁN** (fade đỉnh)  |
    Dưới `strength ≥ 0.6` / NEUTRAL / EXHAUSTION / veto → WAIT.

B3. **Vốn & lot:** Vốn tham chiếu $1,000; `BeginLot=0.05`; `LotStep=0.05` (ladder
    0.05→0.10→0.15→0.20→...); `TP=30 pip` (basket TP NORMAL); `RecoveryThresholdLot=0.3`;
    **KHÔNG trần lot**. Spacing = max(`MinSpacingPips=15`, Coef×ATR14_H1 pip);
    Coef: base 1.0 / NORMAL 1.2–1.5 (default mid 1.35) / strong-trend & RECOVERY 0.7.

B4. **State machine từng cặp:** `FLAT → NORMAL → RECOVERY → FLAT`
    - FLAT: TotalLot=0, chờ matrix entry khi H1 close.
    - NORMAL (0 < TotalLot < 0.3): DCA cùng hướng khi giá đi ngược đủ spacing;
      **CLOSE_ALL** khi có FavorableSqueeze (PUSH thuận ≥ 0.6) và BasketProfit ≥
      TpMoney(=TP_Pips×TotalLot quy đổi); nếu TotalLot ≥ 0.3 → RECOVERY.
    - RECOVERY (TotalLot ≥ 0.3): vòng lặp tới khi sạch — **giữ RECOVERY kể cả khi
      lot tạm < 0.3**; ép NGƯỢC (AdverseSqueeze) → RECOVERY_DCA cùng hướng (spacing
      coef 0.7); ép THUẬN (FavorableSqueeze) → mở **PayoffLot = 15–30% TotalLot**
      (default 20%) cùng hướng → dùng LÃI payoff cắt/REDUCE lệnh lỗ (ưu tiên lỗ nhỏ
      nhất về tiền, partial/full theo profit_pool) → lặp tới khi TotalLot=0 → FLAT.
    - **Cấm trong RECOVERY:** mở hướng ngược, TP kiểu NORMAL, max-drawdown stop,
      tự tụt về NORMAL giữa chừng.
    - **Kill-switch thủ công:** PAUSE (không mở mới) hoặc FLATTEN (đóng hết).

# ═══════════════════════════════════════════════════════════════════
# PHẦN C — D1 CONTEXT: "ĐỌC CẤU TRÚC GIÁ KIỂU MẮT NGƯỜI" (KHÔNG ADX/EMA)
# ═══════════════════════════════════════════════════════════════════

C1. **ĐÔI MẮT (deterministic, Python engine, backtest được):**
    - Pivot High/Low D1 bán kính 3, chỉ confirm sau đủ 3 nến D1 sau; giữ ≤ 6 swing.
    - Feature: `HH/HL/LH/LL`, `last_BOS` (close D1 vượt pivot gần = up/down-BOS),
      `range_compress = |swing_high−swing_low| / ATR14_D1`, `price_vs_pivots`.
    - Rule classify (SAFETY RAILS baseline):
      UPTREND = 2 PH tăng + 2 PL tăng (HH+HL) ∧ chưa down-BOS sau đó;
      DOWNTREND = LH+LL ∧ chưa up-BOS; else SIDEWAY (hoặc range_compress ≤ 1.5×ATR_D1).
    - **Hysteresis:** giữ PrevContext trừ khi có 2 swing cùng dấu liên tiếp,
      hoặc 1 strong BOS ngược (close vượt pivot ≥ 0.5×ATR_D1).

C2. **BỘ NÃO (LLM — Agent A và B, phase 2+):**
    - Input: 30 D1 OHLC đã đóng + swing list (≤6) + features + basket state.
    - Output JSON: `context_d1`, `confidence`, `narrative` (mô tả kiểu trader), `veto`.
    - LLM KHÔNG được tự bịa swing/OHLC — chỉ diễn giải.
    - Quyết định cuối: `ContextFinal = SAFETY_RAILS clamp` (rule C1 + hysteresis,
      LLM chỉ có veto khi confidence thấp).

C3. ATR14_D1 chỉ dùng đo nén / khoảng cách — KHÔNG phân loại context.

# ═══════════════════════════════════════════════════════════════════
# PHẦN D — H1 SIGNAL: STRENGTH SCORE 0–1 (4 thành phần + DQ + LLM)
# ═══════════════════════════════════════════════════════════════════

D1. **ĐÔI MẮT (deterministic):** `strength_score = clamp(Mom+Str+Loc+Conf, 0, 1)`
    - Momentum (0–0.4): body/ATR14_H1, tuyến tính 0.5→1.5 (`K_S=1.5`, floor 0.5).
    - Structure/breakout (0–0.3): Close phá High/Low N=3 nến H1 trước (+0.15) và/hoặc
      swing H1 mini (+0.15).
    - Location (0–0.2, có thể âm): ép thuận context & gần swing D1 (≤1.5×ATR_D1)
      → cộng điểm vùng; ép giữa "hư không" → trừ.
    - Confirm (0–0.1): close gần cực trị thuận (trong 20% range) +0.1; bấc ngược
      ≥0.4×body → trừ / flag reject.
    - **Disqualifiers (DQ):** chuỗi ≥ 4 nến cùng hướng (DQ_STREAK) / ép sát S/R D1
      mạnh chưa breakout (DQ_INTO_D1_WALL) / news — trúng → nhân `DqMult=0.35`
      hoặc hint EXHAUSTION.

D2. **BỘ NÃO (LLM):** input = 20–30 H1 OHLC + score + từng component + DQ + swing H1 +
    position vs swing D1 + ContextFinal + basket. Output JSON: `strength_final`,
    `verdict` (PUSH_UP|PUSH_DOWN|NEUTRAL|EXHAUSTION), `confidence`, `narrative`, `veto`.

D3. **Rails + ngưỡng:** `PUSH` thật sự chỉ khi `strength_final ≥ InpPushEnter=0.6`;
    `< 0.4` → WAIT; LLM veto / EXHAUSTION / confidence thấp → NEUTRAL.

# ═══════════════════════════════════════════════════════════════════
# PHẦN E — KIẾN TRÚC 3 LỚP + LUỒNG XỬ LÝ
# ═══════════════════════════════════════════════════════════════════

E1. **Lớp 1 — Mắt & Execution Engine (deterministic):**
    Python engine tính swing/score/spacing/validator; executor thread là người duy nhất
    gửi lệnh MT5. Chạy được độc lập nếu LLM chết (fallback rules).

E2. **Lớp 2 — Bộ não LLM (Agent A/B + Boss channel):**
    Agents tự quyết; chỉ nhận dữ liệu qua **hàm Python tools**
    (`get_market_snapshot`, `get_structure_features`, `get_h1_strength_score`,
    `get_positions`, `get_account`, `hard_validate`, `order_intent`...).
    **Luôn kéo nến cũ mới nhất** mỗi cycle: D1 30–120, H1 30–200, cache incremental,
    gộp 1 `get_market_snapshot()` (giảm số call → giảm chi phí).

E3. **Lớp 3 — SAFETY RAILS + HardValidator:**
    - HardValidator(plan) bắt buộc PASS trước mọi lệnh (matrix, spacing, ladder,
      RECOVERY cấm ngược hướng, lot khớp bước broker).
    - Không điều chỉnh nào của LLM/Boss được phá rails.
    - Kill-switch luôn có hiệu lực.

E4. **Vòng đời quyết định (mỗi H1 close hoặc wake):**
    refresh positions (MT5 = nguồn chân lý) → `get_market_snapshot()` → A phân tích +
    plan → B ballot độc lập → HardValidator → đồng thuận → INSERT MarketOrderInfo →
    executor đánh lệnh → xóa dòng + archive → cập nhật PairState + AuditLog.

# ═══════════════════════════════════════════════════════════════════
# PHẦN F — SQLite QUEUE & DATABASE (agents ↔ executor)
# ═══════════════════════════════════════════════════════════════════

F1. **Cầu nối duy nhất:** Agents KHÔNG bao giờ OrderSend trực tiếp. Khi đồng thuận,
    ghi **1 dòng PENDING vào `MarketOrderInfo`** → executor poll → claim PROCESSING
    (atomic UPDATE) → OrderSend → thành công: XÓA dòng + lưu Archive; thất bại:
    status=FAILED + error + alert. CLOSE_ALL/PARTIAL_CLOSE cũng qua bảng này.

F2. **Bảng bắt buộc:**
    - `MarketOrderInfo` (hàng đợi): id PK, symbol, instance_id, plan_id UNIQUE,
      action_type (OPEN|DCA|PAYOFF|CLOSE_ALL|PARTIAL_CLOSE), direction, lot,
      target_lot, price_ref, tp_pips, sl, reason, ballot, session_mode,
      status (PENDING→PROCESSING→DONE/FAILED/CANCELLED), created_at, processed_at, error.
    - `MarketOrderInfoArchive` (copy + executed_price, executed_lot, ticket, fill_status,
      fill_error, archived_at).
    - `PairState`: symbol PK, state, context, prev_context, basket_dir, total_lot,
      ladder_step, adverse_ref, last_processed_bar_id (chống trùng tín hiệu),
      cooldown_until_bar, updated_at.
    - `AuditLog`: ts, symbol, event_type, plan_id, ballot_id, hard_pass, decision,
      reason, outcome, extra(JSON).
    - `Plans`: plan_id PK, action, direction, lot, context(JSON), signal(JSON),
      rule_refs, thesis, risks, invalidation, status.
    - `Ballots`: ballot_id PK, plan_id FK, round, decision, thesis, counter_evidence
      (bắt buộc khi APPROVE), agree/dissent/requested_changes (JSON), similarity_score.
    - `Sessions` + `Messages`: hội thoại A/B/Boss (audit + tái tạo quyết định).
    - `LLMRuns`: đo chi phí — run_id, caller (A/B/BOSS), model, provider, tokens in/out,
      cost_usd, latency_ms, purpose, created_at.

F3. **Pragma & triển khai:** `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`;
    mỗi thread dùng connection riêng; claim atomic chống double-execution;
    archive+delete trong 1 transaction; backup định kỳ (VACUUM INTO).
    File DB: `dca_<symbol>.db` mỗi instance.

# ═══════════════════════════════════════════════════════════════════
# PHẦN G — AGENTS A/B + CONSENSUS + BOSS CHANNEL
# ═══════════════════════════════════════════════════════════════════

G1. **Agent A (Planner-Executor):** tự fetch/parse snapshot, phân tích D1+H1, soạn
    `TradePlan`/`ActionProposal`, tranh luận với B (≤ 2 vòng revise/cycle), sau consensus
    ghi vào MarketOrderInfo (KHÔNG OrderSend trực tiếp), set wake.

G2. **Agent B (Challenger):** đánh giá độc lập (không copy A), trả `ReviewBallot` đủ
    thesis + **counter_evidence bắt buộc** + agree/dissent_points; cấm ba phải
    (similarity > 0.85 → INVALID).

G3. **Consensus:** MỌI material action (ENTRY, DCA, RECOVERY_DCA, PAYOFF_REDUCE,
    CLOSE_ALL, PARTIAL_CLOSE) đều cần **A+B đồng thuận + HardValidator PASS**.
    Không có ngoại lệ "A tự quyết" trong RECOVERY ở v1.

G4. **Boss channel (giữ, chỉ BÀN LUẬN):**
    - Boss (user) có thể **interrupt bất kỳ luồng nào** bằng `BossWake` + intent
      (vd: "AUDCAD đang cần DCA mà chưa trade — dậy xem giúp", "GBPUSD có kèo ngon").
    - Mở phiên BOSS: **3 bên trao đổi (Boss–A–B)**, Boss chỉ góp ý/định hướng;
      quyết định cuối luôn là **A+B đồng thuận + HardValidator**.
    - **BossOverride KHÔNG có ở v1** (Boss không thể ép lệnh, không OrderSend trực tiếp).
    - Mọi phiên BOSS ghi Session + Messages + AuditLog.

# ═══════════════════════════════════════════════════════════════════
# PHẦN H — SCHEDULER & WAKE
# ═══════════════════════════════════════════════════════════════════

H1. **FLAT (không lệnh): BẮT BUỘC thức đúng MỖI NẾN H1 ĐÓNG** (rule cứng trong prompt
    của agents). Khi không có lệnh, agents hiểu: H1 đóng → phải thức giấc xem xét.
H2. **NORMAL/RECOVERY: agents TỰ CHỌN lịch** (tự quyết tần suất check giữa nến dựa trên
    biến động/spacing/PnL; vẫn ưu tiên thức lúc H1 close).
H3. **BossWake interrupt luôn thắng** mọi timer (`priority: BossWake > timer > idle`).
H4. Chống trùng: mỗi nến H1 chỉ xử lý 1 lần dựa `last_processed_bar_id`.

# ═══════════════════════════════════════════════════════════════════
# PHẦN I — THAM SỐ & MODEL (config linh hoạt, chưa khóa cứng model)
# ═══════════════════════════════════════════════════════════════════

I1. Cấu hình model qua env/config: `MODEL_A`, `MODEL_B`, `MODEL_BOSS`.
    Model mặc định đề xuất: A = DeepSeek V3 hoặc GPT-4.1-mini (rẻ, JSON tốt);
    B = Claude 3.5 Haiku hoặc Gemini 2.5 Flash (khác provider với A để độc lập);
    `temperature=0.2`, JSON bắt buộc, timeout 20–30s. User sẽ test "GPT-5.6 Luna" và
    các model khác sau; bảng `LLMRuns` để đo chi phí thật.

I2. Bảng tham số đầy đủ (input toàn bộ phần C/D/B): SwingRadius=3, MaxSwings=6,
    RangeCompressMax=1.5, BosStrengthATR=0.5, ATR_Period=14, SnapshotD1=30,
    LlmContextMinConf=0.55, StrongMult=1.5, MomNormFloor=0.5, BreakoutBars=3,
    H1SwingRadius=3, W_Mom=0.4, W_Str=0.3, W_Loc=0.2, W_Conf=0.1 (+ W_LocPenalty),
    ZoneNearATR=1.5, DqMult=0.35, MaxPushStreak=4, PushEnter=0.6, PushIgnore=0.4,
    SnapshotH1=30, LlmSignalMinConf=0.55, BeginLot=0.05, LotStep=0.05, TpPips=30,
    RecoveryThresholdLot=0.3, MaxLot=0 (không trần), SpacingCoefBase=1.0,
    SpacingCoefNormal=1.2–1.5 (default mid 1.35), SpacingCoefStrong=0.7,
    MinSpacingPips=15, PayoffLotPct=0.15–0.30 (default 0.20), StayRecoveryUntilFlat=true,
    AlertOnRecoveryEnterExit=true, UseCooldown=false, CooldownH1Bars=3.
    (Đính kèm validation rules: W tổng ≈ 1.0, PushIgnore ≤ PushEnter, R_TH > L0,
    DqMult ∈ (0,1], LotStep > 0, v.v.)

# ═══════════════════════════════════════════════════════════════════
# PHẦN J — DIAGRAM BẮT BUỘC (Mermaid)
# ═══════════════════════════════════════════════════════════════════

1. **Flowchart tổng thể kiến trúc 1 instance:** mắt engine (nến→swing→score) →
   agents A/B ↔ SQLite ↔ executor ↔ MT5; vị trí safety rails xen giữa; Boss channel
   nhánh riêng.
2. **SequenceDiagram vòng đời quyết định:** H1 close → snapshot → A plan → B ballot →
   HardValidator → INSERT MarketOrderInfo → executor claim+OrderSend → archive/delete →
   update PairState/audit → wake.
3. **SequenceDiagram Boss interrupt:** BossWake → 3 bên bàn → consensus → (vẫn) A+B +
   rails → ghi order → kết thúc phiên BOSS.
4. **State diagram FLAT/NORMAL/RECOVERY** (đủ transition + tham số + note
   "giữ RECOVERY đến khi sạch").
5. **Activity flowchart vòng lặp RECOVERY:** adverse → DCA; favorable → payoff→reduce;
   loop tới TotalLot==0.
6. **Pipeline D1:** D1 OHLC → swing mắt → features → rule + hysteresis → rails
   (+LLM narrative/veto) → ContextFinal.
7. **Pipeline H1:** H1 OHLC → score 4 phần + DQ → rails (+LLM verdict) → Push≥0.6 → matrix.
8. **erDiagram database:** 8 bảng + quan hệ (đủ DDL mô tả cột).
9. **Luồng status MarketOrderInfo:** PENDING→PROCESSING→DONE/FAILED/CANCELLED
   (archive + delete transaction).

Kết thúc bằng: bảng tham số đầy đủ, danh sách "quyết định thiết kế mở" cần user chốt
trước code, và pha triển khai đề xuất (Phase 1 mắt+rules+DB; Phase 2 A/B agents shadow
so sánh; Phase 3 trao quyền consensus; Phase 4 live nhỏ 1 cặp). Sau khi diagram được
duyệt mới sang code.

# ═══════════════════════════════════════════════════════════════════
# PHẦN K — GHI FILE TỰ ĐỘNG VÀO 2 FOLDER (BẮT BUỘC)
# ═══════════════════════════════════════════════════════════════════

K1. KHÔNG chỉ trả lời trong chat. Bạn PHẢI GHI TRỰC TIẾP các file sau VÀO ĐĨA
    theo đúng đường dẫn và cấu trúc bên dưới (tạo thư mục con nếu chưa có).

K2. Thư mục đích (dùng đúng, KHÔNG đổi tên):

    # Folder 1 — phương pháp giao dịch
    D:\TradingAgents\PlanToCode\doc\doc_phuong_phap\
    D:\TradingAgents\PlanToCode\doc\doc_phuong_phap\diagrams\

    # Folder 2 — hệ thống agents A2A
    D:\TradingAgents\PlanToCode\doc\doc_agents\
    D:\TradingAgents\PlanToCode\doc\doc_agents\diagrams\

K3. Danh sách file phải tạo/GHI ĐÈ (giữ nguyên tên file, theo đúng thứ tự số):

    ## doc_phuong_phap (file .md)
    00-glossary.md            — thuật ngữ, ký hiệu, quy ước nến đóng / không repaint / pip
    01-system-overview.md     — triết lý D1/H1, phạm vi, mô hình instance theo cặp, constraints
    02-d1-context.md          — bối cảnh D1: swing/BOS/hysteresis + LLM + safety rails (KHÔNG ADX/EMA)
    03-h1-signal.md           — H1 Strength Score 0-1 (4 thành phần + DQ) + LLM verdict + ngưỡng 0.6
    04-decision-matrix.md     — ma trận FLAT (6 ô) + gates trước MARKET
    05-capital-dca.md         — vốn/ladder lot/spacing/recovery threshold/payoff
    06-state-machine.md       — FLAT → NORMAL → RECOVERY → FLAT (đủ transition + tham số)
    07-recovery-loop.md       — vòng lặp RECOVERY (adverse DCA / favorable payoff reduce)
    08-parameters.md          — bảng tham số + default + validation rules
    09-data-sources.md        — nguồn dữ liệu (nến, snapshot, engines, account)
    10-sqlite-design.md       — DB schema: 8 bảng, cột, CHECK, index, pragma, claim atomic,
                                archive+delete transaction, erDiagram, cạm bẫy đa thread
    11-python-engine-notes.md — ghi chú kiến trúc Python: mắt engine, tools cho agents,
                                executor thread, vòng đời runtime, thứ tự implement, acceptance
    README.md                 — cập nhật mục lục đầy đủ (gồm các file mới 10, 11)

    ## doc_phuong_phap/diagrams (file .mmd — Mermaid source, đặt tên chuẩn)
    D01-lifecycle-cycle.mmd        — vòng đời chu kỳ (tick → H1 close → action)
    D02-pair-state-machine.mmd     — state FLAT/NORMAL/RECOVERY
    D03-recovery-activity.mmd      — activity vòng lặp RECOVERY
    D04-data-architecture.mmd      — sơ đồ dữ liệu/nguồn
    D05-d1-structure-pipeline.mmd  — pipeline D1 (mắt swing → não LLM → rails → context)
    D06-h1-strength-pipeline.mmd   — pipeline H1 (score → LLM → rails → matrix)
    D07-instance-architecture.mmd  — flowchart kiến trúc 1 instance (engine↔agents↔SQLite↔executor↔MT5)
    D08-decision-sequence.mmd      — sequence vòng đời quyết định (H1 close → ... → audit)
    D09-er-diagram.mmd             — erDiagram database (8 bảng + quan hệ)

    ## doc_agents (file .md)
    00-glossary.md            — thuật ngữ A2A (A/B/Boss/ballot/wake/session)
    01-a2a-overview.md        — triết lý 0-human mặc định + Boss exception, mô hình instance
    02-agent-roles.md         — vai trò A / B / Boss / Orchestrator(executor)
    03-consensus-protocol.md  — đồng thuận A+B (mọi action), HardValidator, C1-C4
    04-message-schemas.md     — schema message (Snapshot, TradePlan, Ballot, DcaReview, Wake, Boss*)
    05-scheduler-wakeup.md    — FLAT thức mỗi H1 đóng; OPEN agents tự chọn; BossWake
    06-entry-flow.md          — lệnh đầu: A plan → B ballot → rails → INSERT MarketOrderInfo
    07-dca-dual-review-loop.md — lệnh ≥ 2: dual-review trước mọi DCA/payoff/close
    08-map-to-phuong-phap.md   — map action A2A ↔ FLAT/NORMAL/RECOVERY
    09-runtime-architecture.md — Python orchestrator + executor + tools + audit
    10-autonomy-constraints.md — ràng buộc tự chủ + Boss chỉ bàn luận (không override v1)
    11-boss-interrupt-flow.md   — BossWake → 3 bên bàn → vẫn A+B + rails quyết định
    12-market-data-fetch.md     — agents tự fetch snapshot; mắt vs não; LLMRuns đo chi phí
    README.md                   — cập nhật mục lục đầy đủ

    ## doc_agents/diagrams (file .mmd)
    A01-a2a-sequence.mmd        — sequence A↔B → ghi order → executor
    A02-consensus-state.mmd     — state + BOSS_SESSION
    A03-wakeup-and-monitor.mmd  — scheduler FLAT/OPEN + BossWake
    A04-dca-dual-review.mmd     — dual review trước DCA
    A05-boss-interrupt.mmd      — Boss interrupt → bàn luận → consensus
    A06-d1-context-pipeline.mmd — pipeline D1 cho agents
    A07-h1-strength-pipeline.mmd— pipeline H1 cho agents
    A08-db-queue-flow.mmd       — luồng MarketOrderInfo: PENDING→PROCESSING→DONE/FAILED + archive

K4. Quy tắc ghi file:
    - Mỗi file .md: chuẩn Markdown (bảng, mermaid fence ```mermaid ... ```, code fence).
    - Mỗi file .mmd: CHỈ chứa mã nguồn Mermaid (kèm 1-2 dòng comment đầu giải thích spec ref).
    - GHI ĐÈ file trùng tên (đây là bản chính thức thay thế mọi phiên bản trước).
    - Bảo đảm CÁC FILE THAM CHIẾU CHÉO NHAU ĐÚNG (đường dẫn tương đối ../doc_phuong_phap/...).
    - Sau khi ghi xong, báo cáo trong chat: danh sách file đã tạo/cập nhật + số lượng
      file mỗi folder.
    - Sử dụng đúng, đủ nội dung từ PHẦN A→J ở trên (không cắt xén phạm vi nào).