# 02 - KIẾN TRÚC TIẾN TRÌNH ĐỘC LẬP THEO CẶP TIỀN (INSTANCE PER PAIR)

> **File sơ đồ Mermaid tương ứng**: [02-instance-per-pair.mmd](file:///d:/TradingAgents/PlanToCode/diagram_review/02-instance-per-pair.mmd)

---

## 1. Quyết Định Kiến Trúc: 1 Cặp Tiền = 1 OS Process (ADR-001)

Thay vì chạy một khối monolithic khổng lồ quản lý tất cả các cặp tiền tệ trong 1 process, hệ thống áp dụng nguyên lý **Cô Lập Vùng Lỗi (Failure Domain Isolation)**:

```bash
# Khởi động từng cặp tiền bằng lệnh CLI độc lập:
python main.py --symbol AUDCAD
python main.py --symbol AUDNZD
python main.py --symbol NZDCAD
```

### Tại sao lại chọn mô hình này?
1. **Cô lập lỗi tuyệt đối (Crash Isolation)**: Nếu cặp `AUDCAD` gặp lỗi ngoại lệ hoặc bị nghẽn mạng LLM, process của `AUDCAD` dừng lại mà **không làm ảnh hưởng** đến `AUDNZD` đang chạy bình thường.
2. **Không có Deadlock hàng đợi**: Mỗi cặp tiền có một file SQLite riêng biệt (`dca_audcad.db`). Không có hiện tượng tranh chấp ghi (Lock contention) giữa các cặp tiền.
3. **Dễ dàng bảo trì & Mở rộng (Scalability)**: Muốn thêm 1 cặp tiền mới, dev chỉ cần chạy thêm 1 lệnh CLI mới mà không cần sửa code điều phối trung tâm.

---

## 2. Điểm Giao Tiếp Duy Nhất: `experience.db` (Shared Memory)

Tất cả các Process độc lập dùng chung một tệp cơ sở dữ liệu `experience.db`:
- **Chế độ WAL (Write-Ahead Logging)**: Cho phép hàng chục tiến trình đọc đồng thời mà không bị block khi một tiến trình khác đang ghi bài học mới.
- **SQLite Timeout = 5.0 giây**: Đảm bảo các thao tác ghi kinh nghiệm tự động thử lại nếu DB đang bận, loại bỏ hoàn toàn lỗi `database is locked`.
- **Nội dung chia sẻ**: 
  - Bài học giao dịch (Ví dụ: `AUDCAD` vừa dính bẫy tin tức Fed, lưu bài học để `AUDNZD` cũng học được khi có biến động liên quan đến đồng AUD).
  - Thống kê hiệu suất và chi phí Token LLM toàn cục.
