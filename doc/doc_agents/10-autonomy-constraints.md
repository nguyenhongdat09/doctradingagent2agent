# 10 — Autonomy & Constraints

> **NGUYÊN TẮC BẤT BIẾN (ALL-LLM):** MỌI quyết định giao dịch (ENTRY, DCA, RECOVERY_DCA, PAYOFF_REDUCE, CLOSE_ALL, PARTIAL_CLOSE, kể cả WAIT) do Agent A+B phân tích và consensus. **KHÔNG có rule cứng tự động** kiểu EA truyền thống. Engine (mắt) chỉ là nguồn dữ liệu.

## 1. Mặc định 0-human (AUTO)

A↔B đủ để enqueue; Executor đánh lệnh. Boss không cần có mặt.

## 2. Ngoại lệ

| Ngoại lệ | Mục đích |
|----------|----------|
| BossWake / hội đồng | Boss can thiệp khi agents ngủ — **chỉ bàn, không Override v1** |
| UncertaintyEscalation | Agent A/B chủ động hỏi Boss qua Telegram khi mơ hồ — Phán quyết của Boss là Mệnh lệnh ràng buộc ([chi tiết](15-uncertainty-escalation.md)) |
| KillSwitch / Flatten | Emergency out-of-band → Boss/operator bật **thủ công** → Executor flatten qua queue |
| SYSTEM_FREEZE | LLM down → đóng băng toàn bộ + alert Boss — Boss là bộ não dự phòng duy nhất |

## 3. Ràng buộc KHÔNG đàm phán

1. **MỌI action vào/ra/sửa vị thế** phải qua Agent A+B consensus + HardValidator.
2. **KHÔNG có rule cứng tự động** ra lệnh — engine chỉ cung cấp dữ liệu/gợi ý.
3. AUTO/BOSS đều cần B.APPROVE hợp lệ.
4. HardValidator PASS trước enqueue.
5. Không `BossOverride` / `BOSS_FORCE` ở v1 (trong chế độ BossWake chủ động).
6. RECOVERY không mở ngược.
7. Ballot thiếu evidence → không APPROVE.
8. **Khi LLM down**: SYSTEM_FREEZE — KHÔNG auto-degrade về rule-only; Boss can thiệp thủ công.
9. **Kill-switch KHÔNG tự kích hoạt** — chỉ Boss/operator bật thủ công.
10. **Tuân lệnh Boss khi Escalate (Boss Directive):** Khi A hoặc B đã chủ động hỏi Boss, phán quyết của Boss là mệnh lệnh tối cao. Nếu Boss không chấp nhận, từ chối phân tích/đề xuất hoặc chỉ thị WAIT/DỪNG/HỦY, cả A và B **BẮT BUỘC TUÂN THỦ 100%**, tuyệt đối CẤM tự ý cho là Boss sai rồi làm trái ý Boss.
11. **Không giới hạn tần suất escalation:** Agent mơ hồ thì hỏi, không cần e ngại.
12. **Timeout 30 phút:** Hết → Agent tự quyết + thông báo Boss giải pháp đã chọn.
13. **Boss reply trễ:** Ghi nhận nhưng thông báo Boss rằng Agent đã tự quyết.

## 4. Phân tầng trách nhiệm

| Thành phần | Vai trò | Được làm | KHÔNG được làm |
|---|---|---|---|
| **Engine (mắt)** | Cảm biến + máy tính | Tính swing, score, spacing, snapshot; gợi ý | Enqueue lệnh, quyết định action |
| **LLM A+B (não)** | Người quyết định duy nhất | Phân tích → đề xuất → phản biện → consensus | — |
| **Executor (tay)** | Thực thi cơ khí | Claim PENDING → OrderSend MT5 → Archive | Quyết định BUY/SELL, sửa plan |
| **Boss (giám sát)** | Can thiệp ngoại lệ | BossWake, bàn luận, kill-switch thủ công | Override v1, OrderSend |

## 5. Audit

Mọi enqueue + ExecutionReport lưu plan_id, ballot, queue_row_id, tickets.
