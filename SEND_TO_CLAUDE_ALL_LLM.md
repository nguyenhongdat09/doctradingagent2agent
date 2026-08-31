# GỬI CHO CLAUDE — NGUYÊN TẮC NỀN TẢNG (THAY THẾ MỌI QUYẾT ĐỊNH TRƯỚC VỀ TỰ ĐỘNG HÓA)

> Copy TOÀN BỘ nội dung từ dòng `---` đến hết, gửi cho Claude.
> Đây là NGUYÊN TẮC BẤT BIẾN của hệ thống — THAY THẾ quyết định "DCA deterministic"
> (DEC-01 cũ) và mọi quan niệm "rule cứng kiểu EA".

---

Tôi cần khẳng định một nguyên tắc NỀN TẢNG, bất biến cho toàn hệ thống:

## 🧠 NGUYÊN TẮC: MỌI quyết định trade phải qua BỘ NÃO LLM (Agent A + B)

**KHÔNG có rule cứng tự động nào giống các EA (Expert Advisor) truyền thống được phép
tự gửi lệnh.** Không có công thức "giá chạm X → tự mua/bán" mà không có sự phán đoán
của LLM.

Cụ thể, TẤT CẢ các action sau đây ĐỀU phải do Agent A phân tích + Agent B phản biện
rồi MỚI được thực thi:

| Action | Bắt buộc qua LLM (A+B)? |
|--------|--------------------------|
| ENTRY (mở lệnh đầu, chọn mua/bán) | ✅ CÓ |
| DCA (mọi lần lấp rổ) | ✅ CÓ |
| RECOVERY_DCA | ✅ CÓ |
| PAYOFF_REDUCE | ✅ CÓ |
| CLOSE_ALL | ✅ CÓ |
| PARTIAL_CLOSE | ✅ CÓ |
| WAIT (đứng chờ) | ✅ CÓ (agents chủ động quyết định) |

→ Mọi việc liên quan vào/ra/sửa vị thế đều cần bộ não LLM. Không có ngoại lệ.

## Vì sao phải vậy (mục đích của bạn)

- Bạn KHÔNG muốn hệ thống hoạt động như EA (máy móc, rule cứng, không suy nghĩ).
- Giá trị CỐT LÕI của hệ thống là **agents có bộ não biết phán đoán thị trường**:
  - Nhìn thấy cú ép mạnh → **chờ đợi, không DCA vội**
  - Đọc được bối cảnh, cấu trúc, vùng cản, tin tức
  - Quyết định theo tình huống, không theo công thức cứng nhắc
- DCA không phải "giá đi ngược là lấp" → mà là "lúc này lấp có khôn ngoan không?"

## Vai trò của phần "mắt" (deterministic engine) — CHỈ LÀ CÔNG CỤ, KHÔNG PHẢI NGƯỜI QUYẾT ĐỊNH

Có sự nhầm lẫn cần làm rõ: engine "mắt" (tính swing, strength score, spacing, các con số)
CHỈ là **công cụ cung cấp dữ liệu + thông số** cho LLM nhìn. Nó KHÔNG được tự quyết định
gửi lệnh, KHÔNG được là nguồn ra lệnh.

- ✅ "Mắt" tính toán: swing, BOS, strength score 0–1, spacing pips, TotalLot, BasketProfit
  → đưa vào **snapshot** cho Agent A/B xem.
- ✅ "Mắt" cũng có thể **gợi ý** (offer) nhưng QUYẾT ĐỊNH cuối luôn là LLM.
- ❌ "Mắt" KHÔNG được tự động enqueue DCA / entry / close.

Nói cách khác: **mắt (engine) = cảm biến + máy tính; não (LLM A/B) = người quyết định.**
Không có cơ chế nào mà engine tự sinh lệnh mà không qua LLM.

## Kiến trúc đúng theo nguyên tắc này

```
Market data → MẮT (engine tính: swing, score, spacing, state)
             → SNAPSHOT (công cụ, chỉ là dữ liệu)
             → NÃO LLM: Agent A phân tích + đề xuất
                          Agent B phản biện độc lập
             → A+B đồng thuận ? → ENQUEUE qua Executor → MT5
             → Executor chỉ thực thi lệnh đã được A+B chốt
```

- **Executor** = tay, chỉ bấm nút theo lệnh A+B, không tự quyết.
- **Engine mắt** = mắt + máy tính, chỉ cung cấp dữ liệu.
- **LLM A/B** = bộ não, là người duy nhất quyết định.

## Sửa lại doc theo nguyên tắc này

Cần rà + sửa toàn bộ để KHÔNG còn bất kỳ cơ chế "tự động không qua LLM" nào:

1. `doc_phuong_phap/06-state-machine.md` — bỏ mọi "DCA/action deterministic tự chạy";
   mọi transition ra lệnh phải ghi "cần A+B consensus".
2. `doc_phuong_phap/05-capital-dca.md` — spacing/ladder chỉ là THÔNG SỐ đầu vào cho LLM
   (điều kiện cần / gợi ý), KHÔNG là trigger tự động.
3. `doc_agents/07-dca-dual-review-loop.md` — mọi DCA qua dual-review.
4. `doc_agents/10-autonomy-constraints.md` — ghi rõ "KHÔNG có rule cứng tự động;
   mọi material action đều qua LLM".
5. `doc_agents/04-message-schemas.md`, `09-runtime-architecture.md` — làm rõ engine mắt
   = công cụ dữ liệu, executor = tay thực thi, LLM = não quyết định.
6. `12-operations-reliability.md`, `13-testing-strategy.md`, `14-llm-prompt-spec.md` —
   phản ánh đúng (không backtest "engine tự quyết"; chỉ test "LLM quyết định được hỗ trợ
   bởi engine").
7. Cập nhật `ERRATA` — DEC-01 deterministic bị bãi bỏ hoàn toàn.

## Lưu ý chi phí

Nguyên tắc này làm **TĂNG đáng kể số lần gọi LLM** (mỗi action mỗi H1 close đều cần
A + B). User CHẤP NHẬN chi phí này vì ưu tiên số 1 là chất lượng phán đoán của agents,
không phải tiết kiệm token. (Bảng LLMRuns vẫn để đo thật ở Phase 2, nhưng Không dùng
để cắt giảm quyết định của agents.)

## Câu hỏi chốt để bạn xác nhận hiểu đúng

1. Xác nhận nguyên tắc: MỌI action (kể cả DCA, WAIT) qua LLM A+B — không có rule cứng tự động?
2. Xác nhận: engine mắt chỉ là nguồn dữ liệu/gợi ý, không tự ra lệnh?
3. Xác nhận: Executor chỉ thực thi lệnh đã A+B chốt?
4. Cập nhật toàn bộ doc + ERRATA theo nguyên tắc này, báo lại danh sách file đã sửa?