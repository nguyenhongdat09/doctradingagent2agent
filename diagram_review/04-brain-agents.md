# 04 - BỘ NÃO QUYẾT ĐỊNH "ALL-LLM" & CONSENSUS PROTOCOL

> **File sơ đồ Mermaid tương ứng**: [04-brain-agents.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/04-brain-agents.mmd)

---

## 1. Triết Lý Cốt Lõi: ALL-LLM (Trí Tuệ Nhân Tạo Ra Quyết Định)

Hầu hết các bot DCA truyền thống trên thị trường bị "cháy tài khoản" vì nhồi lệnh mù quáng bằng code cứng vô tri (cứ giá đi ngược $X$ pips là nhồi). 

Trong hệ thống của chúng ta:
- **100% quyết định mở lệnh, nhồi DCA, cắt lệnh, lướt sóng cứu lỗ (Payoff)** đều phải thông qua sự suy luận logic của LLM.
- **Mô hình 2 Agent đối trọng (Dual-Agent)**: Loại bỏ thiên kiến chủ quan (Confirmation Bias) bằng cách bắt buộc 1 Agent chuyên đề xuất và 1 Agent chuyên phản biện/tìm lỗi.

---

## 2. Quy Trình Phản Biện & Đồng Thuận (Consensus Protocol)

1. **Agent A (Strategist)**: Nhận dữ liệu thị trường và bài học kinh nghiệm, suy luận và đưa ra đề xuất `TradePlan`.
2. **Agent B (Challenger & Risk Reviewer)**: 
   - Đóng vai "Luật sư của quỷ" (Devil's Advocate).
   - Tự phân tích độc lập và tìm lý do tại sao lệnh này có thể bị thua lỗ (Tin tức sắp ra? Kháng cự quá gần? Trend D1 đang quá mạnh?).
   - Bỏ phiếu:
     - `APPROVE`: Đồng ý hoàn toàn với kế hoạch của A.
     - `CHALLENGE`: Đưa ra lý do phản đối và yêu cầu A điều chỉnh lại khối lượng hoặc chiến thuật (Tối đa 2 vòng thảo luận).
     - `VETO`: Phủ quyết tuyệt đối nếu phát hiện rủi ro chết người.
3. **Quy tắc an toàn**: Nếu sau 2 vòng tranh luận mà vẫn bất đồng ý kiến $\rightarrow$ **Hủy bỏ toàn bộ kế hoạch, chọn hành động WAIT** (Không giao dịch là bảo toàn vốn).

---

## 3. HardValidator: 5 Kiểm Tra An Toàn Bằng Code Python

Sau khi 2 LLM đã đồng thuận, kế hoạch JSON vẫn phải đi qua 5 cổng kiểm tra cứng bằng code:

1. **Matrix Action Check**: Kiểm tra hành động đề xuất có khớp với ma trận quyết định `Context D1 × PUSH H1` ($\ge 0.60$) hay không.
2. **Spacing / Ladder Check**: Nếu là lệnh `DCA`, khoảng cách giá hiện tại so với lệnh gần nhất phải thỏa mãn `spacing_met` (tính từ ATR).
3. **Basket Direction Check**: Tuyệt đối cấm mở lệnh ngược hướng với rổ lệnh hiện tại (đặc biệt khi đang ở trạng thái `RECOVERY`).
4. **NormalizeLot Check**: Khối lượng lot phải được làm tròn chuẩn xác theo bước nhảy volume tối thiểu của sàn giao dịch/broker (ví dụ: step 0.01). Hệ thống không đặt trần cứng lot (`MaxLot = 0`) mà quản trị theo quy tắc sizing của State Machine và Payoff ($15\% - 30\%$).
5. **Kill-Switch Check**: Kiểm tra cờ ngắt khẩn cấp `SYSTEM_FREEZE` đang ở trạng thái OFF. Nếu đang FREEZE, từ chối đưa lệnh vào queue.
