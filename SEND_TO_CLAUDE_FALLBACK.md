# GỬI CHO CLAUDE — CHỐT FALLBACK KHI LLM KHÔNG KHẢ DỤNG

> Copy TOÀN BỘ nội dung từ dòng `---` đến hết, gửi cho Claude.

---

Tôi chọn phương án và chốt như sau:

## Quyết định Fallback: chọn (a) Freeze + Boss làm bộ não dự phòng

**Default: FREEZE hoàn toàn + Alert Boss. KHÔNG có degrade tự động về rule-only.**
Không cho phép bất kỳ cơ chế tự động nào (engine) thay thế LLM khi LLM down.

### 1. Khi LLM API down / timeout / không khả dụng

| Tình huống | Hành động |
|---|---|
| LLM không trả lời (timeout/error/rate limit) | System chuyển **state FREEZE** (một trạng thái hệ thống, không phải pair state) |
| Mọi action | **Đóng băng hoàn toàn** — engine KHÔNG tự DCA/close/entry. Mọi position GIỮ NGUYÊN. |
| Alert | **Alert Boss ngay** (qua kênh Boss channel / log) với lý do LLM down |
| Pair state | Giữ nguyên FLAT/NORMAL/RECOVERY (không thay đổi do freeze) |

### 2. Boss = bộ não dự phòng duy nhất

- Khi FREEZE, **Boss (con người) là người duy nhất được phép can thiệp**.
- Boss qua kênh Boss channel, nhìn positions + snapshot, **gợi ý/định hướng** hành động
  (vd: "AUDCAD nên close bớt", "chờ LLM hồi rồi mới DCA").
- **Không có cơ chế nào để engine tự thoát FREEZE.** Freeze chỉ kết thúc khi LLM khôi phục
  (auto-resume an toàn) hoặc Boss điều chỉnh thủ công.

### 3. Tách bạch rõ: không auto-degrade, nhưng giữ kill-switch thủ công

- Kill-switch thủ công (InpKillSwitch / Flatten — do con người bấm) VẪN còn, như một
  công cụ khẩn cấp của con người, **KHÔNG tự động kích hoạt**.
- Nếu LLM down và Boss thấy rổ đang nguy hiểm → Boss chủ động dùng kill-switch FLATTEN
  thủ công. Không có luật "auto-flatten sau N phút".

> Lý do giữ nguyên tắc: hệ thống này lấy ALL-LLM làm giá trị cốt lõi. Khi "bộ não" hỏng,
> đúng đắn là dừng lại + gọi người (Boss), KHÔNG đổi sang một "bộ não tự động cấp thấp"
> (rule-only) vì điều đó phản bội mục đích của hệ thống.

## Việc cần ghi vào doc

1. `12-operations-reliability.md`: thêm mục **FREEZE state & LLM-outage handling** theo
   đúng quyết định trên (freeze + alert Boss + không auto-degrade + kill-switch thủ công).
2. `04-message-schemas.md`: thêm trạng thái `SYSTEM_FREEZE` (hoặc flag) + event `ALERT_LLM_OUTAGE`.
3. `14-llm-prompt-spec.md`: lưu ý system prompt không được bypass freeze.
4. `10-autonomy-constraints.md`: ghi rõ "không có cơ chế auto-degrade khi LLM down".
5. Cập nhật ERRATA thêm quyết định này (DEC-08).

Xác nhận và cập nhật theo quyết định này, rồi tiếp tục kế hoạch 7 bước ban đầu.