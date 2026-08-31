# 01 — ĐẶC TẢ KIẾN TRÚC EXPERIENCE DB (BỘ NHỚ RÚT KINH NGHIỆM)

Tài liệu này đặc tả chi tiết kiến trúc của **EXPERIENCE DB** (`experience.db`) — hệ thống ghi nhớ và tái sử dụng bài học kinh nghiệm giao dịch đa cặp độc lập, giúp LLM Agents (Agent A & B) liên tục hoàn thiện mà không gây bùng nổ token hay làm chậm chu kỳ thực thi.

---

## 1. TRIẾT LÝ THIẾT KẾ CỐT LÕI

1. **Không ghi Journal từng lệnh:**
   - Tuyệt đối không lưu nhật ký chi tiết từng nến/từng lệnh (vốn làm phình to token một cách vô ích).
   - Chỉ trích xuất **BÀI HỌC CÔ ĐỌNG** theo template 1 câu duy nhất ($\le 200$ ký tự), tập trung chủ yếu vào các lỗi cần né tránh (`AVOID`), các thói quen tốt (`PREFER`) và cảnh báo rủi ro bối cảnh (`WARNING`).
2. **Database Dùng Chung Toàn Hệ Thống (`experience.db`):**
   - Tách biệt hoàn toàn khỏi database vận hành từng cặp (`dca_<symbol>.db`).
   - Mọi instance cặp tiền (`AUDCAD`, `AUDNZD`, `GBPUSD`, `NZDCAD`) đều đọc/ghi vào `experience.db`.
   - Có cột `symbol` và `scope` (`symbol` | `group` | `all`) để chia sẻ bài học giữa các cặp có đặc tính tương đồng.
3. **Cơ Chế Nạp Nhanh Qua Cache (MemoryPack):**
   - Trước mỗi quyết định, Agent A và B nạp **MemoryPack** — một chuỗi text cô đọng ($\le 500$ tokens) đã được render và lưu sẵn trong bộ nhớ đệm (`MemoryCache`), loại bỏ hoàn toàn việc quét lại toàn bộ bảng lịch sử.
4. **Tính Chất Khuyến Nghị (Advisory Nature):**
   - Bài học mang tính chất định hướng/cảnh báo để Agents đưa vào lập luận và phản biện.
   - Không phải Hard Rule tuyệt đối, trừ khi bật tham số `EnforceTopLessons = true` (Mặc định: `false`).

---

## 2. DATABASE SCHEMA CHI TIẾT (DDL SQLITE)

```sql
-- Cấu hình tối ưu SQLite WAL mode
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

-- 1. BẢNG BÀI HỌC KINH NGHIỆM CHÍNH (Lessons)
CREATE TABLE Lessons (
    lesson_id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,                -- 'AUDCAD', 'AUDNZD', 'GBPUSD', 'NZDCAD', hoặc 'ALL'
    scope TEXT NOT NULL DEFAULT 'symbol' CHECK(scope IN ('symbol', 'group', 'all')),
    context_type TEXT NOT NULL CHECK(context_type IN ('UPTREND', 'DOWNTREND', 'SIDEWAY', 'ANY')),
    action_type TEXT NOT NULL CHECK(action_type IN ('ENTRY', 'DCA', 'PAYOFF', 'CLOSE_ALL', 'RECOVERY_DCA', 'ANY')),
    direction TEXT NOT NULL DEFAULT 'NONE' CHECK(direction IN ('BUY', 'SELL', 'NONE')),
    lesson_type TEXT NOT NULL CHECK(lesson_type IN ('AVOID', 'PREFER', 'WARNING')),
    severity INTEGER NOT NULL DEFAULT 3 CHECK(severity BETWEEN 1 AND 5), -- 1: Nhẹ, 5: Nghiêm trọng
    trigger_cond TEXT,                   -- Chuỗi JSON chữ ký điều kiện nén (vd: {"streak":4,"near_d1_wall":1})
    lesson_text TEXT NOT NULL,           -- Câu template chuẩn hóa (<= 200 ký tự)
    tags TEXT DEFAULT '[]',              -- Mảng JSON phân loại (vd: ["streak", "exhaustion", "support"])
    src TEXT NOT NULL DEFAULT 'agent' CHECK(src IN ('agent_a', 'agent_b', 'system', 'boss')),
    plan_id TEXT,                        -- ID kế hoạch phát sinh bài học
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    total_pl_usd REAL NOT NULL DEFAULT 0.0,
    win_count INTEGER NOT NULL DEFAULT 0,
    loss_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_applied_at TIMESTAMP
);

CREATE INDEX idx_lessons_lookup ON Lessons(symbol, context_type, action_type, status);
CREATE INDEX idx_lessons_ranking ON Lessons(status, severity DESC, occurrence_count DESC);

-- 2. BẢNG BỘ NHỚ ĐỆM MEMORYPACK (MemoryCache)
CREATE TABLE MemoryCache (
    cache_key TEXT PRIMARY KEY,          -- '<symbol>|<context_type>|<action_type>'
    symbol TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'symbol' CHECK(scope IN ('symbol', 'group', 'all')),
    context_type TEXT NOT NULL,
    action_type TEXT NOT NULL,
    pack_text TEXT NOT NULL,
    token_estimate INTEGER NOT NULL,
    lesson_ids TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 3600,
    built_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_memory_cache_lookup ON MemoryCache(symbol, context_type, action_type);
CREATE INDEX idx_memory_cache_scope ON MemoryCache(scope, symbol);

-- 3. BẢNG HỒ SƠ ĐẶC TÍNH CẶP TIỀN (PairProfiles)
CREATE TABLE PairProfiles (
    symbol TEXT PRIMARY KEY,
    profile_short TEXT NOT NULL,        -- Mô tả đặc tính hành vi giá <= 300 ký tự (Dùng cho Tầng T1)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. BẢNG PHẢN HỒI HIỆU QUẢ BÀI HỌC (LessonFeedback)
CREATE TABLE LessonFeedback (
    feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL REFERENCES Lessons(lesson_id),
    plan_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    applied INTEGER NOT NULL DEFAULT 0 CHECK(applied IN (0, 1)),
    outcome TEXT NOT NULL DEFAULT 'NA' CHECK(outcome IN ('WIN', 'LOSS', 'FLAT', 'NA')),
    pl_usd REAL DEFAULT 0.0,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lesson_feedback_lookup ON LessonFeedback(lesson_id, applied, outcome);
```

---

## 3. CHUẨN MẪU CÂU BÀI HỌC (LESSON TEMPLATE)

Mọi bài học trong trường `lesson_text` bắt buộc tuân theo định dạng chuẩn hóa sau:

$$\mathbf{[AVOID \mid PREFER \mid WARNING]}\; \{\text{pair}\}\; \{\text{context}\}\; \text{khi}\; \{\text{cond}\} \longrightarrow \{\text{không} \mid \text{nên}\}\; \{\text{action}\} \mid \text{lý do: } \{\text{short}\} \mid \text{tác động: } \{\text{pl\_usd}\} \mid \text{seen } \{n\}\text{x}$$

**Ví dụ thực tế:**
- `[AVOID] AUDCAD UPTREND khi chuỗi tăng >= 4 nến H1 đâm vào cản D1 -> không BUY | lý do: bẫy kiệt sức cản đỉnh | tác động: -$45.20 | seen 4x`
- `[PREFER] AUDNZD SIDEWAY khi H1 Push ngược rút chân chạm đáy range -> nên BUY dip | lý do: phản ứng bật đáy tin cậy | tác động: +$32.50 | seen 6x`
- `[WARNING] GBPUSD RECOVERY khi tin lãi suất BOE sắp ra -> không nhồi DCA dày | lý do: trượt giá mạnh và giãn spread | tác động: -$80.00 | seen 2x`

---

## 4. BỘ NHỚ 2 TẦNG (MEMORYPACK ARCHITECTURE)

Để đảm bảo prompt của LLM luôn ngắn gọn, MemoryPack được chia làm 2 tầng với tổng dung lượng $\le 500$ tokens:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: PERMANENT / PROFILE & EVERGREEN (<= 150 TOKENS)                │
│ - Trích từ PairProfiles: Tóm tắt đặc tính cặp tiền (<= 300 ký tự).     │
│ - Top 2 bài học cốt lõi có Severity = 5 (Evergreen rules).             │
│ - Luôn luôn xuất hiện trong mọi chu kỳ của cặp tiền đó.               │
├────────────────────────────────────────────────────────────────────────┤
│ TẦNG 2: CONTEXTUAL / DYNAMIC RANKED LESSONS (<= 350 TOKENS)            │
│ - Lọc theo: Symbol/Group/All + Context hiện tại + Action dự kiến.      │
│ - Lấy Top 6 bài học có Score cao nhất.                                │
│ - Render thành danh sách gạch đầu dòng ngắn gọn.                       │
└────────────────────────────────────────────────────────────────────────┘
```

### Công Thức Xếp Hạng Bài Học (Scoring Algorithm):
$$\text{Score} = \text{Severity}^2 \times \Big(1 + \ln(\text{occurrence\_count})\Big) \times \text{Relevance} \times \text{TimeDecay}$$

Trong đó:
1. **Trọng số Mức độ Nghiêm trọng:** $\text{Severity}^2 \in [1, 25]$.
2. **Tần suất lặp lại:** $1 + \ln(\text{occurrence\_count})$.
3. **Độ tương thích phạm vi ($\text{Relevance}$):**
   $$\text{Relevance} = \text{ScopeRelevance} \times \text{ContextRelevance}$$
   - $\text{ScopeRelevance}$: Đúng cặp ($\text{symbol}$) = $1.0$; Cùng nhóm ($\text{group}$) = $0.7$; Dùng chung ($\text{all}$) = $0.5$.
   - $\text{ContextRelevance}$: Đúng bối cảnh hiện tại = $1.0$; Bối cảnh chung (`ANY`) = $0.4$.
4. **Hao mòn theo thời gian ($\text{TimeDecay}$):**
   $$\text{TimeDecay} = 0.9^{\Delta t_{\text{days}}}$$
   *(Bài học cũ giảm chậm hơn — vẫn học được từ lỗi nhiều ngày trước).*

---

## 5. CƠ CHẾ DEDUPLICATION & VÒNG ĐỜI HỌC HỎI

1. **Ghi nhận bài học theo đợt (Batch Learning Triggers):**
   - Chỉ kích hoạt trích xuất bài học khi:
     - Đóng rổ lệnh thành công (`CLOSE_ALL` / Normal TP).
     - Hoàn thành chu trình giải cứu thoát khỏi `RECOVERY`.
     - Lệnh bị từ chối/thất bại (`FAILED` hoặc vi phạm Safety Rails).
     - Kết thúc chu kỳ Cooldown.
2. **Chống trùng lặp (Deduplication):**
   - Hash dedupe nên gồm thêm `lesson_type` để AVOID/PREFER không đụng nhau:
     $$\text{Hash} = \text{SHA256}(\text{symbol} + \text{context\_type} + \text{action\_type} + \text{lesson\_type} + \text{trigger\_cond})$$
   - Nếu đã tồn tại Lesson trùng Hash:
     - `UPDATE` tăng `occurrence_count`, cộng `total_pl_usd`, cập nhật `win_count`/`loss_count` nếu có, `last_seen_at`.
     - Không INSERT dòng mới.
   - Nếu chưa tồn tại: `INSERT INTO Lessons`.
3. **Vô hiệu hóa Cache (Cache Invalidation):**
   - Khi INSERT/UPDATE `Lessons`: xóa/expire `MemoryCache` với cùng `symbol` **hoặc** `scope IN ('group','all')` liên quan.
4. **Tự động đào thải:**
   - Qua `LessonFeedback`: áp dụng mà `outcome='LOSS'` liên tiếp ≥ 3 → `SUPERSEDED` / `ARCHIVED`.

---

## 6. ƯỚC LƯỢNG CHI PHÍ TOKEN & TÍCH HỢP PYTHON TOOLS

- **Ước lượng Token Tiêu Thụ:**
  - Dung lượng MemoryPack: $\sim 450 \text{ tokens} \approx 0.45\text{k tokens/call}$.
  - Tần suất: 2 Agents (A & B) $\times 24$ nến H1 đóng/ngày $\approx 48 \text{ calls/ngày}$.
  - Tổng token nạp Memory: $\approx 21.6\text{k tokens/ngày/cặp}$.
  - Chi phí ước tính (DeepSeek-V3 / GPT-4o-mini): $\approx \$0.006 \sim \$0.02 \text{ USD/ngày/cặp}$.
  - Ghi nhận đầy đủ vào bảng `LLMRuns` với mục đích: `purpose = 'memory_pack'`.
- **Python Tools:**
  ```python
  def get_memory_pack(symbol: str, context_type: str, action_type: str) -> str: ...
  def record_lesson(...) -> int: ...          # qua LessonWriter single-writer
  def evaluate(plan: dict, outcome: str) -> None: ...
  def submit_feedback(lesson_id: int, outcome: str, pl: float, plan_id: str) -> None: ...
  ```
  Chi tiết map agents: [02-map-to-agents.md](02-map-to-agents.md).

---

## 7. THUẬT TOÁN XÂY DỰNG MEMORYPACK (MemoryPack Builder)

```
function build_memory_pack(symbol, context_type, action_type) -> str:
  cache_key = f"{symbol}|{context_type}|{action_type}"

  // Check cache
  cached = MemoryCache.get(cache_key)
  if cached and cached.expires_at > now():
    return cached.pack_text

  // TẦNG 1: Profile & Evergreen (≤ 150 tokens)
  profile = PairProfiles.get(symbol).profile_short    // ≤ 300 ký tự
  evergreen = Lessons.query(
    symbol=symbol, status='ACTIVE', severity=5
  ).order_by(occurrence_count.desc()).limit(2)

  t1_text = f"## Profile {symbol}\n{profile}\n"
  for lesson in evergreen:
    t1_text += f"- {lesson.lesson_text}\n"

  // TẦNG 2: Dynamic Ranked Lessons (≤ 350 tokens)
  candidates = Lessons.query(
    (symbol=symbol OR scope IN ('group','all')),
    context_type IN (context_type, 'ANY'),
    action_type IN (action_type, 'ANY'),
    status='ACTIVE',
    severity < 5    // evergreen đã ở T1
  )

  for c in candidates:
    c.score = compute_score(c, symbol, context_type)

  top6 = candidates.order_by(score.desc()).limit(6)

  t2_text = "## Bài học theo bối cảnh\n"
  for lesson in top6:
    t2_text += f"- {lesson.lesson_text}\n"

  // Gộp + estimate tokens
  pack_text = t1_text + "\n" + t2_text
  token_est = estimate_tokens(pack_text)

  // Trim nếu vượt 500 tokens
  if token_est > 500:
    // Giảm T2 xuống top 4 hoặc trim lesson_text
    ...

  // Ghi cache
  content_hash = sha256(pack_text)
  lesson_ids = [l.lesson_id for l in evergreen + top6]
  MemoryCache.upsert(
    cache_key, symbol, context_type, action_type,
    pack_text, token_est, lesson_ids, content_hash,
    ttl_seconds=3600, expires_at=now()+3600
  )

  return pack_text
```

Hàm scoring (nhắc lại từ §4):
$$\\text{Score} = \\text{Severity}^2 \\times (1 + \\ln(\\text{occurrence\\_count})) \\times \\text{Relevance} \\times \\text{TimeDecay}$$

---

## 8. CONCURRENCY `experience.db` (đa instance)

| Quy tắc | Chi tiết |
|---------|----------|
| PRAGMA | `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON` |
| Single-writer | **LessonWriter** duy nhất (process/thread) ghi `Lessons` / invalidate cache |
| Readers | Mọi instance cặp **chỉ đọc** qua `MemoryCache` / `get_memory_pack` |
| Không | Nhiều instance INSERT Lessons đồng thời |

## 9. SO SÁNH `experience.db` VÀ `dca_<symbol>.db`

| Tiêu chí | `experience.db` (Bộ Nhớ Kinh Nghiệm) | `dca_<symbol>.db` (Database Vận Hành Cặp) |
|:---|:---|:---|
| **Phạm vi (Scope)** | **Toàn cục** (Dùng chung cho mọi instance cặp tiền) | **Riêng biệt** (1 file độc quyền cho 1 cặp tiền) |
| **Bản chất dữ liệu**| Tri thức cô đọng, bài học đúc kết, cache Markdown | Hàng đợi lệnh vật lý, vị thế mở MT5, Audit log |
| **Tần suất ghi** | Rất thấp (Chỉ ghi khi đóng lệnh / thoát recovery) | Cao (Mỗi chu kỳ nến H1, polling lệnh liên tục) |
| **Ảnh hưởng an toàn**| **Advisory** (Khuyến nghị định hướng cho LLM) | **Execution** (Quyết định lệnh chạm sàn MT5) |
| **Chống phân mảnh** | Lưu trữ nhẹ, tự động Dedupe & Invalidate cache | Ghi và xóa lệnh atomic, transaction Archive |
