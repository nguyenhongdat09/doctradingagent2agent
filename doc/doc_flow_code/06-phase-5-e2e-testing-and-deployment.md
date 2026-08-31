# 06 — Phase 5: Kiểm Thử Toàn Diện & Triển Khai Thực Tế (E2E Testing, Demo Paper Trading & Deployment)

> **Mục tiêu Phase 5:** Thực hiện kiểm thử toàn trình (End-to-End Replay), chạy thử nghiệm tài khoản Demo (Paper Trading) tối thiểu 2 tuần trên môi trường broker thực tế, và triển khai Production theo mô hình đa tiến trình độc lập (**1 Symbol = 1 Process / ADR-001**) trên Windows VPS.

---

## 🧪 1. Kiểm Thử Toàn Trình (Historical Replay & Scenario Testing)

### 1.1 Bộ Công Cụ Giả Lập Lịch Sử (Historical Replay Harness)
- **Cơ chế hoạt động:**
  - Nạp dữ liệu nến D1 và H1 lịch sử (từ 1 đến 3 tháng gần nhất của 4 cặp).
  - Tua lại từng nến H1 theo trình tự thời gian cho từng instance độc lập:
    1. Engine tính toán Swing D1, Strength Score H1, Spacing.
    2. Nạp dữ liệu vào `MarketSnapshot` + `MemoryPack`.
    3. Gọi Agent A và Agent B (sử dụng API LLM thực tế hoặc cache phản hồi).
    4. Nếu đạt đồng thuận $\rightarrow$ Giả lập khớp lệnh tại giá `Close[1]` của nến vừa đóng.
    5. Cập nhật `PairState`, `TotalLot`, tính toán lãi/lỗ nổi (`BasketProfit`).
- **Tiêu chuẩn vượt qua (Pass Criteria):**
  - **0 lỗi vi phạm phương pháp cứng:** 100% các lệnh phải tuân thủ đúng Decision Matrix, Spacing, và quy tắc cấm mở ngược trong RECOVERY.
  - **Toàn vẹn vòng đời:** Tất cả các chu kỳ RECOVERY phát sinh đều phải hoàn thành giải cứu và trở về `FLAT` thành công.
  - **Chống Repaint:** Không có bất kỳ truy xuất nào tới nến đang hình thành (`shift = 0`).

---

## 📈 2. Giai Đoạn Chạy Thử Nghiệm Thực Tế (Forward Testing / Demo 2 Tuần)

Trước khi cấp vốn tài khoản thật, hệ thống **BẮT BUỘC** phải vận hành trên tài khoản **MT5 Demo** tối thiểu 14 ngày giao dịch liên tục.

### 2.1 Quy Trình Vận Hành Thử Nghiệm Hàng Ngày

| Thời điểm | Việc cần làm của Developer / Operator |
|---|---|
| **Đầu ngày (08:00 AM)** | - Kiểm tra trạng thái Heartbeat của 4 tiến trình instance.<br>- Đối soát `PairState` của 4 cặp với vị thế thực tế trên MT5.<br>- Kiểm tra số dư tài khoản và dung lượng ổ cứng log/DB. |
| **Trong ngày** | - Theo dõi các cảnh báo qua kênh Boss Channel / Telegram.<br>- Thử nghiệm kích hoạt `BossWake` ngắt ngang 1-2 lần để kiểm tra phản hồi của hội đồng A/B.<br>- Kiểm tra độ trễ cuộc gọi LLM API và chi phí token trong bảng `LLMRuns`. |
| **Cuối tuần** | - Trích xuất file `audit_<symbol>.jsonl` để phân tích tỷ lệ đồng thuận giữa A và B.<br>- Rà soát các bài học kinh nghiệm mới được ghi nhận trong `experience.db`.<br>- Tổng kết PnL, Maximum Drawdown và số lần chuyển sang `RECOVERY`. |

### 2.2 Tiêu Chí Nghiệm Thu Demo Để Được Lên Live (Sign-off Criteria)

- [ ] **Tính ổn định:** Hệ thống hoạt động liên tục 14 ngày không bị crash hoặc treo luồng (zero unhandled exceptions).
- [ ] **Xử lý sự cố:** Đã trải qua ít nhất 1 lần ngắt kết nối mạng hoặc LLM Timeout và hệ thống đã kích hoạt đúng `SYSTEM_FREEZE` $\rightarrow$ `Auto-Resume` kèm `Light Reconcile` an toàn.
- [ ] **Vòng đời RECOVERY:** Đã trải qua ít nhất 1 chu kỳ RECOVERY thực tế và hoàn thành giải cứu lệnh về FLAT đúng theo phương pháp Payoff/Reduce.
- [ ] **Chi phí LLM:** Chi phí token thực tế nằm trong ngưỡng dự toán ($\le \$0.20 \text{ USD/ngày}$ cho toàn bộ 4 cặp).

---

## 🖥️ 3. Hướng Dẫn Triển Khai Production Đa Tiến Trình (Windows VPS / ADR-001)

### 3.1 Yêu Cầu Hạ Tầng
- **Hệ điều hành:** Windows Server 2022 / Windows 10/11 Pro (64-bit).
- **Cấu hình tối thiểu:** 2 vCPU, 4GB RAM, 40GB SSD.
- **Phần mềm cài đặt:**
  - MetaTrader 5 Terminal (Cài đặt từ broker chính thức, bật tính năng *"Allow automated trading"* và *"Allow WebRequest"*).
  - Python 3.11+ (Cài đặt thêm vào System PATH).
  - Git for Windows.

### 3.2 Khởi Chạy Đa Tiến Trình (Per-Symbol Process Management)
Mỗi cặp tiền tệ chạy trong một tiến trình Python riêng biệt:

1. **Khởi chạy thủ công qua PowerShell / Terminal:**
   ```powershell
   # Mở 4 terminal riêng biệt hoặc dùng background jobs:
   Start-Process python -ArgumentList "src/main.py --symbol AUDCAD"
   Start-Process python -ArgumentList "src/main.py --symbol AUDNZD"
   Start-Process python -ArgumentList "src/main.py --symbol GBPUSD"
   Start-Process python -ArgumentList "src/main.py --symbol NZDCAD"
   ```

2. **Quản lý tự động qua NSSM (Non-Sucking Service Manager) trên Windows Server:**
   Đăng ký 4 Windows Services riêng biệt:
   ```cmd
   nssm install TradingAgent_AUDCAD "C:\TradingAgents\App\venv\Scripts\python.exe" "src/main.py --symbol AUDCAD"
   nssm set TradingAgent_AUDCAD AppDirectory "C:\TradingAgents\App"
   nssm set TradingAgent_AUDCAD AppRestartDelay 5000
   nssm start TradingAgent_AUDCAD

   nssm install TradingAgent_AUDNZD "C:\TradingAgents\App\venv\Scripts\python.exe" "src/main.py --symbol AUDNZD"
   nssm install TradingAgent_GBPUSD "C:\TradingAgents\App\venv\Scripts\python.exe" "src/main.py --symbol GBPUSD"
   nssm install TradingAgent_NZDCAD "C:\TradingAgents\App\venv\Scripts\python.exe" "src/main.py --symbol NZDCAD"
   ```

3. **Mở rộng thêm cặp tiền mới (Zero Core Modification):**
   - Bổ sung cấu hình cặp mới vào `config/symbols.yaml`.
   - Chạy lệnh: `python src/main.py --symbol <NEW_SYMBOL>` $\rightarrow$ Không cần sửa bất kỳ dòng code core nào.

### 3.3 Chiến Lược Sao Lưu Dữ Liệu (Backup Policy)
- **Tự động sao lưu hàng ngày lúc 00:05 UTC:**
  - Tạo bản snapshot của 4 file `data/dca_<symbol>.db` và file `data/experience.db` sang thư mục sao lưu `data/backups/YYYYMMDD/`.
  - Sử dụng lệnh SQLite Online Backup:
    ```bash
    sqlite3 data/experience.db ".backup 'data/backups/experience_backup.db'"
    sqlite3 data/dca_AUDCAD.db ".backup 'data/backups/dca_AUDCAD_backup.db'"
    ```
