# GỬI CHO CLAUDE — PHẢN BIỆN & BỔ SUNG TRƯỚC KHI THỰC HIỆN 7 BƯỚC

> Copy TOÀN BỘ nội dung từ dòng `---` đến hết, gửi cho Claude.

---

Task tracker của bạn đúng hướng, tôi đồng ý. Nhưng trước khi bạn thực hiện, cần làm rõ
3 điểm sau — nếu thiếu sẽ tái phạm đúng lỗi "prose vs diagram lệch" và "bỏ lỡ nhịp DCA".

## 1) CHECKLIST HIỆN LÀ KẾ HOẠCH, CHƯA PHẢI KẾT QUẢ

Các checkbox trong tracker đều đang rỗng `[]`. Yêu cầu: bạn phải **THỰC SỰ SỬA FILES**,
không chỉ lập list. Sau khi làm xong, báo cáo **KÈM NỘI DUNG CỤ THỂ** đã thay đổi
(không chỉ "đã sửa file X" — ghi rõ đoạn nào đổi thành gì), để user đối chiếu được.
Cảnh báo: trước đây có lần "đã xóa/sửa" nhưng thực tế file vẫn còn — lần này phải
verify trong chính quá trình làm.

## 2) BẮT BUỘC CẬP NHẬT CẢ DIAGRAMS, KHÔNG CHỈ PROSE

Step 1 chỉ liệt kê file `.md`. Nhưng các diagram Mermaid CŨ vẫn vẽ DCA theo spacing tự
động (và action không qua agents). Phải cập nhật song song:
- `doc_phuong_phap/diagrams/D02-pair-state-machine.mmd`
- `doc_phuong_phap/diagrams/D03-recovery-activity.mmd`
- `doc_phuong_phap/diagrams/D08-decision-sequence.mmd`
- `doc_agents/diagrams/A01-a2a-sequence.mmd`, `A04-dca-dual-review.mmd`

Nếu chỉ sửa prose mà bỏ diagrams → lại rơi vào lỗi prose/diagram lệch.

## 3) LÀM RÕ TIMING DCA NORMAL (quan trọng nhất)

Có mâu thuẫn tiềm ẩn giữa "quyết định neo H1 close" và việc DCA cần lấp rổ kịp khi
giá đi ngược. Chốt như sau:

- **ENTRY (mở lệnh đầu) + RECOVERY signal mạnh:** dựa trên H1 close (tín hiệu nến đóng).
- **DCA (NORMAL & RECOVERY): agents wake theo C3 (dynamic, vài phút/lần khi đang có lệnh)
  và xét DCA NGAY khi spacing đủ + A+B đồng thuận — KHÔNG chỉ chờ H1 close**, để không
  bỏ lỡ nhịp lấp rổ khi giá chạy ngược giữa nến.

Ghi rõ quy tắc này vào: `05-capital-dca.md` (spacing = điều kiện kích được xét mỗi wake),
`07-dca-dual-review-loop.md` (DCA xét ở mỗi wake, không defer), `05-scheduler-wakeup.md`
(C3 wake khi NORMAL/RECOVERY kích hoạt xét DCA). HardValidator vẫn giữ: DCA chỉ khi
spacing đủ + luôn cùng BasketDir + NormalizeLot + kill-switch.

## 4) FREEZE → RESUME: làm rõ cơ chế thoát FREEZE

- Khi LLM hồi phục → hệ thống **tự resume cycle bình thường** (engine vẫn là data,
  LLM sẵn sàng trở lại → tiếp tục quyết định), không cần thao tác đặc biệt.
- Sau resume, chạy 1 bước **reconcile nhẹ**: refresh positions MT5 vs PairState để chắc
  state đúng trước khi xử lý tiếp.
- Ghi vào `12-operations-reliability.md`: FREEZE (LLM down) → alert Boss → khi LLM up
  → auto-resume + reconcile.

## Ghi chú thêm cho Step 1
- `doc_agents/09-runtime-architecture.md` + `04-message-schemas.md`: làm rõ
  `SYSTEM_FREEZE` state + `ALERT_LLM_OUTAGE` event (đưa vào schema).
- `ERRATA.md` (Step 2): DEC-01 bãi bỏ; thêm FREEZE/resume (DEC-08) + DCA timing mỗi wake
  (DEC-09).

Xác nhận 4 điều trên (nhất là #3 timing DCA), rồi mới bắt tay thực hiện 7 bước và
báo cáo kèm nội dung thay đổi cụ thể.