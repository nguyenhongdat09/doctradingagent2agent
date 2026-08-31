# GỬI CHO CURSOR — LỆNH SỬA REVIEW 3 FOLDER (bản chính thức)

> Copy TOÀN BỘ nội dung từ dòng `---` đến hết, dán vào Cursor và gửi.
> Cursor sẽ sửa 3 folder theo đúng quyết định bên dưới.

---

Đồng ý với toàn bộ review của bạn. Sửa 3 folder doc theo đúng các quyết định sau,
làm theo thứ tự CRITICAL → MEDIUM → MINOR. Sau khi sửa, tự chạy checklist đối chiếu
chéo rồi báo cáo danh sách file đã sửa.

═══════════════════════════════════════════
[CRITICAL]
═══════════════════════════════════════════

1. QUEUE-ONLY — thống nhất 1 đường execute duy nhất
   - Agents KHÔNG bao giờ OrderSend trực tiếp.
   - Mọi action (ENTRY / DCA / RECOVERY_DCA / PAYOFF / CLOSE_ALL / PARTIAL_CLOSE)
     chỉ được GHI 1 dòng PENDING vào `MarketOrderInfo` → Executor thread (luôn
     thường trực) poll → claim PROCESSING (atomic) → OrderSend lên MT5 → thành công:
     XÓA dòng + lưu Archive; thất bại: status=FAILED + error + alert.
   - Sửa HẾT prose + diagram còn kiểu cũ ("A OrderSend trực tiếp") thành
     "A INSERT MarketOrderInfo → Executor OrderSend". Đặc biệt kiểm tra:
     06-entry-flow, 07-dca-dual-review-loop, 09-runtime-architecture,
     10-11 python notes, A01-a2a-sequence, A04-dca-dual-review, Boss flow.
   - CLOSE_ALL / PARTIAL_CLOSE cũng qua bảng MarketOrderInfo.

2. BOSS v1: KHÔNG có Override
   - Xóa bỏ `BossOverride`, `BOSS_OVERRIDE_EXEC`, `BOSS_FORCE` ở v1.
   - Boss chỉ được: `BossWake` + bàn luận 3 bên (Boss–A–B); quyết định cuối LUÔN là
     A+B đồng thuận + HardValidator.
   - Khi B dissent và Boss vẫn muốn đi tiếp → DEFER (không ép lệnh).
   - Xóa/làm sạch ở: 02-agent-roles, 03-consensus-protocol, 04-message-schemas,
     11-boss-interrupt-flow, A02-consensus-state, README doc_agents.
   - Giữ khái niệm "Boss chỉ góp ý, không quyết định/đặt lệnh" xuyên suốt.

3. EXPERIENCE DB — nối vào hệ thống
   - Thêm tools sau vào danh sách tools agents (09-data-sources, 11-python-engine-notes,
     doc_agents/13-experience-loop, sequence D08/A01):
     `get_memory_pack(symbol, context, action)`,
     `record_lesson(...)`,
     `evaluate(plan, outcome)`,
     `submit_feedback(lesson_id, outcome, pl)`.
   - Vị trí gọi: (a) TRƯỚC khi A lập plan → `get_memory_pack` (đưa pack vào prompt
     A và B; B dùng pack để bắt lỗi A vi phạm); (b) SAU lệnh đóng/kết thúc →
     `LessonFeedback` → cập nhật stats.
   - Sửa DDL `LessonFeedback.outcome`: CHECK IN ('WIN','LOSS','FLAT','NA') — BỎ 'FAIL'.
   - Khớp diagrams E01–E03 với DDL; nếu invalidation cache dùng cột `scope` thì thêm
     cột `scope` vào bảng `MemoryCache` cho khớp.

4. PYTHON-FIRST — bỏ dual platform
   - Xóa/archive file `10-mql5-implementation-notes.md` (orphan, trùng số với
     `10-sqlite-design.md`). Tạo lại ghi chú kiến trúc Python-first nếu cần
     (ví dụ `11-python-engine-notes.md`).
   - Rà 01-system-overview, 08-parameters, 09-data-sources: bỏ mọi cụm "MQL5 input /
     EA / input parameter MQL5"; thay bằng "Python engine + config".
   - MT5 chỉ đóng vai: nguồn dữ liệu (nến D1/H1, positions, account) + adapter
     đánh lệnh qua Executor (python-ctypes hoặc MetaTrader5 package).

═══════════════════════════════════════════
[MEDIUM]
═══════════════════════════════════════════

5. Đổi hết `STRONG_UP` / `STRONG_DOWN` / `STRONG_*` còn sót trong doc_agents
   (04-message-schemas, 06-entry-flow) → `PUSH_UP` / `PUSH_DOWN` / `PUSH_*`.

6. Soft zone [0.4, 0.6): GIỮ khái niệm = WAIT + ghi log "soft zone (chất lượng yếu)",
   không entry, không bỏ. Chỉ `strength_final >= 0.6` mới vào matrix.

7. Thống nhất tham số (khớp 08-parameters):
   - `W_LocPenalty` default = 0.2 (bằng W_Loc).
   - Xóa `PushMin` — chỉ dùng `PushEnter=0.6` và `PushIgnore=0.4`.
   - `InpHysteresisMode` thay bằng 2 flag đã có: `HysteresisNeedTwoSwings`,
     `HysteresisAllowStrongBOS`.

8. Viết 1 mục chung "SAFETY RAILS vs HardValidator" (đặt trong 01-system-overview
   hoặc 04-decision-matrix):
   - `HardValidator` = lớp deterministic chạy trong engine, gồm 5 checks:
     (1) matrix action hợp lệ, (2) spacing/ladder đúng, (3) RECOVERY cấm mở ngược,
     (4) lot NormalizeLot theo bước broker, (5) kill-switch.
   - `SAFETY RAILS` = khái niệm bao trùm (gồm HardValidator + hysteresis + ngưỡng
     matrix); dùng thống nhất hai thuật ngữ này khắp doc.

9. Lập 1 bảng map enum action dùng chung (đặt ở 00-glossary):
   `OPEN_BUY / OPEN_SELL` (= ENTRY), `DCA`, `RECOVERY_DCA`, `PAYOFF_REDUCE`,
   `CLOSE_ALL`, `PARTIAL_CLOSE`, `WAIT`. Thống nhất toàn bộ doc + diagrams.

10. TimeDecay trong Experience DB: đổi `0.6^days` → `0.9^days`
    (giữ bài học lâu hơn; người cần học từ lỗi cách đó nhiều ngày).

11. Concurrency `experience.db` (dùng chung nhiều instance):
    ghi rõ `PRAGMA journal_mode=WAL`, `busy_timeout=5000`, và **single-writer**
    (LessonWriter duy nhất ghi lessons; các instance đọc qua MemoryCache).

═══════════════════════════════════════════
[MINOR]
═══════════════════════════════════════════

12. README doc_agents: sửa link sai (A06 ghi LR nhưng file là TD); thêm `A08` vào
    danh sách diagram/PROMPT nếu đang thiếu.

13. `09-data-sources`: bỏ cụm "ATR breakout" cũ → thay bằng "Strength Score".
    Rà các chỗ còn nói thuật ngữ cũ.

14. `doc_experience`: thêm mục "map-to-agents" — bảng agents (A/B) dùng tool nào
    (get_memory_pack, record_lesson, submit_feedback...) và vị trí trong flow.

═══════════════════════════════════════════
CHECKLIST ĐỐI CHIẾU CUỐI (chạy sau khi sửa, báo kết quả)
═══════════════════════════════════════════

- [ ] Không còn reference kiểu cũ ("A OrderSend" trực tiếp) ở bất kỳ đâu.
- [ ] Không còn BossOverride / BOSS_OVERRIDE_EXEC / BOSS_FORCE.
- [ ] Mọi action đều qua `MarketOrderInfo` queue → Executor.
- [ ] `get_memory_pack` được gọi đúng bước trước A plan; `LessonFeedback` sau lệnh.
- [ ] DDL Experience DB khớp diagrams E01–E03; không còn outcome='FAIL'.
- [ ] Tham số thống nhất (W_LocPenalty, PushEnter/PushIgnore, hysteresis flags).
- [ ] 09-data-sources không còn thuật ngữ cũ.
- [ ] README 3 folder đều khớp file thực tế (không link chết).