# Agents-to-Agents (A2A) Trading — Design Doc

Bộ đặc tả **kiến trúc Multi-Agent tự chủ (Agent A & B)** cho hệ thống DCA: Agent A (Planner), Agent B (Independent Challenger), kèm kênh **Boss Channel** (góp ý / thảo luận hội đồng 3 bên) và Executor Thread tương tác MT5 qua SQLite Queue.

> **Bản cập nhật chính thức:** Thay thế toàn bộ các phiên bản trước.  
> **Phương pháp giao dịch cứng:** [`../doc_phuong_phap/`](../doc_phuong_phap/).  
> **Nguyên tắc ALL-LLM:** MỌI action giao dịch qua Agent A+B consensus. Engine chỉ cung cấp dữ liệu. Xem [ERRATA](../ERRATA.md).

---

## Mục Lục Tài Liệu

| File | Nội dung |
|------|----------|
| [00-glossary.md](00-glossary.md) | Thuật ngữ A2A, ballot, wake, Boss, session |
| [01-a2a-overview.md](01-a2a-overview.md) | Triết lý 0-human mặc định + Boss exception, mô hình instance |
| [02-agent-roles.md](02-agent-roles.md) | Vai trò Agent A / Agent B / Boss / Executor Thread |
| [03-consensus-protocol.md](03-consensus-protocol.md) | Đồng thuận A+B (mọi action), HardValidator, C1-C4 |
| [04-message-schemas.md](04-message-schemas.md) | Schema message (Snapshot, TradePlan, Ballot, DcaReview, Wake, Boss*) |
| [05-scheduler-wakeup.md](05-scheduler-wakeup.md) | FLAT thức mỗi H1 đóng; OPEN agents tự chọn; BossWake |
| [06-entry-flow.md](06-entry-flow.md) | Lệnh đầu: A plan → B ballot → rails → INSERT MarketOrderInfo |
| [07-dca-dual-review-loop.md](07-dca-dual-review-loop.md) | Lệnh ≥ 2: dual-review trước mọi DCA/payoff/close |
| [08-map-to-phuong-phap.md](08-map-to-phuong-phap.md) | Map action A2A ↔ FLAT/NORMAL/RECOVERY |
| [09-runtime-architecture.md](09-runtime-architecture.md) | Python orchestrator + executor + tools + audit |
| [10-autonomy-constraints.md](10-autonomy-constraints.md) | Ràng buộc tự chủ; Boss v1 chỉ bàn (không Override) |
| [11-boss-interrupt-flow.md](11-boss-interrupt-flow.md) | BossWake → hội đồng 3 bên → vẫn cần A+B + rails |
| [12-market-data-fetch.md](12-market-data-fetch.md) | Agents tự fetch snapshot; mắt vs não |
| [13-experience-loop.md](13-experience-loop.md) | get_memory_pack trước plan; feedback sau đóng lệnh |
| [14-llm-prompt-spec.md](14-llm-prompt-spec.md) | **[NEW]** System prompt A/B, JSON output schemas, token budget, model selection, fallback |

---

## Tập Hợp Diagrams (Mermaid .mmd)

| File | Loại | Mô tả |
|------|------|-------|
| [diagrams/A01-a2a-sequence.mmd](diagrams/A01-a2a-sequence.mmd) | sequenceDiagram | Sequence A↔B → Ghi SQLite Order Queue → Executor |
| [diagrams/A02-consensus-state.mmd](diagrams/A02-consensus-state.mmd) | stateDiagram-v2 | State đồng thuận + BOSS_SESSION |
| [diagrams/A03-wakeup-and-monitor.mmd](diagrams/A03-wakeup-and-monitor.mmd) | flowchart TD | Scheduler FLAT/OPEN wake + BossWake |
| [diagrams/A04-dca-dual-review.mmd](diagrams/A04-dca-dual-review.mmd) | flowchart TD | Dual review trước mọi quyết định DCA |
| [diagrams/A05-boss-interrupt.mmd](diagrams/A05-boss-interrupt.mmd) | sequenceDiagram | Boss interrupt → Hội đồng 3 bên bàn luận → Consensus |
| [diagrams/A06-d1-context-pipeline.mmd](diagrams/A06-d1-context-pipeline.mmd) | flowchart TD | Pipeline D1: Fetch → Mắt swing → LLM → Rails |
| [diagrams/A07-h1-strength-pipeline.mmd](diagrams/A07-h1-strength-pipeline.mmd) | flowchart TD | Pipeline H1: Score 4 thành phần + DQ → LLM → Rails |
| [diagrams/A08-db-queue-flow.mmd](diagrams/A08-db-queue-flow.mmd) | stateDiagram-v2 | Luồng MarketOrderInfo: PENDING → PROCESSING → ARCHIVED/FAILED |
