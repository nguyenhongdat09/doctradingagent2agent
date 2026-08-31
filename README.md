# 📊 Hệ Thống Giao Dịch A2A - Bộ Đặc Tả Nghiệp Vụ & Biểu Đồ (BA)

Tài liệu đặc tả nghiệp vụ và kiến trúc luồng dành cho **Business Analyst (BA)** và đội ngũ phát triển (Dev / QA) trong dự án **Giao dịch Tự động hóa Agent-to-Agent (A2A)**.

---

## 🖥️ Công Cụ Trực Quan Hóa Tương Tác ([`index.html`](file:///d:/TradingAgents/PlanToCode/index.html))

Dự án đã tích hợp sẵn công cụ **A2A Diagram Studio** (file [`index.html`](file:///d:/TradingAgents/PlanToCode/index.html)):
- ✅ **Xem sẵn 4 loại biểu đồ nghiệp vụ 100% Tiếng Việt** (Tuần tự, Kiến trúc, Vòng đời lệnh, Cây quyết định rủi ro).
- ✅ **Trực tiếp chỉnh sửa (Live Edit)** mã Mermaid và tự động cập nhật biểu đồ.
- ✅ **Phóng to / Thu nhỏ / Kéo thả (Zoom & Pan)** mượt mà trên canvas.
- ✅ **Xuất ảnh chất lượng cao (Export PNG / SVG)** hoặc sao chép mã Mermaid để chèn vào tài liệu BRD / SRS, Jira hoặc Confluence.

> 💡 **Cách sử dụng:** Nhấp đúp chuột vào file [`index.html`](file:///d:/TradingAgents/PlanToCode/index.html) để mở trực tiếp trên trình duyệt web (Chrome, Edge, Firefox, Cốc Cốc).

---

## 1. Biểu Đồ Tuần Tự: Luồng Giao Tiếp Nghiệp Vụ A2A (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor NguonGia as Nguồn Dữ Liệu Thị Trường
    participant MDA as Market Data Agent (Dữ liệu)
    participant SA as Strategy Agent (Chiến lược)
    participant RA as Risk Agent (Kiểm soát rủi ro)
    participant EA as Execution Agent (Thực thi lệnh)
    participant San as Sàn Giao Dịch / Broker API

    %% 1. Luồng dữ liệu thị trường
    NguonGia->>MDA: Nhận giá & nến thời gian thực (BTC/USDT @ $65,000, KL: 1.5)
    activate MDA
    MDA->>SA: Phát sự kiện dữ liệu (MarketDataEvent)
    deactivate MDA

    %% 2. Phân tích chiến lược & Tạo tín hiệu
    activate SA
    SA->>SA: Tính toán chỉ báo kỹ thuật (SMA Ngắn cắt lên SMA Dài)
    SA->>RA: Gửi đề xuất giao dịch (SignalEvent: MUA 0.5 BTC)
    deactivate SA

    %% 3. Thẩm định & Kiểm soát rủi ro
    activate RA
    RA->>RA: Kiểm tra hạn mức rủi ro (Vị thế tối đa & Hạn mức vốn USD)
    
    alt Thỏa mãn điều kiện rủi ro (Chấp thuận)
        RA->>EA: Phát lệnh đã phê duyệt (OrderEvent: MUA 0.5 BTC)
        deactivate RA

        %% 4. Thực thi lệnh
        activate EA
        EA->>San: Gửi yêu cầu đặt lệnh (POST /api/v1/order)
        activate San
        San-->>EA: Xác nhận nhận lệnh (Mã lệnh: #76cefc, Chờ khớp)
        San-->>EA: Báo cáo khớp lệnh (ĐÃ KHỚP @ $65,013.20, Phí: $33.01)
        deactivate San

        %% 5. Cập nhật trạng thái & Xác nhận hoàn tất
        EA->>RA: Cập nhật sổ cái vị thế (FillEvent)
        EA->>SA: Thông báo lệnh đã khớp thành công (FillEvent)
        deactivate EA

    else Vi phạm hạn mức rủi ro (Từ chối)
        activate RA
        RA-->>SA: Từ chối đề xuất (Lý do: "Vượt quá khối lượng vị thế tối đa")
        deactivate RA
    end
```

---

## 2. Kiến Trúc Thành Phần & Trục Hàng Đợi (Architecture Diagram)

```mermaid
flowchart LR
    subgraph LopDuLieu ["1. Tầng Thu Thập Dữ Liệu"]
        NguonGia["Nguồn Cung Cấp Giá Ngoài"] --> MDA["Market Data Agent (MDA)\n- Nhận WebSocket / REST\n- Chuẩn hóa dữ liệu nến & tick"]
    end

    subgraph TrucSuKien ["Trục Giao Tiếp Sự Kiện Trung Tâm"]
        Bus[("Trục Bus Sự Kiện Bất Đồng Bộ\n(Hàng đợi Pub/Sub Async)")]
    end

    subgraph LopPhanTich ["2. Tầng Chiến Lược & Quản Trị Rủi Ro"]
        SA["Strategy Agent (SA)\n- Phân tích kỹ thuật (SMA/RSI)\n- Tín hiệu mô hình AI / LLM"]
        RA["Risk Agent (RA)\n- Kiểm tra vị thế tối đa\n- Hạn mức phân bổ vốn\n- Chốt chặn Drawdown ngày"]
    end

    subgraph LopThucThi ["3. Tầng Đặt Lệnh & Sàn Giao Dịch"]
        EA["Execution Agent (EA)\n- Định tuyến lệnh thông minh\n- Kiểm soát trượt giá"]
        San["Sàn Giao Dịch / Broker API\n- Khớp lệnh (Matching Engine)\n- Quản lý tài khoản & Số dư"]
    end

    %% Kết nối luồng dữ liệu
    MDA -->|MarketDataEvent: Dữ liệu thị trường| Bus
    Bus -->|MarketDataEvent| SA
    SA -->|SignalEvent: Đề xuất tín hiệu| Bus
    Bus -->|SignalEvent| RA
    RA -->|OrderEvent: Lệnh đã duyệt| Bus
    Bus -->|OrderEvent| EA
    EA -->|Gửi lệnh REST / WebSocket| San
    San -->|Báo cáo khớp lệnh| EA
    EA -->|FillEvent: Khớp thành công| Bus
    Bus -->|FillEvent: Cập nhật trạng thái| RA
    Bus -->|FillEvent: Cập nhật vị thế| SA
```

---

## 3. Vòng Đời Trạng Thái Lệnh (Order State Machine)

```mermaid
stateDiagram-v2
    [*] --> DE_XUAT : Strategy Agent phát tín hiệu (SignalEvent)
    
    state ThamDinhRuiRo {
        DE_XUAT --> DANG_KIEM_TRA : Risk Agent tiếp nhận kiểm tra
        DANG_KIEM_TRA --> BI_TU_CHOI : Vi phạm hạn mức rủi ro
        DANG_KIEM_TRA --> DA_PHE_DUYET : Đạt tiêu chuẩn an toàn vốn
    }

    BI_TU_CHOI --> [*] : Gửi thông báo từ chối về Strategy Agent
    
    state ChuTrinhThucThi {
        DA_PHE_DUYET --> DANG_DINH_TUYEN : Execution Agent tiếp nhận lệnh duyệt
        DANG_DINH_TUYEN --> CHO_KHOP_LENH : Đã gửi lệnh lên Sàn giao dịch
        CHO_KHOP_LENH --> DA_KHOP_TOAN_BO : Sàn xác nhận khớp thành công
        CHO_KHOP_LENH --> DA_HUY_LENH : Hết hạn / Sàn từ chối
    }

    DA_KHOP_TOAN_BO --> CAP_NHAT_VI_THE : Cập nhật sổ cái cho Risk và Strategy
    CAP_NHAT_VI_THE --> [*]
    DA_HUY_LENH --> [*]
```

---

## 4. Cây Quyết Định Kiểm Soát Rủi Ro (Risk Decision Tree)

```mermaid
flowchart TD
    BatDau([Nhận Đề Xuất Giao Dịch SignalEvent]) --> KiemTra1{Khối lượng 1 lệnh <= Mức tối đa cho phép?}
    
    KiemTra1 -- Không --> TuChoi1[❌ Từ chối: 'Khối lượng 1 lệnh quá lớn']
    KiemTra1 -- Có --> KiemTra2{Tổng vị thế sau lệnh <= Hạn mức tối đa?}
    
    KiemTra2 -- Không --> TuChoi2[❌ Từ chối: 'Vượt quá quy mô vị thế tối đa']
    KiemTra2 -- Có --> KiemTra3{Giá trị USD danh mục <= Hạn mức phân bổ vốn?}
    
    KiemTra3 -- Không --> TuChoi3[❌ Từ chối: 'Vượt trần hạn mức vốn USD']
    KiemTra3 -- Có --> KiemTra4{Mức sụt giảm trong ngày <= Ngưỡng Max Drawdown?}
    
    KiemTra4 -- Không --> TuChoi4[❌ Từ chối: 'Đã chạm ngưỡng Drawdown ngày']
    KiemTra4 -- Có --> PheDuyet[✅ DUYỆT LỆNH: Tạo OrderEvent chuyển sang Execution Agent]

    TuChoi1 --> BaoCaoLoi[Phát sự kiện RiskRejectEvent -> Strategy Agent]
    TuChoi2 --> BaoCaoLoi
    TuChoi3 --> BaoCaoLoi
    TuChoi4 --> BaoCaoLoi
```

---

## 5. Bảng Ma Trận Nghiệp Vụ Các Thành Phần (BA Matrix)

| STT | Thành phần (Agent) | Vai trò nghiệp vụ | Dữ liệu đầu vào (Input) | Dữ liệu đầu ra (Output) |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Market Data Agent (MDA)** | Thu thập, làm sạch và phát tán dữ liệu giá/nến thời gian thực. | WebSocket / REST tick từ sàn | `MarketDataEvent` (Giá, Khối lượng, Đỉnh, Đáy) |
| **2** | **Strategy Agent (SA)** | Phân tích kỹ thuật (SMA, RSI) hoặc mô hình AI để tạo tín hiệu mua/bán. | `MarketDataEvent`, `FillEvent` | `SignalEvent` (Hành động: MUA/BÁN, Khối lượng) |
| **3** | **Risk Agent (RA)** | Cổng gác an toàn vốn: Thẩm định khối lượng lệnh, tổng vị thế và drawdown. | `SignalEvent`, `FillEvent` | `OrderEvent` (nếu duyệt) hoặc `RiskRejectEvent` (nếu từ chối) |
| **4** | **Execution Agent (EA)** | Định tuyến lệnh thông minh, gửi lệnh sàn và theo dõi khớp lệnh. | `OrderEvent`, Phản hồi từ sàn | Lệnh gửi sàn & `FillEvent` (Báo cáo khớp lệnh) |
| **5** | **Sàn Giao Dịch / Broker API** | Sàn thực hiện khớp lệnh và quản lý số dư/tài sản. | Yêu cầu đặt lệnh | Kết quả khớp lệnh, Phí giao dịch |
