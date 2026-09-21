# 04 — Phase 3: Hệ Thống Multi-Agent & Giao Thức Đồng Thuận (A2A & Boss Channel)

> **Mục tiêu Phase 3:** Xây dựng "Bộ não" LLM cho hệ thống giao dịch, chia nhỏ thành các module nhà cung cấp LLM độc lập (DeepSeek, OpenAI, Anthropic), Agent A (Planner), Agent B (Challenger), bộ phân tích định dạng có cấu trúc (Structured JSON Parser), giao thức đồng thuận tranh luận (Consensus Protocol $\le 2$ vòng) và kênh tương tác với Boss (Advisory only).

---

## 📦 1. Các Module Cần Viết Trong Phase 3 (Senior Modular Layout)

### Module 3.1: LLM Provider Layer (`src/agents/llm/`)
- **Protocol Interface (`src/agents/llm/base.py`):**
  ```python
  from typing import Protocol, Type
  from pydantic import BaseModel

  class ILLMProvider(Protocol):
      async def generate_structured(
          self, prompt: str, system_prompt: str, response_model: Type[BaseModel]
      ) -> BaseModel: ...
  ```
- **Các Client Nhà Cung Cấp Riêng Biệt:**
  1. `deepseek_client.py`: Tương tác với DeepSeek-V3 API (Mặc định cho môi trường Production vì chi phí siêu rẻ).
  2. `openai_client.py`: Tương tác với OpenAI API (`gpt-4o-mini`, `gpt-4o`).
  3. `anthropic_client.py`: Tương tác với Anthropic API (`claude-3-5-sonnet`).
- **Structured JSON Parser & Retry (`src/agents/llm/json_parser.py`):**
  - Ép schema Pydantic v2.
  - Nếu parse JSON lỗi $\rightarrow$ Tự động retry 1 lần kèm thông báo lỗi cụ thể để LLM tự sửa.
  - Nếu tiếp tục lỗi hoặc gặp mã lỗi 5xx/Timeout $\rightarrow$ Kích hoạt `SYSTEM_FREEZE`.
  - **Ghi nhận chi phí token bắt buộc:** Mọi lượt gọi LLM đều gọi `llm_runs_repo.log_run()` để ghi lại `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd`, `latency_ms` vào bảng `LLMRuns`.

### Module 3.2: Agent A — Planner (`src/agents/agent_a/`)
- **`prompts.py`:** Lưu trữ System Prompt và Template prompt cho Agent A (Xem [14-llm-prompt-spec.md](../doc_agents/14-llm-prompt-spec.md) — gồm 2 mode: **planning** khi chưa có plan / cần replan, và **supervisor** khi đã có Plan Chốt ACTIVE).
- **`planner.py`:** Logic phân tích của Agent A:
  - **Planning mode:** Nhận `MarketSnapshot` (full 30+30 nến) + `MemoryPack` + `plan_history_summaries`. Phân tích toàn diện: Cấu trúc D1, Strength Score H1, cờ `spacing_met`, bài học `AVOID`/`PREFER`.
  - **Supervisor mode:** Chỉ nhận `DeltaMarketSnapshot` (active_plan + latest_bars + positions) — CẤM tái phân tích biểu đồ từ đầu.
  - Output kép (v2.x): `TradePlan` (action tức thời) + **`UnifiedContingencyPlan` 4 nhánh** (UPSIDE/DOWNSIDE/INVALIDATION/STANDBY, mỗi trigger kèm `candle_predicates` máy-đọc — DEC-11) + `lessons_proposed[]` (DEC-18).

### Module 3.3: Agent B — Independent Challenger (`src/agents/agent_b/`)
- **`prompts.py`:** Lưu trữ System Prompt và Anti-sycophancy Prompt cho Agent B.
- **`challenger.py`:** Logic phản biện độc lập của Agent B:
  - Nhận `TradePlan` của A, tự đọc `MarketSnapshot` và `MemoryPack`.
  - Soát lỗi vi phạm bài học `AVOID` hoặc các rủi ro cản D1 / cú ép kiệt sức.
  - Ra quyết định `ReviewBallot`:
    - `APPROVE`: **Bắt buộc** điền `counter_evidence`.
    - `CHALLENGE`: Nêu rõ `dissent_points` và `requested_changes`.
    - `VETO`: Từ chối dứt khoát nếu vi phạm nghiêm trọng.

### Module 3.4: Consensus Engine & Debate Loop (`src/agents/consensus.py`)
- **Nhiệm vụ:**
  - Điều phối vòng tranh luận giữa Agent A và Agent B (Tối đa `InpMaxDebateRounds` vòng — mặc định $Round \le 2$, đọc từ `doc_phuong_phap/08-parameters.md`, không hardcode):
    1. **Vòng 1:** A gửi `TradePlan` + `UnifiedContingencyPlan` (`PROVISIONAL`) $\rightarrow$ B thẩm định `ReviewBallot`.
    2. Nếu B trả về `CHALLENGE`/`VETO` và $Round < InpMaxDebateRounds$ — **B bắt buộc kèm `counter_plan`** (không cho phép từ chối khống, spec §3.5):
       - A nhận `counter_plan` của B $\rightarrow$ hòa giải mốc giá/điều kiện nến $\rightarrow$ Gửi `ReconciledPlan` (`PROVISIONAL` v2).
       - B thẩm định lại $\rightarrow$ Ra `ReviewBallot_v2`.
    3. **Kết luận đồng thuận:**
       - Nếu $B.decision == 'APPROVE'$:
         - Plan Tạm $\rightarrow$ **Plan Chốt**: `plan_state='COMMITTED'`, `plan_status='ACTIVE'`, `is_active=TRUE`, `expires_at = now + PlanTtlDays` → `contingency_plan_repo.commit_plan()` (transaction: plan cũ → `SUPERSEDED` nếu có).
         - Nếu plan có action tức thời: chạy `HardValidator.validate(plan)` → `PASS` → `market_order_repo.insert_pending()`.
       - Nếu B `VETO` hoặc hết `InpMaxDebateRounds` vòng bất đồng → `DEFER`: vẫn phải lưu **fallback plan COMMITTED tối thiểu STANDBY + kế thừa INVALIDATION của plan trước** (DEC-13).
  - **Fast Consensus (DEC-10):** khi PreTriggerFilter khớp nhánh UPSIDE/DOWNSIDE của Plan Chốt → 1 vòng A→B xác nhận "khớp đúng cam kết" (không phân tích lại). INVALIDATION không qua hàm này — engine auto-execute.

### Module 3.5: Boss Channel & Interrupt Protocol (`src/agents/boss/`)
- **`boss_channel.py`:** Quản lý phiên thảo luận 3 bên giữa Agent A, Agent B và Boss khi có sự kiện `BossWake`.
- **`boss_wake_handlers.py`:** Xử lý sự kiện ngắt:
  - Đánh thức các agent, chuyển `session_mode = 'BOSS'`.
  - Giới hạn tối đa 12 lượt chat (`MaxBossTurns = 12`).
  - **Ràng buộc bất biến:** Boss chỉ đóng vai trò Cố vấn (Advisory only), **tuyệt đối không có BossOverride**. Lệnh chỉ được enqueue khi Agent B đưa ra `APPROVE` và vượt qua `HardValidator`.

### Module 3.6: Uncertainty Escalation & Telegram Integration (`src/agents/escalation.py` + `src/integrations/telegram/`)

> **Tính năng mới:** Agent A hoặc B chủ động hỏi Boss qua Telegram khi mơ hồ. Xem đặc tả: [15-uncertainty-escalation.md](../doc_agents/15-uncertainty-escalation.md) và [16-telegram-bot-design.md](../doc_agents/16-telegram-bot-design.md).

- **`src/agents/escalation.py` — EscalationManager:**
  - `create_and_send(agent, symbol, category, question, context, analysis)` → INSERT `EscalationTickets` + gửi Telegram.
  - **Async (DEC-15):** ticket park `WAITING` — scheduler không block, C0/C3 vẫn chạy; `BossAdvisory`/timeout inject vào cycle kế. Không dùng blocking wait trong main loop.
  - `self_resolve(ticket_id, resolution, reasoning)` → UPDATE status=`SELF_RESOLVED` + thông báo Boss.
  - `handle_late_response(ticket_id, boss_response)` → Ghi `late_boss_response` + nhắn Boss "đã tự quyết theo giải pháp ABC".

- **`src/integrations/telegram/notifier.py` — TelegramNotifier:**
  - `send_escalation(ticket)` → Format tin nhắn tiếng Việt → `sendMessage` Telegram.
  - `send_self_resolved(ticket, resolution)` → Thông báo Boss Agent đã tự quyết.
  - `send_late_notice(ticket, resolution)` → "Do thời gian đợi quá lâu nên tôi đã tự quyết theo giải pháp [ABC]".
  - `send_result(ticket, plan)` → Thông báo kết quả cuối cùng (optional).
  - `send_alert(alert_type, message, snapshot)` → System alerts (FREEZE, RECOVERY, v.v.).

- **`src/integrations/telegram/listener.py` — TelegramListener:**
  - Long polling loop khi có ticket `WAITING` (poll mỗi 3 giây).
  - Match reply → ticket (quote match ưu tiên > FIFO).
  - Inject `BossAdvisory` vào agent context như prompt bình thường.
  - Xử lý late reply (Boss reply sau 30 phút timeout).

- **Tool `escalate_to_boss` cho Agent A & Agent B:**
  - Agent gọi → `EscalationManager.create_and_send()` → ticket park; agent tiếp tục/đánh dấu pending → khi reply hoặc timeout → inject `BossAdvisory`/`TimeoutSignal` vào context lần chạy kế (async, DEC-15).
  - **Quy tắc Tuân thủ Mệnh lệnh (Boss Directive):** Agent nhận response của Boss như một chỉ thị bắt buộc. Nếu Boss từ chối phân tích, bác bỏ đề xuất hoặc yêu cầu WAIT/HỦY/DỪNG, cả Agent A và B **BẮT BUỘC TUÂN THỦ 100%**, tuyệt đối không được tự cho là Boss sai rồi làm trái ý Boss.

### Module 3.7: PlanSummarizer Worker (`src/agents/workers/plan_summarizer.py`) — v2.x
- **Nhiệm vụ:** AI Worker độc lập (model siêu nhẹ, vd `gpt-4o-mini`/Gemini Flash), do Orchestrator kích hoạt **one-shot** khi `contingency_plans.plan_status` chuyển `DONE`:
  1. Đọc `unified_plan_json` + `execution_notes` của plan vừa DONE.
  2. Sinh `summary_text` = 2–3 gạch đầu dòng trung lập (đã làm gì / kết quả / lý do).
  3. Ghi vào `contingency_plans.summary_text`; log `LLMRuns` với `purpose='plan_summary'`.
- **Fallback (spec §3.3):** worker fail → `summary_text = concat(execution_notes)` — không để NULL.
- **Không làm:** không ballot, không phân tích biểu đồ, không ảnh hưởng latency A/B.

---

## ✅ 2. Checklist Developer — Phase 3

- [ ] **LLM Provider Factory:** Tạo factory cho phép chuyển đổi linh hoạt giữa DeepSeek, OpenAI, Anthropic qua config.
- [ ] **LLMRuns Logging:** Mọi lượt gọi LLM đều được lưu trữ chính xác số token và chi phí vào bảng `LLMRuns`.
- [ ] **Agent A Planner:** Sinh đúng schema `TradePlan` **+ `UnifiedContingencyPlan` 4 nhánh** (có `candle_predicates` máy-đọc — DEC-11) + `lessons_proposed[]`, có đầy đủ reasoning và risk assessment.
- [ ] **Agent B Challenger:** Phản biện độc lập, bắt lỗi AVOID, bắt buộc có `counter_evidence` khi APPROVE **và `counter_plan` khi CHALLENGE/VETO** (không từ chối khống).
- [ ] **Consensus Loop:** Dừng đúng sau tối đa `InpMaxDebateRounds` vòng (mặc định 2) khi gặp CHALLENGE; chỉ enqueue khi có APPROVE + HardValidator PASS; **mọi cycle kết thúc phải có 1 Plan COMMITTED trong DB** (fallback kế thừa INVALIDATION — DEC-13).
- [ ] **Plan Lifecycle:** Plan Chốt ghi `is_active=TRUE` + `expires_at`; plan cũ chuyển `SUPERSEDED` trong cùng transaction; unique index chặn 2 plan ACTIVE.
- [ ] **PlanSummarizer:** Khi plan → DONE, worker sinh `summary_text` ≤3 gạch đầu dòng, log `purpose='plan_summary'`; fail → fallback `execution_notes`.
- [ ] **Boss Channel:** Boss có thể góp ý nhưng không thể ép hệ thống vào lệnh nếu vi phạm nguyên tắc.
- [ ] **Escalation Tool:** Agent A/B gọi được `escalate_to_boss`, ticket `EscalationTickets` được tạo đúng schema.
- [ ] **Telegram Send:** Tin nhắn tiếng Việt format đẹp, đầy đủ thông tin cho Boss ra quyết định.
- [ ] **Reply Match:** Boss reply → match đúng ticket WAITING → inject `BossAdvisory` vào agent context.
- [ ] **Tuân lệnh Boss (Boss Directive):** Khi Boss từ chối đề xuất hoặc bảo WAIT/HỦY, Agent A và B lập tức tuân thủ, không được làm trái ý.
- [ ] **Timeout 30 phút:** Hết giờ → `SELF_RESOLVED` + thông báo Boss giải pháp đã chọn.
- [ ] **Late Reply:** Boss reply sau timeout → ghi `late_boss_response` + nhắn "đã tự quyết theo giải pháp ABC".
- [ ] **DB Audit:** Mọi ticket đều có đầy đủ timestamps, trạng thái, và response.

---

## 🧪 3. Kiểm Thử Cần Thực Hiện (Mock Scenarios)

Chạy bộ test `tests/scenarios/test_llm_decisions.py` với **11 kịch bản cốt lõi**:
1. Scenario 1 (FLAT Buy Dip): UPTREND D1 + PUSH_DOWN H1 $0.75 \rightarrow$ `OPEN_BUY` + `APPROVE`.
2. Scenario 2 (FLAT Wrong Dir): UPTREND D1 + PUSH_UP H1 $0.80 \rightarrow$ `WAIT` + `APPROVE`.
3. Scenario 3 (FLAT Soft Zone): Score H1 = $0.50 \rightarrow$ `WAIT`.
4. Scenario 4 (NORMAL DCA Streak): Spacing đủ nhưng $DQ\_STREAK = 5 \rightarrow$ `WAIT` (không DCA vội).
5. Scenario 5 (NORMAL DCA Hợp Lệ): Spacing đủ, không DQ $\rightarrow$ `DCA` + `APPROVE`.
6. Scenario 6 (NORMAL TP): Favorable squeeze + Profit $\ge$ TP Money $\rightarrow$ `CLOSE_ALL` + `APPROVE`.
7. Scenario 7 (RECOVERY Adverse): Adverse squeeze + Spacing đủ $\rightarrow$ `RECOVERY_DCA`.
8. Scenario 8 (RECOVERY Payoff): Favorable squeeze + Có lệnh lỗ $\rightarrow$ `PAYOFF_REDUCE`.
9. Scenario 9 (Anti-Sycophancy B): A đề xuất vi phạm bài học AVOID $\rightarrow$ `CHALLENGE`/`VETO`.
10. Scenario 10 (Boss Advisory): Boss yêu cầu Buy nhưng HardValidator không thỏa $\rightarrow$ Từ chối enqueue.
11. Scenario 11 (Boss Directive Obedience): Agent A đề xuất DCA nhưng mơ hồ hỏi Boss, Boss trả lời "Từ chối, cấm DCA, WAIT ngay" $\rightarrow$ Agent A và B bắt buộc chuyển sang `WAIT`, cấm tự ý vào lệnh.
