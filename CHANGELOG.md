# CHANGELOG — Đợt chuẩn hóa docs v2.x + Flow Studio

> Ngày: 2026-09-21 · Commits: `3778d41` → `d89f668` (branch `main`)
> Phạm vi: 55+ file tài liệu + tool `flow_studio/` mới. Không thay đổi chiến lược trade — chỉ làm nhất quán & dễ triển khai hơn.

---

## 1. Quyết định thiết kế mới — `doc/ERRATA.md` PHẦN II (DEC-10 → DEC-18)

| DEC | Nội dung chốt |
|-----|---------------|
| DEC-10 | Trigger của plan đã COMMITTED = thực thi consent đã ký: `INVALIDATION` auto-exec (chạy cả khi `SYSTEM_FREEZE`), `UPSIDE`/`DOWNSIDE` → fast-consensus A→B, `STANDBY` không gọi LLM |
| DEC-11 | `candle_reaction` → `candle_predicates[]` máy-đọc-được; `latest_bars` ≥ 3 nến |
| DEC-12 | `last_processed_bar_id` chỉ dedupe C0; C3 dedupe qua `trigger_event_id` |
| DEC-13 | Reconcile-fail → fallback plan COMMITTED kế thừa INVALIDATION cũ; plan cũ = `SUPERSEDED` |
| DEC-14 | `prune_hint` chỉ là cờ — engine không tự sửa plan, A+B replan |
| DEC-15 | Escalation async — không block C0 bắt buộc |
| DEC-16 | Plan TTL `PlanTtlDays` + `d1_context_changed` → bắt buộc replan |
| DEC-17 | Enum canon `plan_status` / `Ballot.decision` / `action_type` / `Lessons.src` đồng nhất mọi file |
| DEC-18 | Write-path lesson qua `lessons_proposed[]` → LessonWriter single-writer; `get_memory_pack()` là interface (v1 deterministic, v2 external judge fail-open) |

## 2. Tham số hóa số vòng tranh luận

- Thay mọi "**2 vòng**" cứng của vòng hòa giải A↔B bằng **`InpMaxDebateRounds`** (int, mặc định 2, đổi được — registry `doc/doc_phuong_phap/08-parameters.md`).
- Đã sửa: `doc_agents/00,02,03,06,07,14`, `doc_flow_code/01,04,06,07`, `UPGRADE_CONTINGENCY_PLAN_SPEC.md`, `ERRATA.md`, diagram `D07`, `E03`, `PROMPT-gemini-a2a-diagrams.md`.
- Lưu ý: fast-consensus cho `UPSIDE`/`DOWNSIDE` vẫn là 1 vòng xác nhận (không phải vòng tranh luận).

## 3. Jev — external judge cho retrieval kinh nghiệm (v2, tương lai)

- `doc/doc_experience/02-map-to-agents.md` **§4.1 mới**: pipeline `SQL prefilter ~20 ứng viên → Jev chấm ngữ nghĩa → rerank top-K → MemoryPack`; Jev chỉ là judge/reranker (không thay A/B, không sinh plan); **fail-open về v1**, outage **không** trigger `SYSTEM_FREEZE`; chỉ đáng bật khi >100 lessons ACTIVE/symbol.
- `doc/doc_experience/diagrams/E03-memory-injection.mmd`: thêm participant `External Judge v2 (Jev)` + nhánh `alt v1/v2`.
- `doc/doc_flow_code/03-phase-2-experience-db-system.md`, `ERRATA.md`: đồng bộ mô tả.

## 4. Lan kiến trúc v2.x vào `doc_flow_code/` (roadmap dev)

- File tree thêm `plan_gate.py`, `plan_summarizer.py`; số bảng DB → **14** (thêm `MarketSnapshots` — vá FK treo của `EscalationTickets` — + 3 bảng plan).
- Phase 3: output = `UnifiedContingencyPlan`; Phase 4: thêm PreTriggerFilter, INVALIDATION chạy khi FREEZE, restore plan lúc startup.
- Phase 5: thêm 7 test plan-lifecycle **P1–P7**; checklist có hàng "v2.x Plan Parity".

## 5. Sửa schema & spec

- `doc_phuong_phap/10-sqlite-design.md`: thêm `MarketSnapshots` + 3 bảng v2.x, sửa enum.
- `doc_experience/01-experience-db-spec.md`: vá `Lessons.src DEFAULT 'agent'` vi phạm CHECK → `'system'`; định nghĩa `scope='group'`; `LessonFeedback` += `retrieval_score`/`retrieval_rank`.
- `doc_agents/04-message-schemas.md`: enum, `latest_bars`, flags, `is_active`, `lessons_proposed`, C0 note.
- `02-agent-roles.md`: xóa block nội dung trùng lặp.

## 6. Link & chú thích

- Sửa **40+ link `file:///d:/TradingAgents/...` chết** → relative path (`doc/...`).
- `README.md` §1–5: đánh dấu **legacy v0.x** (MDA/SA/RA/EA, SMA crossover) — không phải kiến trúc hiện hành.
- `TONG_HOP_THAY_DOI_NANG_CAP.md`: header v2.3 + ghi chú đợt DEC-10..18.
- `diagram_review/`: sửa link, số bảng, enum; đánh dấu note cũ.
- `D09-er-diagram.mmd`: 8 → 14 bảng + quan hệ v2.x.

## 7. Flow Studio — tool xem quy trình kiểu n8n (`flow_studio/`)

```
flow_studio/
├── index.html            ← UI (pan/zoom, tooltip, side panel + link doc, edit mode, import/export)
├── flows-data.js         ← dữ liệu 7 flow chi tiết (sửa tay hoặc xuất từ UI)
└── overview-builder.js   ← TỰ SINH tab 0 "Bản đồ TỔNG HỢP" từ 7 flow
```

- **7 tab chi tiết**: Chu kỳ Wake & Quyết định · Vòng đời Plan · Bộ nhớ Kinh nghiệm · State Machine · FREEZE/Reconcile · Boss Channel · Đa tiến trình.
- **Tab 0 Tổng hợp**: ~68 node/83 edge trên 1 canvas, chia 7 vùng + 14 cầu nối chéo (nét đứt). **Tự sinh từ các tab chi tiết** — sửa tab chi tiết là tổng hợp tự cập nhật; không nằm trong file export.
- Node **Jev** nằm trên đường chính pipeline v2: `Bộ lọc → Jev → Bộ nhớ đệm → Gói kinh nghiệm`; nhánh nét đứt v1/fail-open đi thẳng.
- Toàn bộ label/mô tả: tiếng Việt sư phạm, giữ tên kỹ thuật (`InpMaxDebateRounds`, `plan_gate.py`, `COMMITTED`...).
- Mở: double-click `flow_studio/index.html` hoặc `python -m http.server 8734` → `/flow_studio/index.html`.

## 8. Việc còn mở (chưa làm)

- `diagram_review/*.mmd` chưa vẽ lại node `plan_gate`/`plan_summarizer` (đã ghi note cảnh báo).
- `scope='group'` cần khai báo nhóm cặp cụ thể trong `symbols.yaml` khi code.
- Jev chỉ là spec/extension point — **chưa implement**.
- Số retry so khớp MT5↔DB (reconcile) hiện là luật cứng — nếu muốn cấu hình thì thêm tham số riêng (vd `InpMaxReconcileRetries`).
