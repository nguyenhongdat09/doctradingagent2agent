# ═══════════════════════════════════════════════════════════════════
# PROMPT CURSOR — GHI DOC EXPERIENCE DB VÀO FOLDER RIÊNG (doc_experience)
# Dán toàn bộ nội dung này vào Cursor. Cursor PHẢI GHI TRỰC TIẾP file vào đĩa.
# ═══════════════════════════════════════════════════════════════════

Bạn là kiến trúc sư hệ thống trading + database. Thiết kế (design doc) + vẽ diagram (Mermaid)
cho "EXPERIENCE DB" — bộ nhớ rút kinh nghiệm của hệ thống Trading Agent DCA trên MT5/Python.
CHỈ THIẾT KẾ, CHƯA viết code production. Hợp nhất với thiết kế đã có (D1/H1, FLAT/NORMAL/RECOVERY,
SQLite queue, agents A/B, 1 instance = 1 cặp).

# ═══════════════════════════════════════════════════════════════════
# PHẦN 1 — TRIẾT LÝ (bắt buộc)
# ═══════════════════════════════════════════════════════════════════

1. KHÔNG ghi journal từng lệnh (tốn token khủng khiếp). Agents ghi BÀI HỌC CÔ ĐỌNG —
   chủ yếu "điều cần tránh" (AVOID) + vài "nên làm" (PREFER) / cảnh báo (WARNING) —
   1 câu template ngắn có cấu trúc.
2. Experience DB là 1 file RIÊNG (`experience.db`), KHÔNG chung với `dca_<symbol>.db`,
   DÙNG CHUNG cho mọi cặp; có cột symbol/scope để filter.
3. Trước mỗi quyết định lệnh, Agent A và B LOAD MemoryPack — bản text GỌN ĐÃ CACHE SẴN
   (không quét toàn bộ lịch sử) — để biết "cần tránh gì / không cần tránh gì thì thoải mái làm".
4. Lessons là ADVISORY (cảnh báo vào plan), không phải hard rule; chặn cứng chỉ khi
   EnforceTopLessons=true (mặc định OFF).

# ═══════════════════════════════════════════════════════════════════
# PHẦN 2 — BẢNG (đủ cột + kiểu + CHECK + index)
# ═══════════════════════════════════════════════════════════════════

## Lessons (bảng chính)
lesson_id INTEGER PK AUTOINCREMENT
symbol TEXT NOT NULL                -- 'AUDCAD'|'AUDNZD'|'ALL'
scope TEXT DEFAULT 'symbol' CHECK IN ('symbol','group','all')
context_type TEXT CHECK IN ('UPTREND','DOWNTREND','SIDEWAY','ANY')
action_type TEXT CHECK IN ('ENTRY','DCA','PAYOFF','CLOSE_ALL','RECOVERY_DCA','ANY')
direction TEXT CHECK IN ('BUY','SELL','NONE')
lesson_type TEXT NOT NULL CHECK IN ('AVOID','PREFER','WARNING')
severity INTEGER 1..5 DEFAULT 3
trigger_cond TEXT                   -- compact JSON signature
lesson_text TEXT NOT NULL           -- 1 câu ≤200 ký tự, theo template
tags TEXT DEFAULT '[]'              -- JSON array
src TEXT DEFAULT 'agent'            -- agent_a|agent_b|system|boss
plan_id TEXT
occurrence_count INTEGER DEFAULT 1
total_pl_usd REAL DEFAULT 0
win_count INTEGER DEFAULT 0
loss_count INTEGER DEFAULT 0
status TEXT DEFAULT 'ACTIVE' CHECK IN ('ACTIVE','SUPERSEDED','ARCHIVED')
created_at / last_seen_at / last_applied_at TEXT
INDEX (symbol, context_type, action_type, status)

## Template bài học (bắt buộc trong doc)
[AVOID|PREFER|WARNING] {pair} {context} khi {cond} → {không|nên} {action}
| lý do: {short} | tác động: {pl_usd} | seen {n}x

## MemoryCache — cache MemoryPack
cache_key TEXT PK                    -- 'AUDCAD|UPTREND|ENTRY'
symbol / context_type / action_type
pack_text TEXT NOT NULL              -- text ĐÃ RENDER cho prompt (T1+T2)
token_estimate INTEGER, lesson_ids TEXT(JSON), content_hash TEXT
ttl_seconds INTEGER DEFAULT 3600, built_at, expires_at

## PairProfiles
symbol TEXT PK, profile_short TEXT NOT NULL (≤300 ký tự), updated_at

## LessonFeedback
feedback_id INTEGER PK AUTOINCREMENT
lesson_id INTEGER NOT NULL, plan_id TEXT, symbol TEXT NOT NULL
applied BOOLEAN DEFAULT 0, outcome CHECK IN ('WIN','LOSS','FLAT','NA')
pl_usd REAL, note TEXT, created_at TEXT

# ═══════════════════════════════════════════════════════════════════
# PHẦN 3 — CACHE & LUỒNG HỌC (token-saver — bắt buộc)
# ═══════════════════════════════════════════════════════════════════

## Ghi bài học batch: chỉ khi CLOSE_ALL / EXIT_RECOVERY / lệnh FAILED / hết cooldown.
## Dedupe: lesson giống cũ (cùng symbol+context+action+trigger_cond hash)
##         → tăng occurrence_count, KHÔNG chèn dòng mới.
## MemoryPack 2 tầng: T1 ≤150 token (profile + top 2 evergreen) luôn tải;
##         T2 ≤350 token (filter top 6 theo score). Tổng ≤ ~500 token.
## Score = severity^2 × (1+log(occ)) × relevance(symbol 1.0/group 0.7/all 0.5 × context 1.0/ANY 0.4)
##         × time_decay(0.6^tuổi ngày)
## Vòng đời cache: get_memory_pack → miss/TTL/hash đổi → rebuild → UPDATE;
##         invalidate khi INSERT/UPDATE lesson liên quan.
## Học theo kết quả: LessonFeedback → update stats → fail liên tiếp ≥3 → downgrade/ARCHIVED.
## Token estimate: ~0.45k/call ×2 agents ×24 H1 close ≈ 21.6k token/ngày/cặp
##         ≈ $0.006–0.02/ngày/cặp (model rẻ); ghi LLMRuns purpose='memory_pack'.

# ═══════════════════════════════════════════════════════════════════
# PHẦN 4 — GHI FILE TỰ ĐỘNG VÀO FOLDER RIÊNG (BẮT BUỘC)
# ═══════════════════════════════════════════════════════════════════

K0. KHÔNG chỉ trả lời trong chat. Bạn PHẢI GHI TRỰC TIẾP các file sau VÀO ĐĨA
    (tạo thư mục con nếu chưa có, GHI ĐÈ file trùng tên — bản chính thức).

K1. Thư mục đích DUY NHẤT cho phần này (RIÊNG, tách khỏi doc_phuong_phap/doc_agents):
    D:\TradingAgents\PlanToCode\doc\doc_experience\
    D:\TradingAgents\PlanToCode\doc\doc_experience\diagrams\

K2. File phải tạo:

    ## doc_experience (.md)
    README.md                    — index + tổng quan + tóm tắt nguyên tắc + liên kết 2 doc kia
    01-experience-db-spec.md     — triết lý, schema DDL đầy đủ + COMMENT, template bài học,
                                   scoring, cache, vòng lặp học, token estimate, tích hợp tools,
                                   so sánh với dca_<symbol>.db
    (Tùy chọn nếu cần tách sâu hơn: 02-cache-flow.md, 03-learning-loop.md — có thể gộp vào 01
     nếu nội dung gọn; KHÔNG bắt buộc.)

    ## doc_experience/diagrams (.mmd — Mermaid source)
    E01-experience-er.mmd        — erDiagram đầy đủ: Lessons, MemoryCache, PairProfiles,
                                   LessonFeedback (+ quan hệ)
    E02-learning-cache-flow.mmd  — flowchart: kết cục → LessonLearner → record_lesson
                                   (dedupe) → invalidate cache → MemoryPackBuilder
                                   (T1/T2) → get_memory_pack → inject prompt A/B →
                                   quyết định → LessonFeedback → update stats → downgrade/archive
    E03-memory-injection.mmd     — flowchart/sequence: vị trí get_memory_pack trong vòng đời
                                   quyết định (trước A plan, B dùng pack bắt lỗi A)

K3. Quy tắc:
    - File .md chuẩn Markdown (bảng, mermaid fence, code fence .sql cho DDL).
    - File .mmd CHỈ chứa Mermaid (1-2 dòng comment đầu).
    - Tham chiếu chéo đúng (../doc_phuong_phap/..., ../doc_agents/...).
    - Sau khi ghi xong, báo cáo danh sách file đã tạo + số file mỗi folder.
    - Dùng đúng nội dung PHẦN 1-3, hợp nhất với master prompt (PHẦN L — Experience DB).
    - KHÔNG sửa/sinh thêm file trong doc_phuong_phap hay doc_agents cho phần này
      (đã tách riêng doc_experience).