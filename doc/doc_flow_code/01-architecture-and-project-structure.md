# 01 — Kiến Trúc Codebase & Cấu Trúc Dự Án Senior (ADR-001 Per-Instance)

Tài liệu này đặc tả cấu trúc mã nguồn theo chuẩn **Senior Software Architecture**: Phân rã file nhỏ theo nguyên lý Đơn Trách Nhiệm (**Single Responsibility Principle**), đóng gói theo Layer, Dependency Injection, Protocol Interfaces và **Mô hình vận hành độc lập theo từng Cặp tiền tệ (1 Symbol = 1 Process / ADR-001)**.

---

## 📁 1. Cấu Trúc Thư Mục Chi Tiết & Chức Năng Từng File

Mỗi file đảm nhiệm **duy nhất một trách nhiệm**, không có module gom chung (anti-god-module):

```
├── .gitignore                  # File cấu hình git ignore: secrets.env, data/*.db, logs/, venv/
├── config/
│   ├── default_config.yaml         # Cấu hình tham số mặc định toàn hệ thống
│   ├── symbols.yaml                # Cấu hình chuyên biệt từng cặp (magic_offset, lot, spread_limit)
│   └── secrets.env                 # File biến môi trường bí mật (MT5 credentials, LLM keys) — KHÔNG commit Git
├── data/
│   ├── dca_AUDCAD.db               # SQLite 9 bảng riêng biệt cho AUDCAD
│   ├── dca_AUDNZD.db               # SQLite 9 bảng riêng biệt cho AUDNZD
│   ├── dca_GBPUSD.db               # SQLite 9 bảng riêng biệt cho GBPUSD
│   ├── dca_NZDCAD.db               # SQLite 9 bảng riêng biệt cho NZDCAD
│   └── experience.db               # SQLite dùng chung (Lessons, MemoryCache, Profiles, Feedback)
├── logs/
│   ├── audit/                      # Thư mục lưu file audit log JSONL xoay vòng theo ngày
│   └── system.log                  # File log hệ thống
├── src/
│   ├── main.py                     # Entrypoint CLI: nhận tham số --symbol, boot 1 instance độc lập
│   ├── core/
│   │   ├── __init__.py             # Re-export public core APIs
│   │   ├── constants.py            # Khai báo tất cả Enums (PairState, ActionType, SignalVerdict, etc.)
│   │   ├── models.py               # Pydantic v2 schemas (MarketSnapshot, TradePlan, ReviewBallot, etc.)
│   │   ├── config.py               # Pydantic Settings: load & validate default_config + symbols.yaml
│   │   ├── interfaces.py           # Khai báo Protocol/ABC (DataProvider, Executor, LLMClient, etc.)
│   │   └── logging_setup.py        # Cấu hình loguru / standard logging phân luồng audit và runtime
│   ├── database/
│   │   ├── __init__.py             # Re-export database repositories
│   │   ├── connection.py           # Quản lý kết nối SQLite, áp dụng PRAGMA WAL & synchronous=FULL
│   │   ├── repositories/
│   │   │   ├── __init__.py
│   │   │   ├── market_order_repo.py # Thao tác bảng MarketOrderInfo & Archive (claim, archive, cancel)
│   │   │   ├── pair_state_repo.py   # Đọc/ghi trạng thái PairState của symbol
│   │   │   ├── audit_repo.py        # Ghi vết kiểm toán vào bảng AuditLog
│   │   │   ├── plans_repo.py        # Lưu trữ các bản ghi Plans của Agent A
│   │   │   ├── ballots_repo.py      # Lưu trữ các bản ghi Ballots của Agent B
│   │   │   ├── sessions_repo.py     # Quản lý phiên hội đồng Sessions & Messages
│   │   │   └── llm_runs_repo.py     # Ghi nhận chi phí token, latency vào bảng LLMRuns
│   │   └── experience_repo.py      # Thao tác trên experience.db (Lessons, MemoryCache, Profiles)
│   ├── engine/
│   │   ├── __init__.py             # Facade cung cấp các hàm tính toán cho Orchestrator
│   │   ├── data/
│   │   │   ├── __init__.py
│   │   │   └── mt5_adapter.py      # Wrapper thư viện MetaTrader5 (lấy nến đóng, account, orders)
│   │   ├── structure/
│   │   │   ├── __init__.py
│   │   │   ├── pivot_detector.py   # Tìm Pivot High/Low D1 bán kính r=3 không repaint
│   │   │   ├── structure_features.py # Trích xuất HH/HL, BOS up/down, Range Compress ATR
│   │   │   └── context_classifier.py # Phân loại UPTREND/DOWNTREND/SIDEWAY kèm cơ chế Hysteresis
│   │   ├── signal/
│   │   │   ├── __init__.py
│   │   │   ├── strength_score.py   # Tính 4 thành phần Score H1 (Mom, Str, Loc, Conf)
│   │   │   └── disqualifiers.py    # Kiểm tra bộ lọc DQ_STREAK, DQ_INTO_D1_WALL
│   │   ├── position/
│   │   │   ├── __init__.py
│   │   │   ├── spacing_calculator.py # Tính khoảng cách Spacing ATR và cờ spacing_met
│   │   │   ├── ladder_calculator.py  # Tính lot theo ladder step và PayoffLot
│   │   │   └── basket_metrics.py     # Tính TotalLot, BasketProfit, AdverseRef
│   │   ├── snapshot_builder.py     # Gộp toàn bộ dữ liệu thành Data Model MarketSnapshot
│   │   └── hard_validator.py       # Bộ 5 checks an toàn tuyệt đối trước khi enqueue
│   ├── experience/
│   │   ├── __init__.py             # Facade tương tác hệ thống bài học
│   │   ├── scoring.py              # Thuật toán tính Score bài học theo Severity và TimeDecay
│   │   ├── memory_pack_builder.py  # Xây dựng chuỗi Markdown MemoryPack 2 tầng <= 500 tokens
│   │   └── lesson_writer.py        # Single-writer ghi bài học, dedupe SHA256 và invalidate cache
│   ├── agents/
│   │   ├── __init__.py             # Facade tương tác hệ thống Multi-Agent
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # Protocol LLMProvider định nghĩa hàm gọi LLM
│   │   │   ├── openai_client.py    # Client tương tác API OpenAI
│   │   │   ├── deepseek_client.py  # Client tương tác API DeepSeek-V3
│   │   │   ├── anthropic_client.py # Client tương tác API Anthropic Claude
│   │   │   └── json_parser.py      # Bóc tách JSON có cấu trúc Pydantic kèm cơ chế auto-retry
│   │   ├── agent_a/
│   │   │   ├── __init__.py
│   │   │   ├── planner.py          # Logic phân tích và soạn thảo TradePlan của Agent A
│   │   │   └── prompts.py          # System Prompt và User Prompt Templates cho Agent A
│   │   ├── agent_b/
│   │   │   ├── __init__.py
│   │   │   ├── challenger.py       # Logic thẩm định độc lập và tạo ReviewBallot của Agent B
│   │   │   └── prompts.py          # System Prompt và Anti-sycophancy Prompt cho Agent B
│   │   ├── consensus.py            # Điều phối vòng tranh luận A-B (tối đa 2 vòng)
│   │   └── boss/
│   │       ├── __init__.py
│   │       ├── boss_channel.py     # Quản lý phiên giao tiếp Boss (Advisory only)
│   │       └── boss_wake_handlers.py # Xử lý sự kiện Boss ngắt ngang (BossWake)
│   ├── execution/
│   │   ├── __init__.py
│   │   └── executor_thread.py      # Thread thường trực: Atomic claim PENDING -> MT5 -> Archive
│   └── orchestrator/
│       ├── __init__.py             # Facade quản lý vòng đời instance
│       ├── scheduler.py            # Timer C0 (H1 close + 2s), C1/C2 (Flat mid), C3 (Open dynamic)
│       ├── freeze_monitor.py       # Giám sát LLM outage -> SYSTEM_FREEZE và Auto-Resume
│       ├── startup.py              # Quy trình khởi động và ReconcileSymbol
│       ├── reconcile.py            # Thuật toán Light Reconcile và Full Reconcile MT5 vs DB
│       ├── monitoring.py           # Heartbeat, MT5 health watcher, Queue backlog watcher
│       └── main_runner.py          # Quản lý vòng lặp chính của 1 symbol duy nhất
└── tests/
    ├── unit/                       # Unit test cho từng submodule nhỏ
    ├── integration/                # Integration test DB, Queue, State machine, Reconcile
    ├── scenarios/                  # Bộ 10 kịch bản test quyết định của LLM
    └── mocks/                      # Mock MT5 API, Mock LLM API
```

---

## 🏛️ 2. Mô Hình Vận Hành Độc Lập Per-Instance (ADR-001)

Hệ thống được thiết kế theo nguyên tắc: **1 Symbol = 1 Process độc lập = 1 Instance phần mềm riêng biệt**.

```
                           ┌───────────────────────────┐
                           │   EXPERIENCE DB (Shared)  │
                           │   experience.db (WAL)     │
                           └─────────────▲─────────────┘
                                         │ get_memory_pack / record_lesson
           ┌─────────────────────────────┼─────────────────────────────┐
           │                             │                             │
┌──────────▼──────────┐       ┌──────────▼──────────┐       ┌──────────▼──────────┐
│ INSTANCE 1: AUDCAD  │       │ INSTANCE 2: AUDNZD  │       │ INSTANCE 3: GBPUSD  │
│ Process PID: 1001   │       │ Process PID: 1002   │       │ Process PID: 1003   │
│ - Config: AUDCAD    │       │ - Config: AUDNZD    │       │ - Config: GBPUSD    │
│ - DB: dca_AUDCAD.db │       │ - DB: dca_AUDNZD.db │       │ - DB: dca_GBPUSD.db │
│ - Scheduler: AUDCAD │       │ - Scheduler: AUDNZD │       │ - Scheduler: GBPUSD │
│ - Agents A & B      │       │ - Agents A & B      │       │ - Agents A & B      │
│ - Executor Thread   │       │ - Executor Thread   │       │ - Executor Thread   │
└─────────────────────┘       └─────────────────────┘       └─────────────────────┘
```

### Lợi ích kiến trúc:
1. **Cô lập lỗi tuyệt đối (Fault Isolation):** Nếu 1 cặp tiền gặp lỗi ngoại lệ hoặc crash, các cặp tiền khác vẫn vận hành 100% bình thường.
2. **Không khóa DB chéo (Zero Lock Contention):** Mỗi process sở hữu 1 file database `dca_<symbol>.db` riêng biệt.
3. **Mở rộng dễ dàng (Extensibility):** Thêm cặp tiền mới chỉ cần bổ sung 1 block cấu hình trong `symbols.yaml` và khởi chạy thêm 1 process `python src/main.py --symbol <NEW_SYM>`.

---

## 🔌 3. Các Protocol Interfaces Cốt Lõi (`src/core/interfaces.py`)

Sử dụng `typing.Protocol` để áp dụng nguyên lý **Dependency Inversion** (Dễ dàng mock khi viết Unit Test):

```python
from typing import Protocol, List, Dict, Any, Type, Optional
from pydantic import BaseModel
from src.core.models import MarketSnapshot, TradePlan, ReviewBallot

class IDataProvider(Protocol):
    def get_closed_rates(self, symbol: str, timeframe: int, count: int) -> List[Dict[str, float]]: ...
    def get_account_state(self) -> Dict[str, Any]: ...
    def get_open_positions(self, symbol: str, magic: int) -> List[Dict[str, Any]]: ...

class IOrderExecutor(Protocol):
    def send_order(self, request: Dict[str, Any]) -> Dict[str, Any]: ...
    def close_position(self, ticket: int) -> Dict[str, Any]: ...

class ILLMProvider(Protocol):
    async def generate_structured(
        self, prompt: str, system_prompt: str, response_model: Type[BaseModel]
    ) -> BaseModel: ...

class ILessonWriter(Protocol):
    def record_lesson(self, lesson_data: Dict[str, Any]) -> int: ...
    def submit_feedback(self, lesson_id: int, outcome: str, pl_usd: float) -> None: ...
```

---

## ⚙️ 4. Cơ Chế Khởi Động Qua CLI (`src/main.py`)

Hỗ trợ 2 chế độ khởi chạy:
- `--symbol <SYM>`: Chạy 1 instance cho cặp chỉ định (dùng khi debug, test hoặc cô lập 1 cặp).
- `--all`: Đọc `symbols.yaml`, tự động spawn N tiến trình con (child process) cho từng cặp tiền, báo PID và đường dẫn log tương ứng.

```python
import argparse
import subprocess
import sys
import yaml
from pathlib import Path
from src.orchestrator.main_runner import SymbolInstanceRunner

def spawn_all_instances(config_path: str, symbols_config: str):
    with open(symbols_config, "r", encoding="utf-8") as f:
        symbols_data = yaml.safe_load(f)
    
    symbols = symbols_data.get("active_symbols", ["AUDCAD", "AUDNZD", "GBPUSD", "NZDCAD"])
    processes = []
    print(f"🚀 Spawning {len(symbols)} independent trading instances...")
    
    for sym in symbols:
        log_file = Path(f"logs/instance_{sym}.log")
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        cmd = [sys.executable, "src/main.py", "--symbol", sym, "--config", config_path]
        with open(log_file, "a", encoding="utf-8") as log_out:
            proc = subprocess.Popen(cmd, stdout=log_out, stderr=log_out)
            processes.append((sym, proc.pid, log_file))
            print(f"  [+] Symbol: {sym:<8} | PID: {proc.pid:<6} | Log: {log_file}")
            
    print("\n✅ All instances running. Press Ctrl+C to stop all.")
    try:
        for _, proc, _ in processes:
            proc.wait()
    except KeyboardInterrupt:
        print("\n🛑 Stopping all instances...")
        for _, proc, _ in processes:
            proc.terminate()

def main():
    parser = argparse.ArgumentParser(description="Trading Agent DCA Instance Runner (ADR-001)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--symbol", type=str, help="Tên cặp tiền chạy lẻ (vd: AUDCAD, AUDNZD)")
    group.add_argument("--all", action="store_true", help="Chạy toàn bộ 4 cặp bằng cách spawn N tiến trình con")
    parser.add_argument("--config", type=str, default="config/default_config.yaml", help="File cấu hình hệ thống")
    parser.add_argument("--symbols-config", type=str, default="config/symbols.yaml", help="File danh mục symbols")
    args = parser.parse_args()

    if args.all:
        spawn_all_instances(args.config, args.symbols_config)
    else:
        runner = SymbolInstanceRunner(symbol=args.symbol, config_path=args.config)
        runner.start()

if __name__ == "__main__":
    main()
```
