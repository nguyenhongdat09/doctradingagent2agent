# GỬI CHO CLAUDE — NÂNG CẤP KIẾN TRÚC CODE SENIOR + SỬA DIAGRAM + FIX (doc_flow_code)

> Copy TOÀN BỘ nội dung từ dòng `---` đến hết, gửi cho Claude.
> Lệnh: cập nhật `doc_flow_code` + **2 file diagram lỗi thời** theo đúng nội dung dưới đây.

---

Tôi cần bạn cập nhật với các nhóm thay đổi: **(0) Sửa 2 diagram lỗi thời**,
**(A) Nguyên tắc kiến trúc senior**, **(B) Fix mô hình chạy per-cặp (ADR-001)**,
**(C) Fix schema bảng `LLMRuns` + các điểm kỹ thuật nhỏ**.
Làm theo thứ tự, báo lại file đã sửa + tóm tắt nội dung.

═══════════════════════════════════════════
(0) SỬA 2 DIAGRAM LỖI THỜI (CHƯA THEO ALL-LLM) — BẮT BUỘC
═══════════════════════════════════════════

### (0.1) `doc_phuong_phap/diagrams/D01-lifecycle-cycle.mmd` — VẪN MÂU THUẪN ALL-LLM

Các lỗi hiện tại:
- `NormDca{"Adverse_price_ge_Spacing?..."} -->|Yes| DoDca["DCA_same_dir_Lot_LadderStep_plus_1"]`
  → Vẫn vẽ **DCA tự động theo spacing** — phải sửa thành: spacing chỉ là INPUT cho Agent
  A+B; DCA xảy ra CHỈ SAU `A+B consensus → HardValidator PASS → enqueue → Executor`.
- `FlatGates{"..."} -->|Yes| OpenBegin["MARKET_BeginLot_L0_0.05..."]`
  → Thiếu bước A+B consensus trước entry — phải thêm.
- Nhánh RECOVERY `Run_RecoveryActivity` không thấy A+B — phải làm rõ mọi action qua A+B.
- Header dòng "Spec refs" nên thêm `ERRATA.md` (ALL-LLM, DEC-09).

Yêu cầu cập nhật D01:
- DCA NORMAL: node = "C3_wake_or_H1close → spacing_met (input) → A+B consensus →
  HardValidator PASS → ENQUEUE DCA → Executor → TotalLot≥0.3? → RECOVERY".
- ENTRY: node = "Matrix action → A+B consensus → HardValidator PASS → ENQUEUE → Executor".
- RECOVERY: node = "Adverse/Favorable squeeze + A+B consensus → HardValidator PASS →
  enqueue (RECOVERY_DCA / PAYOFF_REDUCE)".
- Giữ nguyên phần Mắt (Structure/Signal) + NEW_H1.

### (0.2) `doc_agents/diagrams/A03-wakeup-and-monitor.mmd` — THIẾU C0 + DCA timing

Các lỗi hiện tại:
- FLAT chỉ có C1 (+30m) / C2 (H1_open+30m) — **THIẾU C0 bắt buộc thức đúng H1 close**
  (rule cứng: "mỗi cây H1 đóng phải thức giấc").
- NORMAL/RECOVERY nhánh C3 chưa thể hiện DCA timing (xét DCA ngay mỗi wake C3 khi
  spacing_met).

Yêu cầu cập nhật A03:
- FLAT: thêm nhánh **C0 = WakeRequest(H1_close_time) BẮT BUỘC** (ưu tiên trên C1/C2);
  C1/C2 chỉ là wake bổ trợ giữa nến.
- NORMAL/RECOVERY: node C3 thể hiện rõ "tại mỗi wake C3: nếu spacing_met → kích hoạt
  A+B đánh giá DCA ngay (DEC-09), không chờ H1 close".
- Cập nhật header spec refs thêm `05-scheduler-wakeup.md` + ERRATA.

═══════════════════════════════════════════
(A) NGUYÊN TẮC KIẾN TRÚC CODE SENIOR (BẮT BUỘC ÁP DỤNG TOÀN BỘ doc_flow_code)
═══════════════════════════════════════════

Mục tiêu: thiết kế codebase như senior engineer thực thụ — FILE NHỎ, LOGIC TÁCH RIÊNG
BIỆT, KHÔNG GỘP CHUNG, DỄ MỞ RỘNG & DỄ BẢO TRÌ về sau. Các nguyên tắc:

1. **Single Responsibility per file/module:** Mỗi file chỉ làm ĐÚNG 1 việc, có tên rõ
   mục đích. Cấm gộp nhiều logic vào 1 file lớn (chống "god module").

2. **Phân tầng nghiêm ngặt, không import chéo vòng (no circular imports):**
   - Orchestrator Layer → Agent Layer → Engine Layer → Database Layer → Executor.
   - Chỉ giao tiếp qua Data Models (Pydantic) / Interface rõ ràng. Không gọi tầng dưới
     lên tầng trên trái phép (ví dụ Engine KHÔNG gọi Agent, Executor KHÔNG gọi Agent).

3. **File nhỏ, mỗi thư mục có `__init__.py` re-export gọn (public API):**
   - Dùng "Facade" nhẹ ở mỗi package: `from engine import structure_engine, signal_engine`.
   - Người dùng package không cần biết đường dẫn file sâu bên trong.

4. **Dependency Injection (DI) + Config-driven:**
   - Đối tượng nhận dependency qua constructor (DB connection, MT5 adapter, LLM client,
     logger...), KHÔNG tạo trực tiếp bên trong (dễ test = mock).
   - Toàn bộ tham số từ `config/default_config.yaml` + `symbols.yaml` (per-symbol
     override). Không hard-code số.

5. **Dễ mở rộng (Extensibility):**
   - **Thêm cặp mới** = thêm 1 block config trong `symbols.yaml` + chạy thêm 1 process
     (mô hình per-cặp, xem B) — KHÔNG sửa code core.
   - **Thêm engine/chỉ báo/chiến lược mới** = thêm module trong `engine/` + đăng ký trong
     factory, KHÔNG sửa logic agents.
   - **Thêm provider LLM mới** = thêm adapter trong `agents/llm/providers/`, dùng chung
     interface `LLMClient`.
   - **Thêm action mới** = thêm enum + validator + 1 handler riêng, không đụng các action khác.

6. **Typing + Protocol/ABC:** Dùng `Protocol`/`ABC` cho các interface chính
   (DataProvider, OrderExecutor, LessonWriter, LLMProvider) để dễ swap implementation.

7. **Cấu trúc cập nhật (gợi ý — áp dụng cho 01-architecture):**
```
src/
  main.py                     # entrypoint: parse --symbol, load config, boot instance
  core/
    constants.py              # Enum: State, Context, Verdict, ActionType, BallotDecision
    models.py                 # Pydantic: Snapshot, TradePlan, ReviewBallot, QueueRow
    config.py                 # Pydantic Settings load YAML (default + symbols override)
    logging_setup.py          # loguru / logging config (audit + system)
  database/
    connection.py             # SQLite pool, WAL pragmas
    repositories/
      market_order_repo.py    # MarketOrderInfo queue: insert, claim, archive, cancel
      pair_state_repo.py
      audit_repo.py
      plans_repo.py
      ballots_repo.py
      sessions_repo.py
      llm_runs_repo.py
    experience_repo.py        # Lessons, MemoryCache, PairProfiles, LessonFeedback
  engine/
    data/
      mt5_adapter.py          # wrapper MetaTrader5 (rates, account, positions, order_send)
    structure/
      pivot_detector.py
      structure_features.py   # HH/HL, BOS, range_compress
      context_classifier.py   # RuleClassify + Hysteresis
    signal/
      strength_score.py       # 4 thành phần + DQ + soft zone
      disqualifiers.py
    position/
      spacing_calculator.py
      ladder_calculator.py
      basket_metrics.py       # TotalLot, BasketProfit, AdverseRef
    snapshot_builder.py
    hard_validator.py         # 5 checks
  experience/
    scoring.py
    memory_pack_builder.py
    lesson_writer.py          # single-writer + dedupe + invalidate
  agents/
    llm/
      base.py                 # Protocol LLMProvider
      openai_client.py
      deepseek_client.py
      anthropic_client.py
      json_parser.py          # parse/validate Pydantic + retry
    agent_a/
      planner.py
      prompts.py
    agent_b/
      challenger.py
      prompts.py
    consensus.py
    boss/
      boss_channel.py
      boss_wake_handlers.py
  orchestrator/
    scheduler.py              # C0-C3 per symbol
    freeze_monitor.py
    startup.py
    reconcile.py
    monitoring.py
    main_runner.py            # boot 1 instance (1 cặp) — KHÔNG chạy 4 cặp chung
tests/
  unit/ engine/ signal/ structure/
  unit/ experience/ agents/
  integration/ db/ queue/ executor/
  scenarios/ test_llm_decisions.py
  mocks/ mt5_mock.py llm_mock.py
```

═══════════════════════════════════════════
(B) FIX #1 — MÔ HÌNH CHẠY PER-CẶP (đúng ADR-001)
═══════════════════════════════════════════

**Vấn đề:** `doc_flow_code` hiện viết "1 process chạy 4 cặp tuần tự" (`main_runner.py`
duyệt 4 symbol). Điều này MÂU THUẪN với **ADR-001: 1 cặp = 1 instance phần mềm độc lập**
(1 process, 1 DB, 1 scheduler riêng — đa cặp = chạy N process như bật N phần mềm).

**Yêu cầu sửa:**
1. `src/main.py`: entrypoint nhận `--symbol AUDCAD` (hoặc `--all` để spawn N child process).
   - Mỗi process: load config riêng cho 1 symbol, mở 1 `dca_<symbol>.db`, 1 scheduler,
     1 freeze_monitor, 1 executor thread.
2. `orchestrator/main_runner.py`: chỉ quản lý **1 instance/cặp** (vòng loop 1 symbol),
   KHÔNG duyệt 4 symbol trong cùng process.
3. Cập nhật `05-phase-4` + `01-architecture` cho khớp:
   - Deployment: chạy `python main.py --symbol AUDCAD --symbol AUDNZD ...` (hoặc supervisor
     spawn từng tiến trình). Mỗi cặp độc lập, crash 1 cặp không ảnh hưởng cặp khác.
4. `symbols.yaml` là nguồn cấu hình per-cặp (magic, lot, spread profile...).
5. Ghi chú rõ trong README/architecture: "Scale thêm cặp = thêm config + 1 process, không sửa core".

**Lý do:** cô lập lỗi, dễ scale, đúng tuyên bố "1 cặp = 1 phần mềm" của chủ dự án.

═══════════════════════════════════════════
(C) FIX #2 — BẢNG LLMRuns + ĐIỂM KỸ THUẬT NHỎ
═══════════════════════════════════════════

**Vấn đề 1 — LLMRuns thiếu rõ ràng trong schema:**
- `10-sqlite-design.md` nói "8 bảng" nhưng liệt kê 9 (MarketOrderInfo, Archive, PairState,
  AuditLog, Plans, Ballots, Sessions, Messages, LLMRuns).
- Phase 1 (02) cũng liệt kê "8 bảng" nhưng gồm LLMRuns.
- **Yêu cầu:** Thống nhất danh sách bảng (ghi rõ N bảng). Bổ sung đầy đủ cột cho
  `LLMRuns`: run_id, symbol, session_id, caller (A/B/BOSS), model, provider,
  prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, purpose,
  created_at. LLMRuns là BẮT BUỘC vì dùng đo chi phí (DEC-08/ADR-008).

**Vấn đề 2 — `synchronous = NORMAL`:**
- Nên dùng `synchronous = FULL` mặc định (WAL + FULL an toàn nhất cho dữ liệu lệnh).
  Nếu muốn performance có thể để NORMAL nhưng ghi rõ đánh đổi.

**Vấn đề 3 — Scheduler "thức đúng từng giây H1 close":**
- Đổi thành "thức tại H1_close_time + buffer 1-2s" (tránh trễ do đồng hồ/latency),
  và chống trùng bằng `last_processed_bar_id` (đã có).

**Vấn đề 4 — MT5 `order_send` cần:**
- Retry nhẹ (1-2 lần) khi requote; đặt `COMMENT = "DCA|SYM|STATE|S{step}"`; normalize lot
  theo `SYMBOL_VOLUME_STEP`; kiểm tra `retcode` đầy đủ.

═══════════════════════════════════════════
YÊU CẦU BÁO CÁO
═══════════════════════════════════════════

1. Danh sách file đã sửa/tạo: `D01-lifecycle-cycle.mmd`, `A03-wakeup-and-monitor.mmd`,
   `doc_flow_code` (các file), `10-sqlite-design.md` (nếu đổi).
2. Bản cập nhật file tree (mục A) — phải là cây thư mục đầy đủ, mỗi file 1 câu mô tả.
3. Xác nhận đã áp dụng (0) diagrams, (B) per-cặp + (C) LLMRuns/synchronous/buffer/comment.
4. Nêu câu hỏi mở (nếu có) trước khi sang code.