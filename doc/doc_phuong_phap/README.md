# Trading Agent DCA (MT5/Python) — Phương Pháp Giao Dịch Design Doc

Bộ đặc tả kiến trúc phương pháp và nghiệp vụ giao dịch cho **Trading Agent DCA tự động** trên MetaTrader 5 / Python, vận hành đa cặp độc lập: `AUDCAD`, `AUDNZD`, `GBPUSD`, `NZDCAD`.

> **Bản cập nhật chính thức:** Thay thế toàn bộ các phiên bản trước.  
> **Nền tảng:** Python Engine (Mắt + Executor) + MetaTrader 5 API + LLM Agents (Não) + SQLite.

---

## Mục Lục Tài Liệu

| File | Nội dung |
|------|----------|
| [00-glossary.md](00-glossary.md) | Thuật ngữ, ký hiệu, quy ước nến đóng / không repaint / pip |
| [01-system-overview.md](01-system-overview.md) | Triết lý D1/H1, phạm vi hệ thống, mô hình instance theo cặp, constraints |
| [02-d1-context.md](02-d1-context.md) | Bối cảnh D1: cấu trúc swing/BOS/hysteresis + LLM + safety rails (KHÔNG ADX/EMA) |
| [03-h1-signal.md](03-h1-signal.md) | H1 Strength Score 0–1 (4 thành phần + DQ) + LLM verdict + ngưỡng 0.6 |
| [04-decision-matrix.md](04-decision-matrix.md) | Ma trận FLAT (6 ô) + gates kiểm soát trước MARKET |
| [05-capital-dca.md](05-capital-dca.md) | Vốn/ladder lot/spacing/recovery threshold/payoff |
| [06-state-machine.md](06-state-machine.md) | FLAT → NORMAL → RECOVERY → FLAT (đủ transition + tham số) |
| [07-recovery-loop.md](07-recovery-loop.md) | Vòng lặp RECOVERY (adverse DCA / favorable payoff reduce) |
| [08-parameters.md](08-parameters.md) | Bảng tham số + default + validation rules |
| [09-data-sources.md](09-data-sources.md) | Nguồn dữ liệu (nến, snapshot, engines, account) |
| [10-sqlite-design.md](10-sqlite-design.md) | DB schema: 8 bảng, cột, CHECK, index, pragma, claim atomic, archive transaction |
| [11-python-engine-notes.md](11-python-engine-notes.md) | Kiến trúc Python: mắt engine, tools cho agents, executor thread, runtime lifecycle |

---

## Tập Hợp Diagrams (Mermaid .mmd)

| File | Loại | Mô tả |
|------|------|-------|
| [diagrams/D01-lifecycle-cycle.mmd](diagrams/D01-lifecycle-cycle.mmd) | flowchart TD | Vòng đời mỗi chu kỳ: tick → H1 close → action |
| [diagrams/D02-pair-state-machine.mmd](diagrams/D02-pair-state-machine.mmd) | stateDiagram-v2 | State FLAT / NORMAL / RECOVERY |
| [diagrams/D03-recovery-activity.mmd](diagrams/D03-recovery-activity.mmd) | flowchart TD | Activity vòng lặp RECOVERY |
| [diagrams/D04-data-architecture.mmd](diagrams/D04-data-architecture.mmd) | flowchart LR | Sơ đồ luồng dữ liệu kiến trúc |
| [diagrams/D05-d1-structure-pipeline.mmd](diagrams/D05-d1-structure-pipeline.mmd) | flowchart TD | Pipeline D1: Mắt swing → Não LLM → Rails → ContextFinal |
| [diagrams/D06-h1-strength-pipeline.mmd](diagrams/D06-h1-strength-pipeline.mmd) | flowchart TD | Pipeline H1: Strength Score → LLM → Rails → Matrix |
| [diagrams/D07-instance-architecture.mmd](diagrams/D07-instance-architecture.mmd) | flowchart TB | Kiến trúc 1 Instance (Python Engine ↔ Agents ↔ SQLite ↔ Executor ↔ MT5) |
| [diagrams/D08-decision-sequence.mmd](diagrams/D08-decision-sequence.mmd) | sequenceDiagram | Vòng đời quyết định: H1 close → Snapshot → A/B → Rails → Order Queue → MT5 |
| [diagrams/D09-er-diagram.mmd](diagrams/D09-er-diagram.mmd) | erDiagram | Schema 8 bảng Database SQLite `dca_<symbol>.db` |
