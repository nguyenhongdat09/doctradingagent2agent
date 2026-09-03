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
- **`prompts.py`:** Lưu trữ System Prompt và Template prompt cho Agent A (Xem [14-llm-prompt-spec.md](../doc_agents/14-llm-prompt-spec.md)).
- **`planner.py`:** Logic phân tích của Agent A:
  - Nhận `MarketSnapshot` và chuỗi `MemoryPack`.
  - Phân tích toàn diện: Cấu trúc D1, Strength Score H1, cờ `spacing_met`, bài học `AVOID`/`PREFER`.
  - Soạn thảo `TradePlan` với đầy đủ luận điểm `reasoning` và đánh giá rủi ro `risk_assessment`.

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
  - Điều phối vòng tranh luận giữa Agent A và Agent B (Tối đa 2 vòng: $Round \le 2$):
    1. **Vòng 1:** A gửi `TradePlan` $\rightarrow$ B thẩm định `ReviewBallot`.
    2. Nếu B trả về `CHALLENGE` và $Round < 2$:
       - A nhận phản biện $\rightarrow$ Điều chỉnh kế hoạch $\rightarrow$ Gửi lại `TradePlan_v2`.
       - B thẩm định lại $\rightarrow$ Ra `ReviewBallot_v2`.
    3. **Kết luận đồng thuận:**
       - Nếu $B.decision == 'APPROVE'$:
         - Chạy `HardValidator.validate(plan)`.
         - Nếu `PASS` $\rightarrow$ Đạt đồng thuận (`CONSENSUS_AUTO`) $\rightarrow$ Agent A gọi `market_order_repo.insert_pending()`.
       - Nếu B trả về `VETO` hoặc hết 2 vòng vẫn bất đồng $\rightarrow$ Kết luận `DEFER` $\rightarrow$ Không ghi lệnh, đặt lịch wake tiếp theo.

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
  - `wait_for_response(ticket_id, timeout=1800)` → Đợi Boss reply (poll DB / event), tối đa 30 phút.
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
  - Agent gọi → `EscalationManager.create_and_send()` → đợi → return `BossAdvisory` hoặc `TimeoutSignal`.
  - **Quy tắc Tuân thủ Mệnh lệnh (Boss Directive):** Agent nhận response của Boss như một chỉ thị bắt buộc. Nếu Boss từ chối phân tích, bác bỏ đề xuất hoặc yêu cầu WAIT/HỦY/DỪNG, cả Agent A và B **BẮT BUỘC TUÂN THỦ 100%**, tuyệt đối không được tự cho là Boss sai rồi làm trái ý Boss.

---

## ✅ 2. Checklist Developer — Phase 3

- [ ] **LLM Provider Factory:** Tạo factory cho phép chuyển đổi linh hoạt giữa DeepSeek, OpenAI, Anthropic qua config.
- [ ] **LLMRuns Logging:** Mọi lượt gọi LLM đều được lưu trữ chính xác số token và chi phí vào bảng `LLMRuns`.
- [ ] **Agent A Planner:** Sinh đúng schema `TradePlan`, có đầy đủ reasoning và risk assessment.
- [ ] **Agent B Challenger:** Phản biện độc lập, bắt lỗi AVOID, bắt buộc có `counter_evidence` khi APPROVE.
- [ ] **Consensus Loop:** Dừng đúng sau tối đa 2 vòng khi gặp CHALLENGE; chỉ enqueue khi có APPROVE + HardValidator PASS.
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
