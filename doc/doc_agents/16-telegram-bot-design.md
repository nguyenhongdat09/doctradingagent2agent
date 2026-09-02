# 16 — Telegram Bot Design (Kênh giao tiếp Agent ↔ Boss)

> Thiết kế chi tiết Telegram Bot integration cho hệ thống Trading DCA. Bot phục vụ 2 mục đích:
> 1. **Uncertainty Escalation:** Agent A/B gửi câu hỏi khi mơ hồ → Boss reply → Agent tiếp tục
> 2. **System Alerts:** SYSTEM_FREEZE, ENTER_RECOVERY, EXIT_RECOVERY, v.v.

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│ Orchestrator (Python)                                   │
│                                                         │
│  ┌──────────────────┐    ┌────────────────────────┐     │
│  │ EscalationManager│───▶│ TelegramNotifier       │     │
│  │                  │    │  • send_escalation()    │     │
│  │ • create_ticket  │    │  • send_self_resolved() │     │
│  │ • wait_response  │    │  • send_late_notice()   │     │
│  │ • self_resolve   │    │  • send_result()        │     │
│  │ • handle_late    │    │  • send_alert()         │     │
│  └──────────────────┘    └───────────┬────────────┘     │
│                                      │                   │
│  ┌──────────────────┐                │ python-telegram-  │
│  │ TelegramListener │◀───────────────┘ bot (async)       │
│  │  • poll/webhook  │                                    │
│  │  • match reply   │                                    │
│  │    → ticket      │                                    │
│  │  • inject to     │                                    │
│  │    agent context  │                                    │
│  └──────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
            │                           ▲
            ▼                           │
    ┌───────────────┐           ┌───────────────┐
    │ Telegram API  │           │ Telegram API  │
    │ (sendMessage) │           │ (getUpdates)  │
    └───────┬───────┘           └───────┬───────┘
            ▼                           │
    ┌───────────────────────────────────────────┐
    │           Telegram Chat (Boss)            │
    │  Bot ──────────────────────▶ Boss         │
    │  Bot ◀────────────── Reply Boss           │
    └───────────────────────────────────────────┘
```

## 2. Setup Guide

### 2.1 Tạo Bot qua BotFather

```
1. Mở Telegram → tìm @BotFather
2. /newbot → đặt tên "DCA Trading Agent"
3. Nhận BOT_TOKEN (ví dụ: 123456:ABC-DEF...)
4. Lưu vào env: TELEGRAM_BOT_TOKEN
```

### 2.2 Lấy Chat ID

```
1. Gửi tin nhắn cho bot
2. Gọi: https://api.telegram.org/bot<TOKEN>/getUpdates
3. Tìm "chat":{"id": 123456789} trong response
4. Lưu vào env: TELEGRAM_CHAT_ID
```

### 2.3 Config

```python
# Config (từ 08-parameters.md §10)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
ESCALATION_TIMEOUT_SEC = 1800        # 30 phút
TELEGRAM_POLL_INTERVAL_SEC = 3       # Poll reply mỗi 3 giây
UNCERTAINTY_THRESHOLD = 0.6          # Score > 0.6 → cho phép escalate
```

## 3. Phương thức nhận reply

### 3.1 Long Polling (v1 — khuyến nghị ban đầu)

```python
async def poll_for_reply(ticket_id: str, timeout: int = 1800):
    """
    Poll Telegram getUpdates mỗi 3 giây khi có ticket WAITING.
    Dừng khi nhận reply hoặc hết timeout.
    """
    start = time.time()
    last_update_id = 0
    
    while time.time() - start < timeout:
        updates = await bot.get_updates(offset=last_update_id + 1)
        for update in updates:
            if is_reply_to_escalation(update, ticket_id):
                return update.message.text
            last_update_id = update.update_id
        
        await asyncio.sleep(TELEGRAM_POLL_INTERVAL_SEC)
    
    return None  # Timeout
```

**Ưu điểm:** Đơn giản, không cần server public, phù hợp v1.
**Nhược điểm:** Tốn bandwidth (mỗi 3 giây 1 request khi có ticket WAITING).

### 3.2 Webhook (v2 — production)

```python
# Telegram gọi endpoint khi có message mới
# Cần HTTPS server / ngrok / cloud function
@app.route("/telegram/webhook", methods=["POST"])
async def telegram_webhook(request):
    update = Update.de_json(request.json)
    await handle_boss_reply(update)
```

**Ưu điểm:** Real-time, tiết kiệm bandwidth.
**Nhược điểm:** Cần domain public hoặc tunnel.

## 4. Reply Matching Logic

### 4.1 Quy tắc match

```python
def match_reply_to_ticket(message) -> Optional[str]:
    """
    Match Boss reply với ticket WAITING.
    
    Quy tắc (thứ tự ưu tiên):
    1. Boss QUOTE (reply) tin nhắn escalation → match chính xác qua message_id
    2. Boss gửi text mới → match ticket WAITING cũ nhất (FIFO) của symbol
    3. Nếu nhiều symbol có ticket WAITING → Boss cần quote để chỉ rõ
    """
    # Ưu tiên 1: Quote match
    if message.reply_to_message:
        ticket = find_ticket_by_telegram_msg_id(message.reply_to_message.message_id)
        if ticket and ticket.status == 'WAITING':
            return ticket.ticket_id
    
    # Ưu tiên 2: FIFO — ticket WAITING cũ nhất
    oldest_waiting = get_oldest_waiting_ticket()
    if oldest_waiting:
        return oldest_waiting.ticket_id
    
    return None  # Không có ticket nào đang chờ
```

### 4.2 Xử lý edge cases

| Case | Xử lý |
|------|--------|
| Boss reply nhưng không có ticket WAITING | Bỏ qua (log warning) |
| Nhiều ticket WAITING cùng lúc | Quote match ưu tiên; nếu không quote → FIFO |
| Boss reply 2 lần cho 1 ticket | Lấy reply đầu tiên, bỏ qua reply sau |
| Boss gửi sticker/media thay text | Bỏ qua, nhắn Boss: "Vui lòng reply bằng text" |

## 5. Message Templates (Tiếng Việt)

### 5.1 Tin nhắn Escalation — Gửi Boss

```
🤔 {AGENT_NAME} CẦN Ý KIẾN BOSS — {SYMBOL}

📊 Tình huống hiện tại:
• Trạng thái: {STATE} ({BASKET_INFO})
• D1: {D1_CONTEXT} — {D1_DETAIL}
• H1: {H1_SIGNAL} score = {SCORE}
• MemoryPack: {MEMORY_INFO}
{EXTRA_CONTEXT}

🧠 Phân tích sơ bộ:
{ANALYSIS_SUMMARY}

❓ Câu hỏi:
{QUESTION}

⏰ Thời gian chờ: 30 phút (đến {TIMEOUT_TIME})
📝 Nếu Boss không reply, Agent sẽ tự quyết theo data.
```

**Ví dụ thực tế:**

```
🤔 AGENT A CẦN Ý KIẾN BOSS — AUDCAD

📊 Tình huống hiện tại:
• Trạng thái: NORMAL (3 lệnh BUY, TotalLot = 0.15)
• D1: Xu hướng TĂNG, nhưng đang tiến gần cản mạnh 0.9250
• H1: Lực ép xuống (PUSH_DOWN) score = 0.68 — đủ spacing
• MemoryPack: Có bài AVOID "Không DCA khi gần cản D1 mạnh + streak > 3"
• Khoảng cách cản: 12 pips

🧠 Phân tích sơ bộ:
Spacing đủ để DCA, trend D1 vẫn ủng hộ hướng BUY. Tuy nhiên có bài 
học AVOID liên quan và giá đang rất gần cản D1. Agent A đang phân vân 
giữa DCA (tận dụng dip) và WAIT (tôn trọng bài học).

❓ Câu hỏi:
Boss cho ý kiến: Nên DCA mua thêm 0.10 lot hay WAIT chờ giá phản 
ứng tại cản rồi quyết?

⏰ Thời gian chờ: 30 phút (đến 14:30 UTC+7)
📝 Nếu Boss không reply, Agent sẽ tự quyết theo data.
```

### 5.2 Tin nhắn Agent B escalate

```
🤔 AGENT B CẦN Ý KIẾN BOSS — AUDCAD

📋 Agent A đề xuất: {A_PROPOSED_ACTION} {DIRECTION} {LOT} lot
📝 Lý do A: {A_REASONING}

📊 Tình huống:
• {SITUATION_DETAILS}

🧠 Phân tích Agent B:
{B_ANALYSIS} — Agent B đang phân vân giữa APPROVE và CHALLENGE.

❓ Câu hỏi:
{QUESTION}

⏰ Thời gian chờ: 30 phút (đến {TIMEOUT_TIME})
📝 Nếu Boss không reply, Agent B sẽ tự ballot theo data.
```

### 5.3 Tin nhắn Self-Resolved (Agent đã tự quyết — timeout)

```
⚠️ THÔNG BÁO — {SYMBOL}

Do thời gian đợi quá lâu (đã quá 30 phút), tôi đã tự quyết 
theo giải pháp sau:

📋 Quyết định: {DECISION}
📝 Lý do: {REASONING}

💡 Ý kiến Boss vẫn được ghi nhận để tham khảo cho các quyết 
định tiếp theo.
```

### 5.4 Tin nhắn Late Notice (Boss reply trễ > 30 phút)

```
⚠️ THÔNG BÁO — {SYMBOL}

Do thời gian đợi quá lâu nên tôi đã tự quyết theo giải pháp sau:

📋 Quyết định: {DECISION}
📝 Lý do: {REASONING}

💡 Ý kiến Boss vẫn được ghi nhận vào hệ thống để tham khảo.
```

### 5.5 Tin nhắn kết quả (sau khi Agent quyết xong — optional)

```
✅ KẾT QUẢ — {SYMBOL}

Cảm ơn Boss đã cho ý kiến! Agent đã quyết định:

📋 Quyết định: {DECISION}
📝 Trạng thái: {CONSENSUS_STATUS}
🔗 Plan ID: {PLAN_ID}
```

### 5.6 Tin nhắn System Alert (dùng chung)

```
🚨 CẢNH BÁO HỆ THỐNG — {ALERT_TYPE}

{ALERT_MESSAGE}

📊 Trạng thái vị thế:
{POSITIONS_SNAPSHOT}

⏰ Thời gian: {TIMESTAMP}
```

## 6. Module Architecture (Code Spec)

### 6.1 `src/integrations/telegram/notifier.py` — TelegramNotifier

```python
class TelegramNotifier:
    """Gửi tin nhắn Telegram cho Boss."""
    
    def __init__(self, bot_token: str, chat_id: str):
        self.bot = Bot(token=bot_token)
        self.chat_id = chat_id
    
    async def send_escalation(self, ticket: EscalationTicket) -> int:
        """Gửi tin nhắn escalation. Return telegram_message_id."""
    
    async def send_self_resolved(self, ticket: EscalationTicket) -> None:
        """Thông báo Boss: Agent đã tự quyết do timeout."""
    
    async def send_late_notice(self, ticket: EscalationTicket) -> None:
        """Nhắn Boss: 'Do thời gian đợi quá lâu nên tôi đã tự quyết...'"""
    
    async def send_result(self, ticket: EscalationTicket, plan_id: str) -> None:
        """Thông báo kết quả cuối cùng (optional)."""
    
    async def send_alert(self, alert_type: str, message: str, snapshot: dict) -> None:
        """Gửi system alert (FREEZE, RECOVERY, v.v.)."""
    
    def _format_message_vi(self, template: str, **kwargs) -> str:
        """Format message tiếng Việt từ template."""
```

### 6.2 `src/integrations/telegram/listener.py` — TelegramListener

```python
class TelegramListener:
    """Lắng nghe reply từ Boss qua Telegram."""
    
    async def start_polling(self):
        """Bắt đầu long polling khi có ticket WAITING."""
    
    async def match_reply_to_ticket(self, message) -> Optional[str]:
        """Match reply → ticket_id (quote match > FIFO)."""
    
    async def handle_boss_reply(self, ticket_id: str, response_text: str):
        """Xử lý reply: update DB → inject vào agent context."""
    
    async def handle_late_reply(self, ticket_id: str, response_text: str):
        """Xử lý reply trễ: ghi nhận + thông báo Boss đã tự quyết."""
```

### 6.3 `src/agents/escalation.py` — EscalationManager

```python
class EscalationManager:
    """Quản lý toàn bộ lifecycle escalation ticket."""
    
    def __init__(self, db_repo, notifier: TelegramNotifier, listener: TelegramListener):
        self.db = db_repo
        self.notifier = notifier
        self.listener = listener
    
    async def create_and_send(
        self, agent: str, symbol: str, category: str,
        question: str, context_summary: str, analysis: dict
    ) -> EscalationTicket:
        """Tạo ticket + gửi Telegram. Return ticket."""
    
    async def wait_for_response(
        self, ticket_id: str, timeout: int = 1800
    ) -> Optional[str]:
        """Đợi Boss reply. Return response text hoặc None (timeout)."""
    
    async def self_resolve(
        self, ticket_id: str, resolution: str, reasoning: str
    ) -> None:
        """Agent tự quyết: update DB + thông báo Boss."""
    
    async def handle_late_response(
        self, ticket_id: str, boss_response: str
    ) -> None:
        """Boss reply trễ: ghi nhận + nhắn 'đã tự quyết theo ABC'."""
```

## 7. Error Handling

| Lỗi | Xử lý |
|-----|--------|
| Telegram API down | Retry 3 lần (exponential backoff). Nếu vẫn fail → log error + Agent tự quyết (như timeout) |
| Rate limit (429) | Đợi `retry_after` seconds rồi retry |
| Bot bị block bởi user | Log critical alert + Agent tự quyết |
| Network timeout gửi tin nhắn | Retry 2 lần. Fail → tự quyết |
| Message quá dài (>4096 chars) | Tách thành nhiều tin nhắn; link phần 1 → phần 2 |

## 8. Security

| Biện pháp | Chi tiết |
|-----------|----------|
| **Whitelist Chat ID** | Chỉ nhận reply từ `TELEGRAM_CHAT_ID` đã cấu hình |
| **Validate sender** | Kiểm tra `message.from.id` khớp với Boss ID |
| **Token bảo mật** | Token lưu trong env variable, không hardcode |
| **Không expose data nhạy** | Tin nhắn không chứa account password, API keys |

## 9. Liên kết

- Escalation Flow: [15-uncertainty-escalation.md](15-uncertainty-escalation.md)
- Message Schemas: [04-message-schemas.md](04-message-schemas.md) §10, §11, §12
- Parameters: [../doc_phuong_phap/08-parameters.md](../doc_phuong_phap/08-parameters.md) §10
- Phase 3 Code: [../doc_flow_code/04-phase-3-llm-agents-consensus.md](../doc_flow_code/04-phase-3-llm-agents-consensus.md) Module 3.6
