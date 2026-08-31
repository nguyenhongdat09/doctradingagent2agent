# GỬI CHO GEMINI — HOÀN THIỆN 6 ĐIỂM NHỎ (doc_flow_code + docs)

> Copy TOÀN BỘ nội dung từ dòng `---` đến hết, gửi cho Gemini.
> Đây là lượt hoàn thiện CUỐI trước khi chuyển sang code. Không thay đổi kiến trúc đã chốt.

---

Cảm ơn bạn đã sửa rất đầy đủ. Còn 6 điểm nhỏ cần hoàn thiện (không thay đổi kiến trúc đã chốt, chỉ tăng chất lượng doc):

## 1. Thêm `config/secrets.env` + `.gitignore` vào file tree
- Trong `01-architecture-and-project-structure.md`, cây thư mục `config/` hiện chỉ có `default_config.yaml` + `symbols.yaml`.
- Thêm: `config/secrets.env` (chứa MT5_ACCOUNT, MT5_PASSWORD, MT5_SERVER, LLM_API_KEYS, BOSS_SECRET_KEY) — KHÔNG commit lên git.
- Thêm file gốc `.gitignore` liệt kê: `config/secrets.env`, `data/*.db`, `logs/`, `venv/`, `__pycache__/`.

## 2. Thêm `python main.py --all` (spawn N process)
- `main.py` hiện chỉ nhận `--symbol`.
- Bổ sung flag `--all`: đọc `symbols.yaml`, spawn 1 child process cho mỗi cặp (giống `supervisor`/`multiprocessing`), giúp chạy nhiều cặp bằng 1 lệnh. Khi spawn xong báo PID từng instance + path log.
- Ghi rõ: `--symbol` dùng khi muốn chạy 1 cặp lẻ; `--all` dùng khi muốn chạy toàn hệ thống.

## 3. Nhắc lại concurrency `experience.db` trong Phase 4
- Trong `05-phase-4-orchestrator-operations.md`, thêm 1 lưu ý:
  **LessonWriter chạy ở 1 process riêng (single-writer); các instance cặp CHỈ ĐỌC qua `MemoryCache`/`get_memory_pack`** — tránh xung đột ghi chéo khi nhiều process chạy đồng thời.

## 4. Ghi rõ `LLMRuns.purpose` để đo chi phí MemoryPack
- Trong bảng `LLMRuns` (10-sqlite-design + 02-phase-1), thêm chú thích: khi gọi `get_memory_pack`, ghi `purpose = 'memory_pack'` để tách riêng chi phí bộ nhớ kinh nghiệm (đúng ADR-008).
- Mặc định `purpose` cho các call A/B khác: `'context_analysis'`, `'signal_analysis'`, `'ballot'`, `'plan'`, `'revision'`.

## 5. Checklist đối chiếu chéo 4 doc (thêm vào 07-developer-checklist)
- Thêm mục cuối "Cross-Doc Consistency Check":
  - [ ] Không còn file nào nói "1 process chạy 4 cặp" (đã chuyển per-cặp).
  - [ ] `doc_flow_code` khớp `doc_phuong_phap`, `doc_agents`, `doc_experience` (tên module/tool/folder đồng nhất).
  - [ ] 2 diagram D01 + A03 không còn vẽ "DCA tự động" (đã qua A+B).
  - [ ] Số bảng DB thống nhất = 9 (đã có LLMRuns).

## 6. Naming/Link tối ưu
- Rà toàn bộ `doc_flow_code` đảm bảo đường dẫn relative link đúng (vd: `../doc_phuong_phap/10-sqlite-design.md`, `../doc_agents/14-llm-prompt-spec.md`).
- Nếu file tree có chỗ nào tên file/class lệch giữa doc (vd `basket_metrics.py` vs nơi khác gọi `BasketMetrics`), thống nhất 1 tên duy nhất.

## Sau khi xong
Báo cáo: danh sách file đã sửa + xác nhận 6 mục trên + 1 câu tóm tắt trạng thái "sẵn sàng code Phase 1" hay còn thiếu gì.