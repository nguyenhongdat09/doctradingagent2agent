# ĐẶC TẢ KIẾN TRÚC: CƠ CHẾ PHÂN TÍCH CONTEXT D1 & LUỒNG DỮ LIỆU GIỮA PYTHON VÀ LLM AGENTS

> **Tài liệu bàn giao Developer**: Làm rõ cơ chế phân tách giữa **Python Engine (Đôi mắt toán học)** và **LLM Agents (Bộ não suy nghĩ)**, giải thích cách truyền nến OHLC tối ưu chi phí token và cơ chế mở rộng dữ liệu linh hoạt (Dynamic Data Fetch).
>
> ⚠️ **Ghi chú v2.x:** Tài liệu này mô tả chu kỳ **full-snapshot** (C0/khi không có plan). Khi đã có `Active Plan` (v2.x), các micro cycle dùng `DeltaMarketSnapshot` nhẹ hơn và output của Agent là `UnifiedContingencyPlan` (4 nhánh), không chỉ `TradePlan` — xem `doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md`. Cơ chế Engine-nhãn/LLM-đọc-OHLC/tool-call bên dưới vẫn nguyên giá trị.

---

## 1. Triết lý thiết kế: Đôi mắt (Engine) vs Bộ não (LLM)

Hệ thống kết hợp giữa **thuật toán toán học chuẩn xác** và **khả năng suy luận ngữ cảnh của AI**, không phó mặc hoàn toàn cho một bên:
* **Tầng Python Engine (Đôi mắt / Math Layer)**: 
  * Chạy cục bộ trên máy tính (local machine), lấy dữ liệu trực tiếp từ MT5 qua IPC (< 1ms).
  * Chịu trách nhiệm tính toán các chỉ số toán học thuần túy: Đỉnh/đáy Swing D1 (bán kính $r=3$ không repaint), Break of Structure (BOS), ATR14, Điểm lực nén và Lực ép nến H1.
  * Xuất ra nhãn bối cảnh cơ sở (baseline): `rule_context` $\in$ {`UPTREND`, `DOWNTREND`, `SIDEWAY`}.
* **Tầng LLM Agents (Bộ não / Brain Layer - Agent A & Agent B)**:
  * Nhận bức tranh tổng thể gồm cả **dữ liệu nến thô OHLC** và **kết quả tính toán của Engine**.
  * Đọc hiểu hành vi giá (Price Action), nhận diện các rủi ro mà code cứng bị trễ hoặc không thấy được (râu nến quét thanh khoản, pinbar đảo chiều, lực ép kiệt sức).
  * Ra quyết định kế hoạch giao dịch (`TradePlan`) và thẩm định phản biện độc lập (`ReviewBallot`).

---

## 2. Luồng nạp dữ liệu mặc định (Scheduled Wakeup - Chu kỳ 1 giờ)

Hệ thống hoạt động theo cơ chế **Push tự động** để tiết kiệm tối đa chi phí Token và thời gian gọi API:

```
                  ┌────────────────────────────────────────┐
                  │          Nến H1 đóng cửa               │
                  │        (Scheduler Wakeup C0)           │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼
                  ┌────────────────────────────────────────┐
                  │         Python MT5 Adapter             │
                  │   Lấy 60 nến D1 + 30 nến H1 đã đóng    │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼
                  ┌────────────────────────────────────────┐
                  │        StructureEngine (Toán)          │
                  │  detect_pivots(bars=60) -> 6 Swings    │
                  │  extract_features -> rule_context      │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼
                  ┌────────────────────────────────────────┐
                  │            SnapshotBuilder             │
                  │  Cắt 30 D1 + 30 H1 + features cấu trúc │
                  │  -> Gói MarketSnapshot JSON duy nhất   │
                  └──────────────────┬─────────────────────┘
                                     │ (Single Prompt Call)
                                     ▼
                  ┌────────────────────────────────────────┐
                  │           LLM Agent A & B              │
                  │ Đọc 1 lần: Đầy đủ OHLC + Gợi ý Engine  │
                  └────────────────────────────────────────┘
```

### Các bước cụ thể:
1. **Kích hoạt chu kỳ**:
   * Khi nến H1 đóng cửa (cộng buffer 1–2 giây để broker chốt giá), Scheduler đánh thức instance.
2. **Python Engine chuẩn bị dữ liệu (0 token, xử lý < 1ms)**:
   * `mt5_adapter.get_closed_rates(symbol, "D1", count=60)`: Lấy 60 nến D1 (buffer đủ để xác nhận 6 đỉnh đáy bán kính $r=3$ không repaint).
   * Gọi hàm toán học nội bộ: `swings = detect_pivots(bars=d1_bars, radius=3, max_swings=6)`.
   * Trích xuất đặc trưng: BOS, range_compress, phân loại `rule_context`.
3. **Đóng gói `MarketSnapshot` và nạp vào Prompt**:
   * Python tự động cắt gọn lại **30 nến D1 gần nhất + 30 nến H1 gần nhất** cùng các đặc trưng đã tính toán thành một payload JSON duy nhất:
   ```json
   {
     "symbol": "AUDCAD",
     "d1_ohlc_closed": [
       {"t": "2026-03-04", "o": 0.8900, "h": 0.8950, "l": 0.8880, "c": 0.8940},
       {"t": "2026-03-05", "o": 0.8940, "h": 0.8980, "l": 0.8850, "c": 0.8860}
     ],
     "structure": {
       "rule_context": "UPTREND",
       "swings": [
         {"type": "PH", "price": 0.8980, "time": "2026-03-01"},
         {"type": "PL", "price": 0.8820, "time": "2026-02-25"}
       ],
       "last_bos": {"dir": "up", "price": 0.8950},
       "range_compress": 1.2
     },
     "basket": { "state": "FLAT", "total_lot": 0, "profit": 0 }
   }
   ```
4. **Agent phân tích trong 1 lượt gọi duy nhất (Single Inference Call)**:
   * Agent **không cần gọi API để lấy dữ liệu nến**, dữ liệu đã nằm sẵn trong câu hỏi (Prompt).
   * Agent đối chiếu giữa: **Gợi ý của code cứng** (`rule_context = UPTREND`) và **Hình thái 30 nến OHLC thực tế** (xem có nến pinbar quét đỉnh, bấc dài hay lực tăng suy yếu không).

---

## 3. Cơ chế mở rộng động khi thị trường nhiễu (Dynamic Data Fetch)

Trong trường hợp 30 nến ban đầu chưa đủ để Agent tự tin đưa ra phán quyết, Agent được cấp các **Tools (Function Calling)** để chủ động yêu cầu Python nạp thêm dữ liệu:

1. **Tool `fetch_more(symbol, tf, add_count, reason)`**:
   * Khi Agent thấy cấu trúc D1 chưa rõ ràng hoặc điểm nến H1 nằm ở vùng ranh giới lưỡng lự (Soft Zone $0.4 \le \text{Score} < 0.6$), Agent tự gọi:
     ```python
     fetch_more(symbol="AUDCAD", tf="D1", add_count=30, reason="d1_structure_unclear")
     ```
   * Python sẽ query thêm nến và cập nhật lại mảng phân tích cho Agent.
   * **Quy định trần nến tối đa (Tránh tràn context)**:
     * Khung **D1**: Mặc định 30 nến $\rightarrow$ Mở rộng tối đa **120 nến**.
     * Khung **H1**: Mặc định 30 nến $\rightarrow$ Mở rộng tối đa **200 nến**.
2. **Tool `get_structure_features(symbol)`**:
   * Agent gọi tool này chỉ với tham số `symbol="AUDCAD"` (cực nhẹ token, chỉ tốn vài bytes). Python bên dưới sẽ tự lấy nến và chạy lại `detect_pivots` để trả về danh sách cản S/R mới nhất.

---

## 4. Cách Agent phát hiện và xử lý khi Code cứng bị trễ / sai

Thuật toán toán học đỉnh đáy (`detect_pivots`) có một nhược điểm cố hữu: **ĐỘ TRỄ**.
* Để chống repaint, hàm bắt buộc phải chờ **đủ 3 nến sau đóng cửa** mới dám xác nhận 1 đỉnh hoặc đáy.
* Nếu thị trường xảy ra một cây nến tin tức sập gãy cấu trúc, code cứng vẫn sẽ báo là `UPTREND` trong 3 ngày tiếp theo vì chưa đủ nến confirm đỉnh mới!

### Quyền hạn và vũ khí của Agent để "bắt bài" code cứng:
1. **Đọc chuỗi nến OHLC thực tế**:
   * Dù không có mắt nhìn ảnh pixel, LLM cực kỳ giỏi suy luận trên dãy số chuỗi thời gian (Time-series Reasoning). Khi thấy giá đóng cửa 2 nến gần nhất cắm sâu qua đáy cũ với thân nến đặc, Agent sẽ nhận diện được đà tăng đã gãy trước khi code cứng nhận ra.
2. **Quyền VETO & Ép trạng thái WAIT**:
   * Agent có quyền hạ điểm tự tin `confidence < 0.55` và bật `veto = true`:
     ```json
     {
       "context_d1": "SIDEWAY",
       "confidence": 0.45,
       "narrative": "Code cứng báo UPTREND nhưng nến D1 hôm qua quét râu thanh khoản cực dài rồi đảo chiều giảm mạnh -> Cấu trúc tăng không còn an toàn",
       "action": "WAIT",
       "veto": true
     }
     ```
   * Khi Agent kích hoạt VETO, hệ thống lập tức hủy bỏ kế hoạch vào lệnh và chuyển sang trạng thái chờ an toàn.
3. **Agent B (Independent Challenger)**:
   * Nếu Agent A mù quáng tin theo code cứng mà đòi mở lệnh MUA, Agent B đọc OHLC độc lập sẽ phát lệnh `CHALLENGE` hoặc `VETO` để chặn đứng lệnh lại.
4. **Escalate to Boss qua Telegram**:
   * Khi dữ liệu có sự mâu thuẫn lớn (Code cứng báo UPTREND rõ ràng nhưng nến OHLC lại cho tín hiệu rủi ro cao), Agent sẽ gọi tool:
     `escalate_to_boss(category="CONFLICT", question=...)`
   * Bot Telegram gửi thông báo về điện thoại của Boss (Người thật có Vision biểu đồ) để đưa ra phán quyết tối thượng.

---

## 5. Hướng dẫn lập trình chi tiết cho Developer

### A. Tầng Toán học (`src/engine/structure/pivot_detector.py`)
* Viết dưới dạng **Pure Math Function** (hàm thuần túy):
  ```python
  def detect_pivots(bars: list[Bar], radius: int = 3, max_swings: int = 6) -> list[Swing]:
      # CHỈ làm toán trên mảng bars trong bộ nhớ RAM
      # TUYỆT ĐỐI KHÔNG gọi API MT5 hay query database bên trong hàm này
      ...
  ```
* *Lợi ích:* Viết Unit Test chạy trong 0.001s với mock data mà không cần kết nối MT5.

### B. Tầng Trích xuất dữ liệu (`src/engine/data/mt5_adapter.py`)
* Chịu trách nhiệm duy nhất là gọi API MT5 lấy nến đóng (`shift >= 1`, loại bỏ nến đang hình thành `shift = 0`):
  ```python
  def get_closed_rates(symbol: str, timeframe: str, count: int) -> list[Bar]:
      ...
  ```

### C. Tầng Đóng gói Snapshot (`src/engine/snapshot_builder.py`)
* Là cầu nối điều phối:
  1. Gọi `mt5_adapter` lấy 60 nến D1 và 30 nến H1.
  2. Truyền 60 nến D1 vào `detect_pivots(bars)` để lấy danh sách Swings.
  3. Cắt 30 nến D1 mới nhất + 30 nến H1 + kết quả Swings/BOS đóng vào Pydantic model `MarketSnapshot`.
  4. Nạp thẳng `MarketSnapshot` vào Prompt khởi tạo cho Agent A & B.

### D. Tầng Tool Call cho LLM (`src/agents/tools.py`)
* Các tool mở cho LLM gọi **phải nhận tham số gọn nhẹ** (ví dụ `symbol: str`, `tf: str`, `add_count: int`), **không bao giờ bắt LLM truyền mảng nến thô** để tiết kiệm chi phí token tối đa.
