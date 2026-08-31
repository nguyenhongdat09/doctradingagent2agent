# GỬI CHO CLAUDE — PHẢN BIỆN & CHỐT QUYẾT ĐỊNH (sau review)

> Copy TOÀN BỘ nội dung từ dòng `---` đến hết, gửi cho Claude.

---

Cảm ơn review rất sắc của bạn. Tôi đồng ý phần lớn, nhưng có 1 mâu thuẫn thiết kế bạn
nêu ra cần **tôi chốt** trước, kèm một vài điều chỉnh thứ tự ưu tiên. Tôi gửi lại
để bạn xác nhận hướng trước khi tôi sinh thêm doc.

═══════════════════════════════════════════
1) ĐỒNG Ý (đúng, ưu tiên cao)
═══════════════════════════════════════════

Tôi đồng ý với các thiếu sót sau, sẽ bổ sung **trước khi code**:
- Error Handling & Failure Recovery (P0)
- Startup / Reconciliation Protocol (P0)
- CLOSE_ALL execution detail (P0)
- LLM Prompt templates (P1)
- Testing Strategy (P1)

Cách tôi muốn tổ chức (gộp để không phình doc):
- Gộp "Error handling + Startup/Reconciliation + Monitoring/Health" → 1 file
  `operations-reliability.md`
- LLM prompts → 1 file `llm-prompt-spec.md`
- Testing → 1 file `testing-strategy.md`

═══════════════════════════════════════════
2) ĐIỂM BẠN NÊU ĐÚNG NHƯNG CẦN TÔI CHỐT — DCA NORMAL
═══════════════════════════════════════════

Bạn đúng: doc hiện có MÂU THUẪN về DCA NORMAL.
- `06-state-machine §5.2`: DCA NORMAL chỉ check spacing giá, không yêu cầu H1 signal.
- `doc_agents`: lại nói "MỌI material action... đều cần A2A consensus + neo H1 close".

Tôi quyết định chọn hướng (b):

  **DCA TRONG NORMAL = chạy theo RULE deterministic (spacing), KHÔNG cần agents,
  KHÔNG chờ H1 signal. Chỉ ENTRY, RECOVERY_DCA, PAYOFF_REDUCE, CLOSE_ALL mới cần
  A+B consensus + H1 signal + rails.**

Lý do:
1. Bản chất DCA là "lấp rổ khi giá đi ngược". Giá đi ngược đủ spacing THƯỜNG KHÔNG đi
   kèm PUSH mạnh cùng lúc → nếu đợi H1 signal + 2 agents thì bỏ lỡ nhịp lấp rổ, và đốt
   token vô ích.
2. Spacing + ladder là công thức deterministic, an toàn, không cần "phán đoán" của LLM.
3. Chỉ những quyết định cần CHỌN HƯỚNG/PHÁN ĐOÁN (entry, recovery, payoff, đóng) mới
   cần bộ não LLM + consensus + H1 close.

Yêu cầu bạn: xác nhận cách ghi lại để KHÔNG còn mâu thuẫn:
- Trong state machine: DCA NORMAL mô tả là deterministic (spacing adverse đủ), chạy
  qua Executor queue, KHÔNG qua agents.
- Trong doc_agents: sửa rule "mọi material action cần dual-review" thành
  "mọi DECISION action (ENTRY/RECOVERY/PAYOFF/CLOSE) cần dual-review; NORMAL DCA là
  deterministic engine, không cần."

Nếu bạn thấy hướng (b) này có lỗ hổng rủi ro nào với vốn $1000 / lot 0.05 / R_TH 0.3
thì cứ nêu — tôi cân nhắc. Còn không thì xác nhận để cập nhật doc.

═══════════════════════════════════════════
3) PHẢN BIỆN NHẸ (điều chỉnh thứ tự ưu tiên)
═══════════════════════════════════════════

- **Swap (#9):** bạn nói đúng là nên đưa swap vào tính payoff (RECOVERY kéo dài nhiều
  ngày). Nhưng đây là P1 (tính toán), không phải P0. Đồng ý bổ sung, không chặn code.
- **similarity_score (#13):** đúng là chưa có thuật toán. Là P2. Bổ sung: có thể dùng
  cosine similarity giữa `text_B` và `text_A` (hoặc embedding); bổ sung vào Ballots.
- **Monitoring/Deployment/Config/Versioning (#3, #10, #14, #16):** đồng ý là nên có,
  nhưng xếp P2 — thêm dần, KHÔNG chặn Phase 1 code (engine + DB + executor).

═══════════════════════════════════════════
4) GIAO VIỆC CỤ THỂ TÔI MUỐN BẠN LÀM
═══════════════════════════════════════════

1. Xác nhận/walkthrough hướng (b) cho DCA NORMAL — nêu rủi ro nếu có.
2. Ghi lại các quyết định vừa chốt (b + P0/P1/P2 + swap + similarity) làm "errata"
   để đính kèm vào doc trước khi sinh file mới.
3. Sau đó mới sinh các file mới:
   - `doc_phuong_phap/12-operations-reliability.md` (error + startup + monitoring)
   - `doc_agents/14-llm-prompt-spec.md` (system prompt A/B, JSON enforcement, fallback)
   - `doc_phuong_phap/13-testing-strategy.md` (unit/backtest/forward/LLM validation)
   - Cập nhật 06-state-machine + doc_agents rule "decision action vs deterministic DCA"
4. Bạn chọn thứ tự sinh file phù hợp, nhưng PHẢI ưu tiên sửa mâu thuẫn DCA NORMAL trước.

═══════════════════════════════════════════
5) CÂU HỎI CHỐT (trả lời ngắn gọn)
═══════════════════════════════════════════

Q1. Hướng (b) — NORMAL DCA deterministic không qua agents — bạn xác nhận hay thấy
    rủi ro cần điều chỉnh?
Q2. Thứ tự file mới: tôi đề xuất (1) sửa state machine DCA, (2) operations-reliability,
    (3) llm-prompt-spec, (4) testing-strategy. Bạn đồng ý hay đổi?
Q3. Liên quan Monitoring (#3): với Phase 1 (chưa có LLM agents), bạn có cần đặc tả
    monitoring ngay hay để ở mức tối thiểu (heartbeat + queue backlog + connect health)
    rồi mở rộng ở Phase 2?