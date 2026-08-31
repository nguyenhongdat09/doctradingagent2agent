# 07 — Master Checklist & Tiêu Chuẩn Nghiệm Thu (Definition of Done)

> Tài liệu này tổng hợp toàn bộ các tiêu chí kiểm tra (Checklists) và định nghĩa hoàn thành (**Definition of Done - DoD**) cho từng giai đoạn phát triển và trước khi đưa hệ thống lên tài khoản Live thực tế.

---

## 📋 1. Master Checklist Theo Từng Phase

### Phase 1: Nền Tảng Cơ Sở (Database, MT5, Engine Mắt, Executor)
- [ ] Khởi tạo 4 file DB riêng cho 4 cặp + cấu hình PRAGMA WAL, busy_timeout=5000, synchronous=FULL, đủ 9 bảng (kèm `LLMRuns`).
- [ ] Hoàn thành wrapper `MetaTrader5`, đảm bảo chỉ đọc nến đã đóng (`shift >= 1`), không repaint, retry nhẹ khi requote, comment đúng format.
- [ ] Hoàn thành `StructureEngine` tách 3 submodules: PivotDetector, StructureFeatures, ContextClassifier (Hysteresis).
- [ ] Hoàn thành `SignalEngine` tách 2 submodules: StrengthScore (4 thành phần), Disqualifiers.
- [ ] Hoàn thành `PositionMetrics`: SpacingCalculator, LadderCalculator, BasketMetrics.
- [ ] Hoàn thành `HardValidator`: 5 checks an toàn tuyệt đối, chặn đứng 100% lệnh vi phạm.
- [ ] Hoàn thành `ExecutorThread`: Polling, Atomic Claim, OrderSend/Close, Archive transaction.
- [ ] Đạt $100\%$ Unit Tests cho Structure, Signal, HardValidator, và Queue concurrent claims.

### Phase 2: Hệ Thống Kinh Nghiệm (Experience DB & MemoryPack)
- [ ] Khởi tạo `experience.db` dùng chung với 4 bảng: `Lessons`, `MemoryCache`, `PairProfiles`, `LessonFeedback`.
- [ ] Hoàn thành `MemoryPackBuilder`: Render chuỗi Markdown 2 tầng (Profile/Evergreen + Top 6 dynamic), dung lượng $\le 500$ tokens.
- [ ] Hoàn thành `Scoring`: Xếp hạng bài học chính xác theo Severity, tần suất, mức độ tương thích và Time Decay.
- [ ] Hoàn thành `LessonWriter`: Single-writer an toàn, Deduplication SHA256, tự động Invalidate MemoryCache khi có bài học mới.
- [ ] Đạt $100\%$ Integration Tests cho Memory Cache Hit/Miss và Deduplication.

### Phase 3: Hệ Thống Multi-Agent & Đồng Thuận (A2A & Boss)
- [ ] Hoàn thành `LLMProvider` layer: DeepSeek, OpenAI, Anthropic, bóc tách JSON Pydantic, ghi log bắt buộc vào bảng `LLMRuns`.
- [ ] Hoàn thành `AgentAPlanner`: System prompt chuẩn, luận giải như trader thực thụ, đề xuất `TradePlan`.
- [ ] Hoàn thành `AgentBChallenger`: System prompt phản biện độc lập, bắt lỗi AVOID, bắt buộc có `counter_evidence`.
- [ ] Hoàn thành `ConsensusEngine`: Vòng tranh luận tối đa 2 vòng, chỉ enqueue khi có `B.APPROVE + HardValidator.PASS`.
- [ ] Hoàn thành `BossChannel`: Tiếp nhận `BossWake`, thảo luận 3 bên tối đa 12 lượt, tuyệt đối không cho phép BossOverride.
- [ ] Vượt qua $10/10$ Scenarios kiểm thử quyết định của LLM trong `tests/scenarios/test_llm_decisions.py`.

### Phase 4: Bộ Điều Phối & Độ Tin Cậy Vận Hành (Orchestrator & Reliability)
- [ ] Hoàn thành `SingleSymbolRunner`: 1 process chạy 1 symbol độc lập (ADR-001) qua CLI `--symbol <SYM>`.
- [ ] Hoàn thành `Scheduler`: Thức giấc tại H1 Close + 1-2s buffer (C0), thức linh hoạt giữa nến (C1/C2), và thức chu kỳ động (C3).
- [ ] Hoàn thành `DCA Timing`: Tại mỗi lần wake C3, nếu `spacing_met == true` $\rightarrow$ Agent A+B đánh giá và ra quyết định DCA ngay giữa nến.
- [ ] Hoàn thành `SYSTEM_FREEZE`: Khi LLM sập $\rightarrow$ Tự động đóng băng toàn bộ, phát `ALERT_LLM_OUTAGE`, giữ nguyên lệnh, không auto-degrade.
- [ ] Hoàn thành `Auto-Resume & Light Reconcile`: Khi LLM phục hồi $\rightarrow$ Tự động resume kèm so khớp trạng thái MT5 vs DB.
- [ ] Hoàn thành `StartupReconcile`: Khởi động lại hệ thống sau crash $\rightarrow$ Tự động đồng bộ trạng thái từ MT5, dọn dẹp hàng đợi rác.
- [ ] Hoàn thành `Monitoring`: Ghi nhận Heartbeat, cảnh báo MT5 disconnect, cảnh báo Queue backlog $> 5$ lệnh.

### Phase 5: E2E Replay, Paper Trading Demo & Triển Khai
- [ ] Chạy bộ công cụ **Historical Replay Harness** qua 3 tháng dữ liệu lịch sử $\rightarrow$ Đạt $0$ lỗi vi phạm phương pháp.
- [ ] Vận hành thử nghiệm trên **MT5 Demo liên tục 14 ngày** $\rightarrow$ Không có unhandled exceptions, đã trải qua freeze/resume an toàn, chi phí token $\le \$0.20/\text{ngày}$.
- [ ] Thiết lập Windows Service (NSSM) trên VPS, tự động chạy khi máy tính khởi động lại.
- [ ] Thiết lập backup tự động database hàng ngày.

---

## 🏆 2. Tiêu Chuẩn Hoàn Thành (Definition of Done - DoD)

Một task/feature trong codebase chỉ được coi là **HOÀN THÀNH (DONE)** khi thỏa mãn tất cả các điều kiện sau:

1. **Code Quality:**
   - Mã nguồn được viết bằng Python 3.11+, định kiểu đầy đủ (Type hints) trên 100% các hàm và phương thức.
   - Không có cảnh báo linter (`flake8`, `ruff`, hoặc `mypy` không báo lỗi nghiêm trọng).
   - Tên biến, hàm, class tuân thủ quy ước đặt tên trong tài liệu thiết kế.
2. **Kiểm Thử (Testing):**
   - Mọi logic tính toán toán học (Swing, Score, Spacing) đều có Unit Test với độ bao phủ (coverage) $\ge 90\%$.
   - Mọi thay đổi về database đều có Integration Test xác nhận tính toàn vẹn (Transactions, Foreign Keys).
   - Chạy toàn bộ test suite `pytest` vượt qua 100% (`All tests passed`).
3. **Tài Liệu & Log:**
   - Cập nhật tài liệu nếu có thay đổi về tham số hoặc schema.
   - Bổ sung log vết rõ ràng tại các điểm rẽ nhánh quan trọng.

---

## 🚀 3. Pre-Flight Checklist — Trước Khi Bật Chế Độ Live (Real Capital)

Trước khi chuyển cờ từ Demo sang tài khoản Live tiền thật, Operator và Lead Developer bắt buộc phải cùng rà soát bảng kiểm duyệt này:

| # | Hạng mục kiểm tra | Trạng thái |
|---|---|:---:|
| 1 | **Tài khoản MT5 Live:** Đã nạp vốn tham chiếu ($1,000 USD), đã kiểm tra đòn bẩy ($\ge 1:100$), cho phép Automated Trading. | [ ] |
| 2 | **Khóa an toàn:** Magic Base (`InpMagicBase`) không trùng lặp với bất kỳ EA/hệ thống nào khác trên cùng tài khoản. | [ ] |
| 3 | **Cấu hình API LLM:** API Key của DeepSeek / OpenAI đã nạp đủ số dư trả trước (prepaid credit $\ge \$10$), không bị khóa rate limit. | [ ] |
| 4 | **Hạ tầng VPS:** VPS đặt tại Datacenter gần máy chủ Broker (Latency $\le 20\text{ms}$), Windows Update đã tắt tự động reboot đột ngột. | [ ] |
| 5 | **Kênh Cảnh Báo:** Telegram / Boss Channel Bot đã gửi thử nghiệm tin nhắn cảnh báo thành công tới điện thoại của Boss. | [ ] |
| 6 | **Kill-Switch Sẵn Sàng:** Nút bấm Kill-Switch thủ công hoạt động chuẩn xác, có khả năng đóng toàn bộ lệnh khi khẩn cấp. | [ ] |
| 7 | **Database Sạch:** 4 file database `dca_<symbol>.db` được khởi tạo mới hoàn toàn, trạng thái ban đầu là `FLAT`, `TotalLot = 0`. | [ ] |
| 8 | **Hồ Sơ Kinh Nghiệm:** Database `experience.db` đã nạp đầy đủ Profile của 4 cặp tiền và các bài học cốt lõi ban đầu. | [ ] |

---

## 🔍 4. Bảng Đối Chiếu Chéo Đồng Nhất Tài Liệu (Cross-Doc Consistency Check)

Bảng kiểm soát chất lượng tài liệu trước khi bắt đầu code:

| # | Tiêu chí đối chiếu chéo | Trạng thái |
|---|---|:---:|
| 1 | **Mô hình Per-Symbol (ADR-001):** Không còn bất kỳ file nào mô tả "1 process chạy tuần tự 4 cặp". Toàn bộ tài liệu thống nhất 1 Symbol = 1 Process độc lập. | [x] Đã khớp |
| 2 | **Đồng nhất thuật ngữ & Schema:** `doc_flow_code` khớp hoàn toàn với `doc_phuong_phap`, `doc_agents`, `doc_experience` (tên module, models, enums, submodules). | [x] Đã khớp |
| 3 | **Diagrams chuẩn ALL-LLM:** Cả 7 diagrams (`D01`, `D02`, `D03`, `D08`, `A01`, `A03`, `A04`) đều vẽ đúng quy trình A+B consensus, không còn nhánh DCA tự động kiểu EA. | [x] Đã khớp |
| 4 | **Số bảng Database SQLite:** Thống nhất chính xác 9 bảng cho instance database (đã có đầy đủ bảng `LLMRuns` đo chi phí token). | [x] Đã khớp |
| 5 | **Timing DCA & Scheduler:** Ghi rõ C0 bắt buộc (H1 close + 1-2s buffer) và C3 dynamic wake xét DCA ngay khi `spacing_met` (DEC-09). | [x] Đã khớp |
| 6 | **SYSTEM_FREEZE & Concurrency:** Ghi rõ cơ chế đóng băng khi LLM sập (không auto-degrade) + Auto-resume Light Reconcile + Single-writer cho `experience.db`. | [x] Đã khớp |
