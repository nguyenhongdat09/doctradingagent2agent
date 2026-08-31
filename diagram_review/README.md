# BẢN ĐỒ TỔNG THỂ HỆ THỐNG VÀ LỘ TRÌNH ĐỌC (DIAGRAM REVIEW)

> **Mục tiêu tài liệu**: Dành riêng cho Developer (kỹ sư phần mềm) **chưa từng có kinh nghiệm trading Forex/DCA**. Bộ tài liệu và sơ đồ Mermaid này chuyển hóa toàn bộ logic tài chính phức tạp thành các khái niệm kỹ thuật quen thuộc: Pipeline dữ liệu, State Machine, Queue Producer-Consumer, Multi-Agent Consensus, và Resilient Distributed System.

---

## 🗺️ Lộ Trình Đọc Khuyến Nghị (14 Bước)

| Thứ tự | Tệp tài liệu | Loại sơ đồ / Nội dung chính | Khái niệm Trading cần biết trước | Thời gian đọc |
| :---: | :--- | :--- | :--- | :---: |
| **00** | [00-trading-101.md](file:///d:/TradingAgents/PlanToCode/diagram_review/00-trading-101.md) | Từ điển vỡ lòng về Trading dành cho Dev | Không có (Bắt đầu từ số 0) | 10 phút |
| **01** | [01-helicopter-view.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/01-helicopter-view.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/01-helicopter-view.md) | Sơ đồ chim ưng: Toàn cảnh 1 chu kỳ End-to-End | MT5, Nến D1/H1, Order | 7 phút |
| **02** | [02-instance-per-pair.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/02-instance-per-pair.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/02-instance-per-pair.md) | Kiến trúc Multi-Process Per-Pair (ADR-001) | Cặp tiền Forex, Cross-pair | 5 phút |
| **03** | [03-eyes-engine.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/03-eyes-engine.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/03-eyes-engine.md) | Bộ máy tính toán "Mắt": D1 Context & H1 Signal | Trend, Sideway, BOS, ATR | 8 phút |
| **04** | [04-brain-agents.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/04-brain-agents.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/04-brain-agents.md) | Bộ não "Agents": Agent A lập Plan & Agent B phản biện | ALL-LLM, Consensus, HardValidator | 8 phút |
| **05** | [05-queue-executor.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/05-queue-executor.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/05-queue-executor.md) | Đôi tay "Executor": Queue Producer-Consumer chống duplicate | Atomic Claim, SQLite Queue | 6 phút |
| **06** | [06-state-machine.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/06-state-machine.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/06-state-machine.md) | Vòng đời trạng thái: FLAT ➔ NORMAL ➔ RECOVERY | TotalLot, Ngưỡng R_TH (0.3) | 7 phút |
| **07** | [07-dca-and-timing.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/07-dca-and-timing.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/07-dca-and-timing.md) | Cơ chế Spacing DCA & Lập lịch C0/C1/C2/C3 (DEC-09) | Intra-bar DCA, Spacing ATR | 7 phút |
| **08** | [08-recovery-loop.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/08-recovery-loop.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/08-recovery-loop.md) | Vòng lặp Cứu lỗ: Payoff Lot & Tỉa lệnh âm | Adverse/Favorable Squeeze, Payoff | 8 phút |
| **09** | [09-experience-memory.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/09-experience-memory.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/09-experience-memory.md) | Bộ nhớ kinh nghiệm: MemoryPack Tier1/Tier2 (≤500 token) | Bài học giao dịch, Token Budget | 6 phút |
| **10** | [10-freeze-and-reliability.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/10-freeze-and-reliability.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/10-freeze-and-reliability.md) | Độ tin cậy & Chống sập: SYSTEM_FREEZE, Reconcile | Kill-switch, LLM Outage | 6 phút |
| **11** | [11-boss-channel.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/11-boss-channel.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/11-boss-channel.md) | Kênh Boss tham vấn: Advisory (Tư vấn, không Override) | Human-in-the-loop, 3-way conference | 5 phút |
| **12** | [12-dataflow-overview.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/12-dataflow-overview.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/12-dataflow-overview.md) | Sơ đồ luồng dữ liệu & 13 Bảng SQLite (9 Local + 4 Chung) | SQLite Schema, WAL Mode | 7 phút |
| **13** | [13-sequence-one-cycle.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/13-sequence-one-cycle.mmd) / [.md](file:///d:/TradingAgents/PlanToCode/diagram_review/13-sequence-one-cycle.md) | Sequence chi tiết từng mili-giây của 1 chu kỳ thức giấc | Autonumber End-to-End Sequence | 8 phút |

---

## 🏷️ Quy Ước Vai Trò Hệ Thống (Trách nhiệm từng khối)

Mọi sơ đồ tuân thủ 4 vai trò rõ rệt để dev không bị nhầm lẫn quyền hạn:
1. 🔧 **Engine Mắt (Eyes Engine)**: Thuần Python toán học, chỉ tính toán số liệu và nén snapshot. **TUYỆT ĐỐI KHÔNG RA QUYẾT ĐỊNH VÀO LỆNH**.
2. ✅ **Não Bộ LLM (Brain Agents)**: Agent A & Agent B (ALL-LLM) giữ quyền tối cao quyết định mọi hành động (ENTRY, DCA, CLOSE, PAYOFF, WAIT).
3. 🛡️ **HardValidator (Người gác cổng kỹ thuật)**: 5 quy tắc cứng bằng code Python để chặn lỗi ảo giác (Hallucination) hoặc vi phạm rủi ro.
4. ⚙️ **Thực Thi (Executor - Đôi tay)**: Worker chạy nền, chỉ đọc SQLite queue, Claim độc quyền và gửi lệnh sang MetaTrader 5 (MT5).
5. 👤 **Boss (Người dùng / Quản lý)**: Chỉ có quyền tham vấn (Advisory) và quan sát qua kênh Telegram/CLI, không được cưỡng bức override lệnh.
