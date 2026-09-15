# 📋 TỔNG HỢP NÂNG CẤP: PLAN TẠM - PLAN CHỐT, PRICE ACTION & CẮT TỈA KỊCH BẢN (PLAN PRUNING)
> **Ngày phát hành:** 15/09/2026  
> **Phiên bản:** Kiến trúc A2A v2.1 — *Provisional/Committed Lifecycle, Price Action Dynamics & Plan Pruning*  
> **Dành cho:** Toàn bộ đội ngũ Phát triển (AI Agent Dev, Backend Dev, Database Admin, QA/Tester)

---

## 🎯 1. Mục Đích & Bối Cảnh Của Lần Nâng Cấp Này

Sau khi chuyển hệ thống sang mô hình **Stateful & Contingency Planning**, lần nâng cấp v2.1 này giải quyết sâu hơn về **chất lượng ra quyết định và tối ưu năng lực suy luận của LLM**:
1. **Phân biệt vòng đời Plan (Plan Tạm vs Plan Chốt):** Tránh việc nhầm lẫn giữa đề xuất đang thương lượng và kế hoạch hành động chính thức.
2. **Ra quyết định dựa trên Price Action (Lực nến & Phản ứng nến):** Trader thực thụ không bao giờ chỉ nhìn mức giá đơn thuần. Bot phải biết quan sát cách giá tiến vào vùng cản (lực nến mạnh hay yếu), và chỉ vào lệnh khi có nến xác nhận hãm lực / đảo chiều (nến rút râu, nến đổi màu, pinbar, v.v.).
3. **Cơ chế Cắt tỉa & Tinh chỉnh Kịch bản (Plan Pruning & Dynamic Focusing):** Khi thị trường biến động mạnh theo một chiều và phá vỡ kịch bản đảo chiều, hệ thống tự động **xóa bỏ nhánh kịch bản đối lập đã lỗi thời**, đồng thời **tinh chỉnh nhánh hiện tại** (dời cản, nâng cao tiêu chuẩn nến xác nhận). Việc này giúp rút ngắn bộ nhớ context, loại bỏ nhiễu và giúp LLM tập trung tối đa vào diễn biến thực tế.
4. **Context Ràng Buộc (Trend & Pullback):** Khẳng định nguyên tắc mua khi giảm mạnh / bán khi tăng mạnh chỉ áp dụng trong bối cảnh sóng hồi (Buy dip trong Uptrend, Sell rally trong Downtrend).

---

## 🌟 2. So Sánh Chi Tiết Trước & Sau Lần Nâng Cấp Này

| Hạng mục | Phiên bản v2.0 (Hôm qua) | Phiên bản v2.1 (Nâng cấp này) |
| :--- | :--- | :--- |
| **Vòng đời Kế hoạch** | Chỉ có 1 khái niệm Plan chung chung lưu vào DB. | **Tách biệt 2 loại:** **Plan Tạm** (`PROVISIONAL` - đang soạn thảo/chuyển giao giữa các Agent) và **Plan Chốt** (`COMMITTED` - 100% Agent đồng thuận, chỉ ghi DB khi đã chốt). |
| **Tiêu chí Kích hoạt Lệnh (Trigger)** | Chủ yếu dựa vào mốc giá (`price_level >= X`). | **Price Action toàn diện:** Mốc giá + Lực tiếp cận (`approach_momentum`) + Nến phản ứng xác nhận (`candle_reaction`: rút râu, cụm nến đỏ/xanh đảo chiều, hãm lực). |
| **Hành vi khi thị trường đi một chiều quá mạnh** | Plan vẫn giữ nguyên cả 2 đầu tăng/giảm $\rightarrow$ LLM dễ bị phân tâm hoặc chặn đầu xe lửa. | **Plan Pruning:** Tự động cắt bỏ nhánh kịch bản đã lỗi thời, giữ lại và tinh chỉnh sâu nhánh đang chạy để LLM tập trung suy luận. |
| **Quy tắc nạp vào chu kỳ kế tiếp** | Nạp Plan của chu kỳ trước. | **Chỉ nạp duy nhất Plan Chốt (`COMMITTED`)**. Các Agent **bị khóa quyền phân tích lại biểu đồ**, chỉ đóng vai trò giám sát viên đối chiếu nến mới với Plan Chốt. |
| **Bộ nhớ & Token LLM** | Prompt Plan chứa toàn bộ các kịch bản cũ dù không xảy ra. | **Siêu tinh gọn:** Nhờ cắt tỉa (Pruning), kích thước Plan giảm thêm **40%**, giúp LLM suy luận sắc bén và chuẩn xác hơn. |

---

## 🏗️ 3. Ba Trụ Cột Nâng Cấp Nghiệp Vụ & Kỹ Thuật

### 3.1. Trụ Cột 1: Vòng Đời Plan Tạm vs Plan Chốt

```
[Agent A (Planner)] ──(Tạo Draft)──> [PLAN TẠM (PROVISIONAL)]
                                             │
                                             ▼
                                     [Agent B (Challenger)]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             [B Đồng thuận (APPROVE)]                    [B Phản biện (CHALLENGE)]
                       │                                           │
                       │                                 Kèm Counter-Plan cụ thể
                       │                                           │
                       │                                           ▼
                       │                                   [Agent A Reconcile]
                       │                                 (Sinh Plan Tạm vòng 2)
                       │                                           │
                       │                                           ▼
                       │                                   [B Ký duyệt vòng 2]
                       └─────────────────────┬─────────────────────┘
                                             │ (Khi 100% Agent đồng thuận)
                                             ▼
                                  [PLAN CHỐT (COMMITTED)]
                                             │
                        ┌────────────────────┴────────────────────┐
                        ▼                                         ▼
           [Ghi xuống Database/Cache]                 [Nạp cho Micro Cycle sau]
           (is_active = TRUE)                         (CẤM phân tích lại từ đầu)
```

- **Mở rộng tương lai:** Nếu có thêm Agent C, sau khi A và B thống nhất, Plan đó vẫn là **Plan Tạm** gửi sang C. Chỉ khi C duyệt thì mới thành **Plan Chốt**.

---

### 3.2. Trụ Cột 2: Price Action & Lực Nến Trong Kịch Bản Plan

Kịch bản trong Plan không chỉ còn là con số giá khô khan, mà mô tả đúng tư duy của Trader chuyên nghiệp:
- **Vùng giá (Zone):** Vùng kháng cự/hỗ trợ quan trọng (không phải 1 mức giá đơn lẻ).
- **Lực tiếp cận (Approach Momentum):** Giá tiến vào vùng bằng nến mạnh hay nến yếu dần?
- **Phản ứng nến (Candle Reaction Confirmation):**
  - Cần thấy nến rút râu (Wick rejection / Pinbar)?
  - Cần thấy cụm nến đổi màu (ví dụ: đang tăng gặp 2 nến đỏ liên tiếp)?
  - Cần thấy nến thân ngắn, nén biên độ (hãm đà tăng/giảm)?
- **Kiểm tra bối cảnh (Context Check):**
  - Chỉ canh **BÁN khi tăng mạnh (Sell the rally)** nếu D1/H1 là **DOWNTREND** hoặc chạm biên trên **SIDEWAY**.
  - Chỉ canh **MUA khi giảm mạnh (Buy the dip)** nếu D1/H1 là **UPTREND** hoặc chạm biên dưới **SIDEWAY**.

---

### 3.3. Trụ Cột 3: Thuật Toán Cắt Tỉa Kịch Bản (Plan Pruning & Focusing)

**Kịch bản thực tế:**
1. Đầu phiên: Plan Chốt có 2 nhánh:
   - *Nhánh TĂNG:* Giá lên 2315 chờ đảo chiều để BÁN.
   - *Nhánh GIẢM:* Giá xuống 2295 chờ đảo chiều để MUA.
2. Thực tế: Tin tức ra, giá phóng thẳng từ 2305 lên 2318 bằng **3 cây nến xanh H1 thân đặc, volume lớn, không có bóng nến trên**.
3. **Thuật toán Plan Pruning thực thi:**
   - **BƯỚC 1 (Cắt tỉa - Prune):** Xóa ngay *Nhánh GIẢM (Mua ở 2295)* vì giá đã chạy xa hơn 200 pip, giữ lại chỉ làm rác bộ nhớ.
   - **BƯỚC 2 (Đánh giá lực):** Giá chạm 2315 nhưng nến không hề có tín hiệu hãm đà $\rightarrow$ **CẤM BÁN VỘI (Không chặn đầu xe lửa)**.
   - **BƯỚC 3 (Tinh chỉnh & Focus - Refine):** Cập nhật lại Plan Chốt:
     - Dời vùng quan sát lên kháng cự tiếp theo (2325 - 2328).
     - Ràng buộc: *Bắt buộc phải có tối thiểu 2 nến H1 rút râu trên hoặc 1 nến Bearish Engulfing đóng cửa rõ ràng mới được vào lệnh BÁN.*
   - **Kết quả:** Plan mới cực kỳ cô đọng, chỉ có 1 hướng trọng tâm, loại bỏ hoàn toàn nguy cơ LLM bị loạn kịch bản.

---

## 📁 4. Chi Tiết Các File Được Cập Nhật

1. **[`doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md`](file:///e:/PythonProject/doctradingagent2agent/doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md)**:
   - Bổ sung định nghĩa vòng đời `plan_state: PROVISIONAL | COMMITTED`.
   - Bổ sung cấu trúc dữ liệu `price_action_reaction` và `approach_momentum`.
   - Bổ sung quy trình và pseudo-code thuật toán `Plan Pruning & Dynamic Focusing`.
2. **[`doc/doc_agents/03-consensus-protocol.md`](file:///e:/PythonProject/doctradingagent2agent/doc/doc_agents/03-consensus-protocol.md)**:
   - Bổ sung quy tắc: Plan chỉ chuyển từ `PROVISIONAL` sang `COMMITTED` khi 100% Agent đồng thuận.
   - Quy định: Khi đã có Plan Chốt, chu kỳ sau cấm Agent phân tích lại biểu đồ từ đầu.
3. **[`doc/doc_agents/04-message-schemas.md`](file:///e:/PythonProject/doctradingagent2agent/doc/doc_agents/04-message-schemas.md)**:
   - Cập nhật schema `UnifiedContingencyPlan`: thêm trường `plan_state`, `approach_momentum`, `candle_reaction`.
4. **[`doc/doc_agents/05-scheduler-wakeup.md`](file:///e:/PythonProject/doc/doc_agents/05-scheduler-wakeup.md)**:
   - Cập nhật luồng đánh thức: Chỉ đọc Plan Chốt; nếu giá đi một chiều thì thực thi bước cắt tỉa kịch bản (Plan Pruning).
5. **[`doc/doc_agents/07-dca-dual-review-loop.md`](file:///e:/PythonProject/doctradingagent2agent/doc/doc_agents/07-dca-dual-review-loop.md)**:
   - Áp dụng Price Action vào lệnh DCA: DCA khi giá hồi nhưng phải có nến hãm lực, không DCA mù quáng khi nến đang xả quá mạnh.

---

## 🛠️ 5. Hướng Dẫn Cụ Thể Cho Dev (Implementation Checklist)

### Cho Backend Dev:
- [ ] Trong bảng `contingency_plans`, thêm trường `plan_state VARCHAR(16) NOT NULL DEFAULT 'COMMITTED'` (hoặc `PROVISIONAL`).
- [ ] Khi lưu DB, chỉ những Plan có trạng thái `COMMITTED` mới được đánh dấu `is_active = TRUE`.
- [ ] Viết hàm `prune_and_focus_plan(active_plan, market_delta)`:
  - Nếu `current_price` vượt qua ngưỡng kịch bản A nhưng nến `momentum == STRONG_UNBROKEN`:
    - Xóa các kịch bản đối lập trong `active_plan.scenarios`.
    - Trả về Plan đã cắt tỉa cho A & B cập nhật nhanh.

### Cho AI / Prompt Engineer:
- [ ] Thêm vào Prompt Agent A: Luôn mô tả chi tiết điều kiện nến xác nhận (`candle_reaction`) trong từng kịch bản.
- [ ] Thêm vào Prompt Agent B: Kiểm tra kỹ xem kịch bản có bị "chặn đầu xe lửa" không; nếu giá tăng/giảm quá dốc mà chưa có nến hãm lực thì phải CHALLENGE để yêu cầu bổ sung điều kiện chờ nến xác nhận.
- [ ] Khóa Prompt chu kỳ sau: *"Bạn đang ở trạng thái EXECUTION SUPERVISOR theo Plan Chốt #XYZ. Không phân tích lại xu hướng D1/H1. Chỉ đối soát nến hiện tại với điều kiện nến trong Plan Chốt."*
