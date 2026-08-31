# GỬI CHO GEMINI — FIX NHANH 3 ĐIỂM TRONG diagram_review

> Copy TOÀN BỘ nội dung từ dòng `---` đến hết, gửi cho Gemini.

---

Bộ diagram_review rất tốt. Cần fix 3 điểm (quan trọng vì dev sẽ map vào code/doc) + 2 điểm rà soát đồng nhất:

## 🔴 FIX 1 — 08-recovery-loop.mmd
- Hiện ghi: "Đóng toàn phần / từng phần / **lệnh đang lỗ nặng nhất**".
- SAI spec (`doc_phuong_phap/07-recovery-loop.md`): ưu tiên cắt lệnh lỗ **NHỎ NHẤT về tiền** (`argmin |profit|`) trước.
- Sửa: "Đóng toàn phần / từng phần (Partial Close) **lệnh lỗ nhỏ nhất** (|loss| nhỏ nhất)".

## 🔴 FIX 2 — 01-helicopter-view.mmd (HardValidator 5 checks)
- Hiện ghi: "1. State machine check / 2. Spacing ATR check / 3. **Lot Size ≤ MaxLot** / 4. Direction consistency / 5. SYSTEM_FREEZE check".
- SAI: hệ thống **KHÔNG trần lot** (`MaxLot = 0`).
- Sửa đúng 5 checks theo spec:
  1. Matrix action hợp lệ (Context × PUSH ≥ 0.6)
  2. Spacing / Ladder đúng
  3. Cấm mở ngược hướng rổ (đặc biệt RECOVERY)
  4. NormalizeLot theo bước volume broker
  5. Kill-switch OFF
  (Bỏ "Lot Size ≤ MaxLot", bỏ "State machine check" khỏi list.)

## 🔴 FIX 3 — Đồng nhất tên bảng queue
- Hiện ghi `market_order_queue` → đổi thành **`MarketOrderInfo`** (đúng schema trong `doc_phuong_phap/10-sqlite-design.md`).

## 🟡 RÀ SOÁT TOÀN BỘ 13 FILE (đồng nhất tên kỹ thuật)
- Đảm bảo mọi diagram dùng đúng tên: `MarketOrderInfo`, `TotalLot`, `R_TH` (0.3), `spacing_met`, `SYSTEM_FREEZE`, `HardValidator`, `PairState`, `LLMRuns`, `MemoryPack`, `experience.db`, `dca_<symbol>.db`.
- 03/04: nếu chưa có, thêm "soft zone 0.4–0.6 = WAIT" và ngưỡng ≥ 0.6 = PUSH (Enter), < 0.4 = bỏ qua.
- 11-boss-channel: nhấn rõ Boss **advisory only, không override, không OrderSend**.
- 07-dca: nhấn DCA xét MỖI wake C3 (không chờ H1 close — DEC-09).

Sau khi fix, báo danh sách file đã sửa + xác nhận 5 mục trên.