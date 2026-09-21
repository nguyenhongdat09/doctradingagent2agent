// ============================================================================
// flows-data.js — Dữ liệu các luồng nghiệp vụ cho Flow Studio (kiến trúc v2.3)
// ============================================================================
// Cách chỉnh sửa:
//   - Sửa trực tiếp object FLOW_DATA bên dưới, hoặc
//   - Dùng "Chế độ Sửa" trong flow-studio.html → "Xuất flows-data.js" → ghi đè file này.
//
// Node fields:
//   id     : định danh duy nhất trong flow
//   x, y   : tọa độ canvas (px)
//   type   : engine | agent | orchestrator | db | executor | external | decision | boss | worker | state
//   title  : tên node
//   sub    : file/module code tương ứng (vd: src/orchestrator/scheduler.py)
//   desc   : mô tả chi tiết — hiển thị khi hover/click
//   docs   : mảng path tài liệu liên quan (relative)
//   decs   : mảng quyết định/tham chiếu (vd: 'DEC-10', 'ADR-001')
//
// Edge fields: { from, to, label, dashed (tùy chọn = luồng async/optional) }
// ============================================================================

window.FLOW_DATA = {
  version: 'v2.3.5',
  flows: [

    // ======================= FLOW 1: CHU KỲ WAKE & QUYẾT ĐỊNH =======================
    {
      id: 'wake_cycle',
      icon: '🔄',
      title: '1. Chu kỳ Wake & Quyết định (Main Loop)',
      desc: 'Đây là nhịp tim của hệ thống — cứ mỗi lần thức dậy nó chạy vòng này: Bộ hẹn giờ đánh thức → Engine đọc dữ liệu thị trường và nén thành bản tóm tắt → Cổng kiểm tra kế hoạch (Plan Gate) đối chiếu giá hiện tại với các kịch bản đã cam kết → tùy kết quả đi 1 trong 3 đường: tự động cắt/thoát theo cam kết cũ (INVALIDATION), 2 AI xác nhận nhanh 1 vòng (fast-consensus), hoặc 2 AI phân tích đầy đủ lập kế hoạch mới (full consensus) → Người kiểm an toàn (HardValidator) → lệnh vào hàng đợi → Executor gửi lệnh lên sàn MT5. Nguồn: doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md + doc_agents/05.',
      nodes: [
        { id: 'mt5_feed', type: 'external', x: 30, y: 60, title: 'MT5 Terminal', sub: 'nguồn nến giá + lệnh + tài khoản',
          desc: 'Sàn giao dịch MetaTrader 5 — nơi cung cấp dữ liệu nến giá (khung ngày và 1 giờ), các vị thế đang giữ và thông tin tài khoản. Hệ thống chỉ đọc nến ĐÃ ĐÓNG hoàn toàn, không dùng nến đang chạy — tránh bị tín hiệu ảo lừa vì nến chưa đóng còn đổi hình.',
          docs: ['doc/doc_phuong_phap/09-data-sources.md'], decs: [] },
        { id: 'scheduler', type: 'orchestrator', x: 30, y: 330, title: 'Bộ hẹn giờ (Scheduler)', sub: 'src/orchestrator/scheduler.py',
          desc: 'Bộ hẹn giờ đánh thức hệ thống, có 3 kiểu hẹn. C0: hẹn bắt buộc sau khi nến 1 giờ đóng 1-2 giây — dùng khi cần lập kế hoạch mới. C1/C2: hẹn phụ khi đang trống lệnh. C3: hẹn linh hoạt mỗi 3-60 phút khi đang giữ lệnh, để xét có nên mua/bán thêm giữa chừng nến không. Mỗi nến chỉ được xử lý đúng 1 lần nhờ mã nhận diện nến.',
          docs: ['doc/doc_agents/05-scheduler-wakeup.md'], decs: ['DEC-09', 'DEC-12'] },
        { id: 'engine', type: 'engine', x: 370, y: 330, title: 'Engine — Con mắt đo lường', sub: 'src/engine/snapshot_builder.py',
          desc: 'Con mắt của hệ thống — chỉ đo lường, KHÔNG được quyết định. Nó tính các chỉ báo kỹ thuật (điểm xoay trên khung ngày, cấu trúc sóng, bối cảnh thị trường đang trend hay sideways, độ mạnh tín hiệu khung 1 giờ, khoảng cách lưới DCA...) rồi nén tất cả thành một bản tóm tắt gọn gửi cho AI. Khi đã có kế hoạch thì chỉ gửi bản nén nhỏ (Delta) kèm ít nhất 3 nến gần nhất để tiết kiệm token.',
          docs: ['doc/doc_phuong_phap/02-d1-context.md', 'doc/doc_phuong_phap/03-h1-signal.md', 'giai_thich_ptkt_d1.md'], decs: ['DEC-15'] },
        { id: 'plan_gate', type: 'orchestrator', x: 710, y: 330, title: 'Cổng kiểm tra kế hoạch', sub: 'src/orchestrator/plan_gate.py',
          desc: 'Người gác cổng chạy bằng luật cứng, đứng TRƯỚC AI để tiết kiệm tiền gọi AI. Mỗi lần thức dậy, nó mở kế hoạch đang hiệu lực ra, đối chiếu giá hiện tại với các kịch bản đã ghi sẵn (ngưỡng giá + điều kiện hình dạng nến). Khớp kịch bản nào → báo lên để xử lý, không cần hỏi AI. Mỗi sự kiện chỉ được xử lý đúng 1 lần nhờ mã sự kiện riêng. Nếu kế hoạch hết hạn hoặc bối cảnh khung ngày đã đổi → bắt buộc lập kế hoạch mới.',
          docs: ['doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md', 'doc/doc_flow_code/05-phase-4-orchestrator-operations.md'], decs: ['DEC-10', 'DEC-11', 'DEC-16'] },
        { id: 'route', type: 'decision', x: 1050, y: 330, title: 'Ngã rẽ theo kịch bản', sub: 'quy tắc phân quyền DEC-10',
          desc: 'Ngã rẽ quyết định ai được làm việc tiếp: (1) Giá chạm vùng phải cắt/thoát theo cam kết cũ (INVALIDATION) → thực thi ngay, không hỏi AI, kể cả khi hệ thống đang đóng băng. (2) Giá khớp kịch bản lên hoặc xuống (UPSIDE/DOWNSIDE) → 2 AI chỉ xác nhận nhanh 1 vòng rồi thực thi. (3) Không khớp gì hoặc kịch bản CHỜ → đi ngủ, không tốn tiền AI. Giá chạy quá xa mọi kịch bản → đánh dấu cần lập kế hoạch mới.',
          docs: ['doc/ERRATA.md', 'doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md'], decs: ['DEC-10', 'DEC-14'] },
        { id: 'inv_exec', type: 'executor', x: 1390, y: 60, title: 'Tự cắt/thoát theo cam kết', sub: 'INVALIDATION → đóng toàn bộ lệnh',
          desc: 'Đường tắt đặc biệt DUY NHẤT được bỏ qua AI: khi giá chạm vùng INVALIDATION — tức vùng mà kế hoạch đã cam kết phải cắt/thoát — hệ thống tự đưa lệnh đóng toàn bộ vị thế vào hàng đợi. Lý do được phép: đây là thực hiện lời hứa đã ký từ trước, không phải quyết định mới. Vì vậy nó chạy được cả khi hệ thống đang đóng băng.',
          docs: ['doc/ERRATA.md'], decs: ['DEC-10'] },
        { id: 'fast_consensus', type: 'agent', x: 1390, y: 240, title: 'Xác nhận nhanh A→B', sub: 'chỉ 1 vòng xác nhận',
          desc: 'Kiểm tra nhanh 1 vòng duy nhất khi giá khớp kịch bản lên/xuống: 2 AI chỉ trả lời câu hỏi «giá này có đúng điều kế hoạch đã cam kết không?» rồi thực thi luôn. Bị CẤM phân tích lại biểu đồ — vì việc phân tích đã làm xong hồi lập kế hoạch, giờ chỉ cần xác nhận khớp.',
          docs: ['doc/doc_agents/03-consensus-protocol.md'], decs: ['DEC-10'] },
        { id: 'agent_a', type: 'agent', x: 1390, y: 420, title: 'Agent A — Lập kế hoạch', sub: 'src/agents/agent_a/planner.py',
          desc: 'AI số 1 — người viết kế hoạch. Nhận 3 thứ: bản tóm tắt thị trường từ Engine, gói kinh nghiệm từng đúc kết, và nhật ký các kế hoạch trước. Từ đó viết kế hoạch gồm 4 kịch bản (giá lên làm gì / xuống làm gì / chạm đâu phải cắt / mặc định chờ), mỗi kịch bản kèm điều kiện nến mà máy kiểm tra được. Đồng thời đề xuất bài học mới. Khi đang ở chế độ giám sát thì chỉ được nhìn nến mới, cấm phân tích lại.',
          docs: ['doc/doc_agents/02-agent-roles.md', 'doc/doc_agents/14-llm-prompt-spec.md'], decs: ['DEC-18'] },
        { id: 'agent_b', type: 'agent', x: 1730, y: 420, title: 'Agent B — Phản biện', sub: 'src/agents/agent_b/challenger.py',
          desc: 'AI số 2 — người phản biện, làm việc độc lập với A. Nhiệm vụ là bắt lỗi A: kế hoạch có trùng kiểu từng thua không (đối chiếu sổ kinh nghiệm), có lỗ hổng logic không. Quy tắc quan trọng: muốn phản đối thì PHẢI đưa kèm kế hoạch thay thế có con số cụ thể — cấm nói «không đồng ý» suông. Kể cả khi đồng ý cũng phải nêu bằng chứng ngược đã cân nhắc.',
          docs: ['doc/doc_agents/02-agent-roles.md', 'doc/doc_agents/03-consensus-protocol.md'], decs: [] },
        { id: 'reconcile', type: 'decision', x: 1730, y: 590, title: 'Hòa giải có giới hạn vòng', sub: 'src/agents/consensus.py — tối đa InpMaxDebateRounds vòng',
          desc: 'Bàn hòa giải: B phản đối kèm kế hoạch thay thế → A đọc và viết lại kế hoạch phiên bản mới → B chấm lại. Số vòng tối đa lấy từ tham số InpMaxDebateRounds (mặc định 2, đổi được). Nếu hết số vòng vẫn bất đồng → hoãn quyết định, dùng kế hoạch dự phòng tối thiểu (mặc định CHỜ) nhưng QUAN TRỌNG là vẫn kế thừa điều khoản cắt lỗ của kế hoạch cũ — để rổ lệnh không bao giờ mất lớp bảo vệ.',
          docs: ['doc/doc_agents/03-consensus-protocol.md'], decs: ['DEC-13'] },
        { id: 'commit', type: 'db', x: 1390, y: 590, title: 'Kế hoạch ĐÃ CHỐT', sub: 'ghi vào bảng contingency_plans',
          desc: 'Khi cả 2 AI đồng ý 100% → kế hoạch được ghi vào database với trạng thái ĐÃ CHỐT (COMMITTED) và bắt đầu có hiệu lực, kèm ngày hết hạn. Mỗi chiến dịch chỉ được có đúng 1 kế hoạch hiệu lực tại một thời điểm — kế hoạch cũ tự động chuyển sang trạng thái ĐÃ BỊ THAY THẾ trong cùng một giao dịch database.',
          docs: ['doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md', 'doc/doc_phuong_phap/10-sqlite-design.md'], decs: ['DEC-16', 'DEC-17'] },
        { id: 'hardval', type: 'engine', x: 2070, y: 480, title: 'Người kiểm an toàn (HardValidator)', sub: 'src/engine/hard_validator.py',
          desc: 'Người kiểm an toàn cuối cùng trước khi lệnh vào hàng đợi — chạy bằng luật cứng, không phải AI. Kiểm tra 5 thứ: hành động có hợp lệ với trạng thái hiện tại không, khoảng cách lưới DCA đúng chưa, có đang định mở lệnh ngược trong lúc cứu hàng không (bị cấm tuyệt đối), khối lượng đã chuẩn theo bước lot của sàn chưa, nút dừng khẩn cấp có đang tắt không. Nếu bật chế độ ép buộc kinh nghiệm, nó còn được quyền từ chối kế hoạch vi phạm bài học TRÁNH mức nghiêm trọng cao.',
          docs: ['doc/doc_phuong_phap/04-decision-matrix.md'], decs: [] },
        { id: 'queue', type: 'db', x: 2410, y: 480, title: 'Hàng đợi lệnh', sub: 'bảng MarketOrderInfo — chờ xử lý',
          desc: 'Hàng đợi lệnh nằm trong database — mọi lệnh muốn lên sàn phải xếp hàng ở đây trước, không ai được gửi trực tiếp. Executor lấy lệnh bằng cách khóa nguyên tử (đánh dấu đang xử lý trong một thao tác duy nhất) nên không bao giờ gửi trùng. Lệnh treo tồn đọng từ phiên trước sẽ bị hủy lúc khởi động lại.',
          docs: ['doc/doc_phuong_phap/10-sqlite-design.md'], decs: [] },
        { id: 'executor', type: 'executor', x: 2410, y: 660, title: 'Executor — Luồng gửi lệnh', sub: 'src/execution/executor_thread.py',
          desc: 'Đôi tay DUY NHẤT của cả hệ thống được phép chạm vào MT5 — chạy ở luồng riêng biệt: liên tục rút lệnh từ hàng đợi → gửi lệnh mở/đóng lên sàn → lưu kết quả giao dịch vào sổ lưu trữ + cập nhật trạng thái cặp tiền. Thiết kế này đảm bảo không ai khác vô tình gửi lệnh trực tiếp.',
          docs: ['doc/doc_flow_code/02-phase-1-foundation-engine-db.md'], decs: [] },
        { id: 'mt5_exec', type: 'external', x: 2410, y: 840, title: 'Sàn khớp lệnh (MT5)', sub: 'nhận mã lệnh + giá khớp',
          desc: 'Nơi lệnh thực sự được khớp trên sàn — trả về mã lệnh và giá khớp. Nếu sàn báo giá đã đổi (requote) thì thử lại nhẹ nhàng; nếu khớp thất bại hẳn thì đánh dấu lệnh LỖI và phát cảnh báo cho người vận hành.',
          docs: ['doc/doc_phuong_phap/09-data-sources.md'], decs: [] },
        { id: 'summarizer', type: 'worker', x: 1730, y: 60, title: 'Người viết tóm tắt (PlanSummarizer)', sub: 'src/orchestrator/plan_summarizer.py',
          desc: 'Người viết nhật ký — được đánh thức đúng 1 lần mỗi khi một kế hoạch kết thúc: dùng model AI siêu nhẹ và rẻ viết tóm tắt 2-3 dòng «kế hoạch vừa rồi đã làm gì» để nối vào nhật ký chiến dịch, giúp vòng lập kế hoạch sau biết mình đã đi qua bước nào. Nếu model lỗi thì ghép các ghi chú thô — không ảnh hưởng luồng chính. Đây là worker độc lập, không phải trợ lý của A hay B.',
          docs: ['NANG_CAP_PLAN_LIFECYCLE_VA_TIMELINE_MEMORY.md'], decs: [] }
      ],
      edges: [
        { from: 'mt5_feed', to: 'engine', label: 'nến đã đóng' },
        { from: 'scheduler', to: 'engine', label: 'đánh thức' },
        { from: 'engine', to: 'plan_gate', label: 'bản tóm tắt thị trường' },
        { from: 'plan_gate', to: 'route', label: 'khớp kịch bản' },
        { from: 'route', to: 'inv_exec', label: 'giá chạm vùng cắt' },
        { from: 'route', to: 'fast_consensus', label: 'khớp kịch bản lên/xuống' },
        { from: 'route', to: 'agent_a', label: 'chưa có kế hoạch / cần lập lại' },
        { from: 'inv_exec', to: 'queue', label: 'đóng hết lệnh (không qua AI)' },
        { from: 'agent_a', to: 'agent_b', label: 'kế hoạch nháp' },
        { from: 'agent_b', to: 'reconcile', label: 'phiếu chấm ± kế hoạch khác' },
        { from: 'reconcile', to: 'agent_a', label: 'viết lại (≤InpMaxDebateRounds vòng)', dashed: true },
        { from: 'reconcile', to: 'commit', label: 'cả 2 đồng ý → CHỐT' },
        { from: 'fast_consensus', to: 'hardval', label: 'xác nhận đúng cam kết' },
        { from: 'commit', to: 'hardval', label: 'hành động cần làm ngay' },
        { from: 'hardval', to: 'queue', label: 'đạt kiểm tra → vào hàng đợi' },
        { from: 'queue', to: 'executor', label: 'rút lệnh' },
        { from: 'executor', to: 'mt5_exec', label: 'gửi lệnh lên sàn' },
        { from: 'commit', to: 'summarizer', label: 'đánh thức khi xong', dashed: true }
      ]
    },

    // ======================= FLOW 2: VÒNG ĐỜI PLAN =======================
    {
      id: 'plan_lifecycle',
      icon: '📜',
      title: '2. Vòng đời Plan & Macro Cycle',
      desc: 'Mô hình «Bìa Carton»: một chiến dịch (Macro Cycle) là hành trình từ lúc lệnh đầu tiên được khớp đến khi đóng sạch toàn bộ lệnh. Bên trong chiến dịch, mỗi kế hoạch đi qua vòng đời: NHÁP (PROVISIONAL — bản thảo chờ duyệt) → ĐÃ CHỐT (COMMITTED — có hiệu lực, được giám sát nhiều phiên) → kết thúc 1 trong 3 cách: xong việc (DONE), bị kế hoạch mới thay thế (SUPERSEDED), hoặc bị hủy tay (CANCELLED). Nguồn: NANG_CAP_PLAN_LIFECYCLE + spec §5.',
      nodes: [
        { id: 'draft', type: 'agent', x: 30, y: 300, title: 'Kế hoạch NHÁP (PROVISIONAL)', sub: 'bản thảo chờ B chấm',
          desc: 'Kế hoạch nháp do A soạn — chỉ là bản thảo trên bàn, đang chờ B chấm điểm. CHƯA ghi vào database, chưa có hiệu lực gì: giá có chạm kịch bản của nó cũng không ai nghe.',
          docs: ['NANG_CAP_PLAN_TAM_CHOT_PRICE_ACTION_PRUNING.md'], decs: [] },
        { id: 'ballot_loop', type: 'decision', x: 370, y: 300, title: 'Bỏ phiếu + Hòa giải', sub: 'A↔B, tối đa InpMaxDebateRounds vòng',
          desc: 'Vòng bỏ phiếu và hòa giải: B chấm kế hoạch nháp của A. Đồng ý → kế hoạch được chốt. Không đồng ý → B phải đưa kèm kế hoạch thay thế có số liệu, A viết lại. Số vòng tối đa theo tham số InpMaxDebateRounds (mặc định 2, đổi được); vẫn bất đồng → hoãn và dùng kế hoạch dự phòng (mặc định CHỜ nhưng giữ điều khoản cắt lỗ cũ).',
          docs: ['doc/doc_agents/03-consensus-protocol.md'], decs: ['DEC-13'] },
        { id: 'committed', type: 'db', x: 710, y: 300, title: 'Kế hoạch ĐÃ CHỐT (COMMITTED)', sub: 'duy nhất có hiệu lực',
          desc: 'Kế hoạch ĐÃ CHỐT — được ghi vào database và là cái duy nhất có hiệu lực lúc đó (kế hoạch cũ tự động thành ĐÃ BỊ THAY THẾ). Có ngày hết hạn — quá hạn phải lập lại. Bên trong là 4 kịch bản viết sẵn: giá lên thì làm gì (UPSIDE), giá xuống làm gì (DOWNSIDE), chạm vùng nào phải cắt/thoát (INVALIDATION), và mặc định là chờ (STANDBY) — mỗi kịch bản kèm điều kiện nến máy tự kiểm tra được.',
          docs: ['doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md'], decs: ['DEC-11', 'DEC-16'] },
        { id: 'supervise', type: 'orchestrator', x: 1050, y: 300, title: 'Giám sát nhiều phiên', sub: 'plan_gate kiểm tra mỗi nhịp',
          desc: 'Giai đoạn giám sát — kế hoạch sống qua nhiều nhịp thức dậy. Mỗi nhịp, cổng kiểm tra đối chiếu nến mới với các kịch bản đã ghi; 2 AI bị khóa không được phân tích lại biểu đồ, chỉ canh đúng cam kết. Kế hoạch hết hạn hoặc bối cảnh khung ngày đổi → bắt buộc lập mới. Giá phá vỡ mọi nhánh → đánh dấu cần lập lại.',
          docs: ['doc/doc_agents/05-scheduler-wakeup.md'], decs: ['DEC-14', 'DEC-16'] },
        { id: 'done', type: 'state', x: 1390, y: 160, title: 'XONG VIỆC (DONE)', sub: 'kịch bản chính đã thực thi',
          desc: 'Kết thúc kiểu «xong việc»: kịch bản chính của kế hoạch đã được thực thi trọn vẹn — vào lệnh đã khớp, hoặc DCA đã khớp, hoặc đã chốt bớt/cắt lỗ xong. Kế hoạch hết hiệu lực → đánh thức người viết nhật ký tóm tắt.',
          docs: ['NANG_CAP_PLAN_LIFECYCLE_VA_TIMELINE_MEMORY.md'], decs: [] },
        { id: 'superseded', type: 'state', x: 1390, y: 320, title: 'BỊ THAY THẾ (SUPERSEDED)', sub: 'kế hoạch mới được chốt',
          desc: 'Kết thúc kiểu «bị thay ghế»: một kế hoạch mới vừa được chốt (do lập lại sau khi giá phá nhánh / hòa giải thất bại / hết hạn) → kế hoạch cũ chuyển sang trạng thái này. Vẫn giữ trong database làm lịch sử đối chiếu.',
          docs: ['doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md'], decs: ['DEC-13'] },
        { id: 'cancelled', type: 'state', x: 1050, y: 500, title: 'BỊ HỦY (CANCELLED)', sub: 'hủy tay / Boss chỉ đạo',
          desc: 'Kết thúc kiểu «bị hủy tay»: Boss hoặc người vận hành chủ động hủy kế hoạch — các kịch bản không được thực thi nữa. Vẫn lưu lại đầy đủ để sau này kiểm toán xem ai hủy, vì sao.',
          docs: ['doc/doc_agents/11-boss-interrupt-flow.md'], decs: [] },
        { id: 'summary', type: 'worker', x: 1730, y: 120, title: 'Người viết tóm tắt (PlanSummarizer)', sub: 'worker chạy 1 lần mỗi kế hoạch',
          desc: 'Mỗi khi một kế hoạch DONE, worker này viết tóm tắt 2-3 dòng «vừa rồi đã làm gì, kết quả ra sao» rồi nối vào cuốn nhật ký của chiến dịch — để vòng lập kế hoạch kế tiếp đọc lại cho khỏi lặp việc cũ. Nếu model AI tóm tắt bị lỗi thì ghép các ghi chú thô.',
          docs: ['NANG_CAP_PLAN_LIFECYCLE_VA_TIMELINE_MEMORY.md'], decs: [] },
        { id: 'macro', type: 'db', x: 1730, y: 360, title: 'Bìa chiến dịch (macro_cycles)', sub: 'từ lệnh đầu → đóng sạch',
          desc: 'Chiếc «bìa carton» bọc trọn chiến dịch — bản ghi mở ra khi lệnh đầu tiên khớp thật (không mở khi hệ thống chỉ ngồi nhìn mà không vào lệnh), đóng lại khi toàn bộ lệnh đã clear. Lúc đóng sẽ chấm điểm chiến dịch và rút bài học kinh nghiệm.',
          docs: ['doc/UPGRADE_CONTINGENCY_PLAN_SPEC.md'], decs: ['DEC-16'] },
        { id: 'next_plan', type: 'agent', x: 2070, y: 240, title: 'Kế hoạch vòng sau', sub: 'kèm nhật ký tóm tắt chiến dịch',
          desc: 'Vòng lập kế hoạch kế tiếp trong cùng chiến dịch: 2 AI được nạp cuốn nhật ký tóm tắt nên biết rõ «đã đi qua những bước nào rồi» — và bị cấm lặp lại hành động đã làm (vd đã DCA 2 lần thì không đề xuất lại y chang).',
          docs: ['NANG_CAP_PLAN_LIFECYCLE_VA_TIMELINE_MEMORY.md'], decs: [] }
      ],
      edges: [
        { from: 'draft', to: 'ballot_loop', label: 'A gửi B chấm' },
        { from: 'ballot_loop', to: 'draft', label: 'phản đối + kế hoạch khác', dashed: true },
        { from: 'ballot_loop', to: 'committed', label: 'cả 2 đồng ý' },
        { from: 'committed', to: 'supervise', label: 'canh kịch bản nhiều phiên' },
        { from: 'supervise', to: 'done', label: 'kịch bản thực thi xong' },
        { from: 'supervise', to: 'superseded', label: 'bị kế hoạch mới thay', dashed: true },
        { from: 'committed', to: 'cancelled', label: 'bị hủy tay', dashed: true },
        { from: 'done', to: 'summary', label: 'đánh thức viết tóm tắt' },
        { from: 'summary', to: 'next_plan', label: 'nhật ký 2-3 dòng' },
        { from: 'done', to: 'macro', label: 'đóng sạch lệnh → gấp bìa', dashed: true },
        { from: 'macro', to: 'next_plan', label: 'cùng chiến dịch' }
      ]
    },

    // ======================= FLOW 3: EXPERIENCE MEMORY =======================
    {
      id: 'experience',
      icon: '🧠',
      title: '3. Bộ nhớ Kinh nghiệm (experience.db)',
      desc: 'Cách hệ thống «học» và «nhớ»: sau mỗi sự kiện lớn (đóng sạch lệnh, thoát khủng hoảng, lệnh lỗi...) rút ra bài học ngắn gọn lưu vào database kinh nghiệm dùng chung cho cả 4 cặp. Trước mỗi quyết định, một gói kinh nghiệm liên quan (nhỏ gọn, ≤500 token) được chích vào prompt của cả 2 AI để chúng không lặp lại sai lầm cũ. Nguồn: doc_experience/01-02 + DEC-18.',
      nodes: [
        { id: 'triggers', type: 'orchestrator', x: 30, y: 170, title: 'Thời điểm được học', sub: 'học theo đợt, không theo nến',
          desc: 'Các thời điểm hệ thống được phép «học»: đóng sạch lệnh thành công, thoát khỏi trạng thái cứu hàng, lệnh gửi sàn bị lỗi, hết thời gian phạt chờ, hoặc đóng chiến dịch. Cố ý KHÔNG học theo từng nến — học theo đợt để tránh nhồi nhét dữ liệu nhiễu.',
          docs: ['doc/doc_experience/01-experience-db-spec.md'], decs: [] },
        { id: 'proposed', type: 'agent', x: 30, y: 390, title: 'Bài học đề xuất', sub: 'nằm trong output của A và B',
          desc: 'Bài học ứng viên do 2 AI đề xuất — nằm ngay trong output kế hoạch hoặc phiếu chấm của chúng (gồm: loại bài học, bối cảnh áp dụng, hành động liên quan, điều kiện kích hoạt, nội dung, mức nghiêm trọng). AI chỉ được «đề xuất», tuyệt đối không được tự ghi vào database — tránh AI tự ý viết sửa trí nhớ chung.',
          docs: ['doc/doc_agents/04-message-schemas.md'], decs: ['DEC-18'] },
        { id: 'writer', type: 'worker', x: 370, y: 280, title: 'Người ghi sổ (LessonWriter)', sub: 'src/experience/lesson_writer.py',
          desc: 'Người ghi sổ DUY NHẤT — mọi bài học muốn vào database phải đi qua nó, nên 4 process chạy song song cũng không bao giờ tranh ghi bị khóa. Chống trùng bằng mã băm nội dung: bài học đã có sẵn thì chỉ tăng số lần lặp và cộng dồn lãi/lỗ, không chèn dòng mới. Ghi xong báo bộ nhớ đệm làm mới lại.',
          docs: ['doc/doc_experience/01-experience-db-spec.md'], decs: ['DEC-18'] },
        { id: 'lessons', type: 'db', x: 710, y: 170, title: 'Sổ bài học (Lessons)', sub: 'bảng trong experience.db',
          desc: 'Sổ bài học — mỗi dòng tối đa 200 ký tự theo mẫu chuẩn [TRÁNH | NÊN | CẢNH BÁO] + cặp tiền + bối cảnh + điều kiện → hành động. Có ghi ai tạo (AI A / AI B / hệ thống / Boss / nhập tay / import), phạm vi áp dụng (chỉ 1 cặp / nhóm cặp / mọi cặp), và vòng đời: đang dùng → hết giá trị → lưu trữ.',
          docs: ['doc/doc_experience/01-experience-db-spec.md'], decs: ['DEC-17'] },
        { id: 'backend', type: 'engine', x: 710, y: 480, title: 'Bộ lọc kinh nghiệm', sub: 'phía sau hàm get_memory_pack()',
          desc: 'Bộ lọc kinh nghiệm phía sau hàm get_memory_pack(). Bản v1 (đang dùng): SQL lọc sơ bộ theo cặp tiền + bối cảnh + hành động dự kiến, rồi chấm điểm theo công thức (mức nghiêm trọng nặng nhất, rồi số lần lặp, độ liên quan, độ mới) → lấy 6 bài tốt nhất. Bản v2 (tương lai): SQL lấy ~20 ứng viên → model nhỏ (vd Jev) chấm lại độ liên quan → lấy top K. Quy tắc an toàn: model chấm sập → tự quay về v1 — kinh nghiệm chỉ là tư vấn nên KHÔNG ĐƯỢC đóng băng hệ thống vì nó.',
          docs: ['doc/doc_experience/02-map-to-agents.md'], decs: ['DEC-18'] },
        { id: 'cache', type: 'db', x: 1050, y: 300, title: 'Bộ nhớ đệm (MemoryCache)', sub: 'giữ kết quả 1 giờ',
          desc: 'Bộ nhớ đệm 1 giờ — gói kinh nghiệm đã dựng sẵn được giữ theo khóa (cặp tiền + bối cảnh + hành động). Trùng khóa → trả về ngay lập tức, không phải tính điểm lại. Khi bài học thay đổi, cache tương ứng bị xóa để lần sau dựng mới.',
          docs: ['doc/doc_experience/01-experience-db-spec.md'], decs: [] },
        { id: 'pack', type: 'engine', x: 1390, y: 300, title: 'Gói kinh nghiệm (MemoryPack)', sub: 'tối đa 500 token, chia 2 tầng',
          desc: 'Gói kinh nghiệm gọn tối đa 500 token, chia 2 tầng: Tầng 1 (≤150 token) = hồ sơ đặc tính cặp tiền + 2 bài học «vạn năng» nghiêm trọng nhất luôn được nhắc. Tầng 2 (≤350 token) = 6 bài học liên quan nhất tình huống hiện tại. Mặc định chỉ mang tính khuyên; nếu bật chế độ ép buộc, người kiểm an toàn được quyền từ chối kế hoạch phạm bài học TRÁNH mức cao.',
          docs: ['doc/doc_experience/01-experience-db-spec.md'], decs: [] },
        { id: 'agents', type: 'agent', x: 1730, y: 300, title: 'Chích vào prompt A và B', sub: 'trước mỗi quyết định',
          desc: 'Chích gói kinh nghiệm vào prompt của CẢ A và B trước mỗi quyết định — hai bên đọc chung một gói nên B dễ dàng bắt bài khi A đề xuất trùng kiểu từng thua. Chi phí token cho việc này được ghi sổ riêng để theo dõi ngân sách.',
          docs: ['doc/doc_agents/13-experience-loop.md'], decs: [] },
        { id: 'feedback', type: 'worker', x: 1730, y: 500, title: 'Chấm điểm bài học (LessonFeedback)', sub: 'ghi sau khi đóng lệnh',
          desc: 'Sổ chấm điểm bài học: sau khi đóng lệnh, ghi lại bài học nào đã được áp dụng và kết quả thắng/thua/hòa kèm số tiền. Bài học nào được áp dụng 3 lần liên tiếp đều thua → tự động cho «nghỉ hưu» (chuyển hết giá trị) vì chứng tỏ nó không còn đúng nữa.',
          docs: ['doc/doc_experience/01-experience-db-spec.md'], decs: ['DEC-18'] },
        { id: 'profiles', type: 'db', x: 710, y: 40, title: 'Hồ sơ cặp tiền (PairProfiles)', sub: 'đặc tính 4 cặp',
          desc: 'Hồ sơ đặc tính của 4 cặp tiền — ghi ngắn (≤300 ký tự/cặp) cách giá từng cặp «cư xử»: cặp nào hay đi ngang, cặp nào nhạy tin, biên độ thường ngày... Luôn nằm sẵn trong Tầng 1 của gói kinh nghiệm để AI biết đang chơi với đối thủ nào.',
          docs: ['doc/doc_experience/01-experience-db-spec.md'], decs: [] },
        { id: 'jev', type: 'external', x: 1050, y: 480, title: 'Model Jev chấm lại (v2 — tương lai)', sub: 'xếp hạng lại ứng viên theo ngữ nghĩa',
          desc: 'Bản nâng cấp TƯƠNG LAI — nằm NGAY TRÊN đường truy vấn của pipeline v2: Bộ lọc → Jev → Bộ nhớ đệm → Gói kinh nghiệm (chưa triển khai). Thay vì chỉ tin công thức chấm điểm cứng, SQL vẫn lọc sơ bộ ~20 bài học ứng viên rồi gửi cho model Jev (TypeSafe) chấm độ liên quan theo NGỮ NGHĨA với tình huống hiện tại → xếp hạng lại, lấy top K. Ưu điểm: bắt được bài học liên quan về ý nghĩa dù không khớp từ khóa cứng. An toàn: Jev sập hoặc timeout → tự quay về công thức v1 (fail-open, nhánh nét đứt) — kinh nghiệm chỉ là tư vấn nên KHÔNG ĐƯỢC đóng băng hệ thống vì nó.',
          docs: ['doc/doc_experience/02-map-to-agents.md'], decs: ['DEC-18'] }
      ],
      edges: [
        { from: 'triggers', to: 'writer', label: 'rút bài học từ kết quả' },
        { from: 'proposed', to: 'writer', label: 'đề xuất qua người điều phối', dashed: true },
        { from: 'writer', to: 'lessons', label: 'ghi + chống trùng' },
        { from: 'writer', to: 'cache', label: 'báo làm mới', dashed: true },
        { from: 'lessons', to: 'backend', label: 'bài học ứng viên' },
        { from: 'profiles', to: 'backend', label: 'hồ sơ cặp (tầng 1)', dashed: true },
        { from: 'backend', to: 'jev', label: 'v2: gửi ~20 ứng viên' },
        { from: 'jev', to: 'cache', label: 'trả top-K đã xếp hạng' },
        { from: 'backend', to: 'cache', label: 'v1 & Jev lỗi → chấm công thức trực tiếp (fail-open)', dashed: true },
        { from: 'cache', to: 'pack', label: 'trả gói kinh nghiệm' },
        { from: 'pack', to: 'agents', label: 'chích vào prompt' },
        { from: 'agents', to: 'feedback', label: 'chấm điểm sau đóng lệnh', dashed: true },
        { from: 'feedback', to: 'lessons', label: 'thua ≥3 lần → nghỉ hưu', dashed: true }
      ]
    },

    // ======================= FLOW 4: STATE MACHINE =======================
    {
      id: 'state_machine',
      icon: '🚦',
      title: '4. State Machine & DCA/Recovery',
      desc: 'Vòng đời trạng thái của một cặp tiền: TRỐNG LỆNH (FLAT) → ĐANG GIỮ TRONG NGƯỠNG AN TOÀN (NORMAL) → RỔ QUÁ TẢI PHẢI CỨU (RECOVERY) → quay về TRỐNG LỆNH. Mọi bước chuyển trạng thái đều phải qua 2 AI đồng thuận — không có chuyển trạng thái nào tự động mở lệnh mới.',
      nodes: [
        { id: 'flat', type: 'state', x: 80, y: 240, title: 'TRỐNG LỆNH (FLAT)', sub: 'tổng khối lượng = 0',
          desc: 'Không giữ lệnh nào. Hệ thống chỉ thức dậy để đánh giá xem có nên vào lệnh không — nhịp bắt buộc là sau mỗi nến 1 giờ đóng. Chiến dịch chưa mở ra vì chưa có lệnh thật nào khớp.',
          docs: ['doc/doc_phuong_phap/06-state-machine.md'], decs: ['DEC-16'] },
        { id: 'normal', type: 'state', x: 470, y: 240, title: 'GIỮ AN TOÀN (NORMAL)', sub: 'tổng khối lượng < 0.3 lot',
          desc: 'Đang giữ lệnh nhưng tổng khối lượng còn dưới ngưỡng nguy hiểm (0.3 lot). Hẹn giờ linh hoạt mỗi 3-60 phút để canh. Được phép mua/bán trung bình giá thêm (DCA) khi giá đi đủ khoảng cách và 2 AI cùng đồng ý. Vào lệnh mới vẫn chỉ được xét sau khi nến 1 giờ đóng.',
          docs: ['doc/doc_phuong_phap/06-state-machine.md', 'doc/doc_agents/07-dca-dual-review-loop.md'], decs: ['DEC-09'] },
        { id: 'recovery', type: 'state', x: 860, y: 240, title: 'CỨU HÀNG (RECOVERY)', sub: 'tổng khối lượng ≥ 0.3 lot',
          desc: 'Rổ lệnh vượt ngưỡng nguy hiểm → vào chế độ cứu hàng: CẤM TUYỆT ĐỐI mở lệnh ngược hướng. Giá đi xấu thêm → chỉ được DCA cứu khi đủ khoảng cách. Giá hồi thuận → tỉa bớt 15-30% khối lượng để hạ rổ, và luôn cắt lệnh lỗ NHỎ NHẤT trước (đỡ đau nhất).',
          docs: ['doc/doc_phuong_phap/07-recovery-loop.md'], decs: [] },
        { id: 'consensus_gate', type: 'agent', x: 470, y: 500, title: 'Cửa đồng thuận A+B', sub: 'mọi hành động đều qua đây',
          desc: 'Cửa ải chung cho MỌI hành động — vào lệnh, DCA, DCA cứu, tỉa lãi, đóng hết, đóng một phần — đều phải đi đúng quy trình: A đề xuất → B chấm → đồng thuận → người kiểm an toàn duyệt → vào hàng đợi. Không có đường tắt nào được mở lệnh mới (ngoại lệ duy nhất là nhánh INVALIDATION đã cam kết sẵn).',
          docs: ['doc/doc_agents/03-consensus-protocol.md'], decs: [] }
      ],
      edges: [
        { from: 'flat', to: 'normal', label: 'vào lệnh khớp (2 AI duyệt)' },
        { from: 'normal', to: 'recovery', label: 'tổng lot vượt ngưỡng' },
        { from: 'normal', to: 'flat', label: 'chốt/đóng hết → sạch lệnh' },
        { from: 'recovery', to: 'flat', label: 'tỉa + đóng → hết lệnh' },
        { from: 'consensus_gate', to: 'flat', label: 'canh mọi bước chuyển', dashed: true },
        { from: 'consensus_gate', to: 'normal', dashed: true },
        { from: 'consensus_gate', to: 'recovery', dashed: true }
      ]
    },

    // ======================= FLOW 5: RELIABILITY =======================
    {
      id: 'reliability',
      icon: '🛡️',
      title: '5. Độ tin cậy: FREEZE / Reconcile / Startup',
      desc: 'Khi AI sập (gọi không trả lời, server lỗi, hết quota): hệ thống chọn ĐÓNG BĂNG mọi quyết định mới thay vì tự chạy theo luật cứng dễ sai — nhưng lệnh bảo vệ đã cam kết (INVALIDATION) vẫn được canh và chạy bình thường. AI hồi phục → tự chạy tiếp kèm so khớp sổ sách nhẹ. Process chết đột ngột → khởi động lại so khớp đầy đủ và khôi phục kế hoạch đang hiệu lực.',
      nodes: [
        { id: 'monitor', type: 'orchestrator', x: 30, y: 240, title: 'Người canh sức khỏe AI', sub: 'src/orchestrator/freeze_monitor.py',
          desc: 'Người canh sức khỏe của AI: gọi model quá 30 giây không trả lời, server trả lỗi, hoặc bị giới hạn tần suất sau nhiều lần thử lại → bật cờ ĐÓNG BĂNG cho toàn hệ thống đồng thời gửi cảnh báo cho Boss kèm ảnh chụp các vị thế đang giữ.',
          docs: ['doc/doc_phuong_phap/12-operations-reliability.md'], decs: [] },
        { id: 'freeze', type: 'state', x: 370, y: 240, title: 'ĐÓNG BĂNG (SYSTEM_FREEZE)', sub: 'cờ toàn hệ thống',
          desc: 'Trạng thái đóng băng: không quyết định mới nào được sinh ra — engine không đưa lệnh vào hàng đợi, executor không nhận lệnh mới, trạng thái giữ nguyên yên. Cố ý KHÔNG chuyển sang chế độ «chạy theo luật cứng» thay AI vì luật cứng dễ ra quyết định sai trong tình huống lạ.',
          docs: ['doc/doc_phuong_phap/12-operations-reliability.md'], decs: ['DEC-08'] },
        { id: 'inv_watch', type: 'executor', x: 370, y: 450, title: 'Người canh vùng cắt', sub: 'chạy không cần AI',
          desc: 'NGOẠI LỆ duy nhất sống sót khi đóng băng: vùng INVALIDATION đã cam kết trong kế hoạch vẫn được canh liên tục — giá chạm thì tự cắt/thoát. Đây là thực hiện lời hứa cũ để bảo vệ rổ lệnh, không phải quyết định mới nên không cần AI.',
          docs: ['doc/ERRATA.md'], decs: ['DEC-10'] },
        { id: 'resume', type: 'orchestrator', x: 710, y: 240, title: 'Tự chạy lại (Auto-Resume)', sub: 'AI phục hồi → gỡ đóng băng',
          desc: 'AI khỏe lại → hệ thống tự gỡ đóng băng và chạy tiếp, nhưng trước khi quyết định gì phải «so khớp nhẹ»: đối chiếu nhanh lệnh trên sàn với sổ sách database xem trong lúc ngủ có lệch gì không.',
          docs: ['doc/doc_phuong_phap/12-operations-reliability.md'], decs: [] },
        { id: 'startup', type: 'orchestrator', x: 1050, y: 60, title: 'Khởi động process', sub: 'src/orchestrator/startup.py',
          desc: 'Quy trình khởi động khi bật process (vd sau khi crash hoặc reboot VPS): kết nối database → đăng nhập MT5 → so khớp đầy đủ sổ sách với sàn → khôi phục kế hoạch đang hiệu lực và cuốn nhật ký tóm tắt → nạp sẵn 60 nến ngày + 30 nến giờ cho engine → bật executor.',
          docs: ['doc/doc_flow_code/05-phase-4-orchestrator-operations.md'], decs: [] },
        { id: 'reconcile', type: 'engine', x: 1050, y: 260, title: 'So khớp sổ sách (Reconcile)', sub: 'src/orchestrator/reconcile.py',
          desc: 'Bộ so khớp sổ sách giữa sàn và database. So khớp nhẹ: kiểm tra vị thế và mã lệnh hai bên có khớp nhau không, lệch thì cập nhật theo sàn. So khớp nặng: dựng lại toàn bộ trạng thái từ dữ liệu sàn + hủy các lệnh treo mồ côi trong hàng đợi. Nếu so khớp thất bại → không được đoán bừa trạng thái: kế hoạch dự phòng tạo qua A↔B vẫn kế thừa điều khoản cắt lỗ cũ (DEC-13) để rổ lệnh không mất bảo vệ.',
          docs: ['doc/doc_phuong_phap/12-operations-reliability.md'], decs: ['DEC-13'] },
        { id: 'monitoring', type: 'worker', x: 1050, y: 460, title: 'Giám sát vận hành', sub: 'nhịp tim process + cảnh báo',
          desc: 'Nhật ký sức khỏe vận hành: nhịp tim của các process, cảnh báo mất kết nối sàn, hàng đợi tồn đọng quá 5 lệnh, và chi phí token AI — để Boss nhìn dashboard nắm được hệ thống còn khỏe không.',
          docs: ['doc/doc_phuong_phap/12-operations-reliability.md'], decs: [] }
      ],
      edges: [
        { from: 'monitor', to: 'freeze', label: 'AI sập' },
        { from: 'freeze', to: 'inv_watch', label: 'lớp bảo vệ vẫn chạy' },
        { from: 'freeze', to: 'resume', label: 'AI khỏe lại' },
        { from: 'resume', to: 'reconcile', label: 'so khớp nhẹ' },
        { from: 'startup', to: 'reconcile', label: 'so khớp nặng + khôi phục kế hoạch' },
        { from: 'reconcile', to: 'monitoring', label: 'sẵn sàng' }
      ]
    },

    // ======================= FLOW 6: BOSS CHANNEL =======================
    {
      id: 'boss_channel',
      icon: '👤',
      title: '6. Boss Channel & Escalation (Telegram)',
      desc: 'Boss (con người) đóng vai kênh tư vấn + chỉ đạo KHI ĐƯỢC HỎI — không can thiệp trực tiếp vào lệnh. Khi 2 AI gặp tình huống mơ hồ, chúng gửi «phiếu hỏi» lên Telegram; phiếu chờ trả lời theo kiểu bất đồng bộ nên hệ thống không bị treo chờ Boss.',
      nodes: [
        { id: 'boss_wake', type: 'boss', x: 30, y: 80, title: 'Boss đánh thức (BossWake)', sub: 'gọi qua Telegram / CLI',
          desc: 'Boss chủ động triệu tập «hội đồng 3 bên» (A + B + Boss, tối đa 12 lượt trao đổi) qua Telegram/CLI — ví dụ hỏi «sao đang giữ lệnh này?». Quan trọng: kết quả hội đồng vẫn phải đi qua đồng thuận 2 AI + kiểm an toàn — Boss không thể tự tay bấm lệnh trên sàn.',
          docs: ['doc/doc_agents/11-boss-interrupt-flow.md'], decs: [] },
        { id: 'escalate', type: 'agent', x: 30, y: 320, title: 'Hỏi Boss (escalate_to_boss)', sub: 'công cụ của cả A và B',
          desc: 'Công cụ «hỏi Boss» mà cả A và B đều được dùng khi gặp tình huống mơ hồ: dữ liệu tự mâu thuẫn nhau, luật cứng bảo một đằng nhưng nến hiện một nẻo... Hai AI ngang hàng nên ai cũng có quyền gửi phiếu hỏi.',
          docs: ['doc/doc_agents/15-uncertainty-escalation.md'], decs: [] },
        { id: 'ticket', type: 'db', x: 370, y: 320, title: 'Phiếu hỏi (EscalationTickets)', sub: 'chờ trả lời — không chặn hệ thống',
          desc: 'Phiếu hỏi được «gửi xe» chờ Boss — hệ thống KHÔNG dừng lại chờ: nhịp hẹn giờ vẫn chạy bình thường, chỉ là không tạo hành động mới cần đồng thuận (trừ INVALIDATION vẫn chạy). Quá 30 phút Boss không trả lời → hệ thống tự giải quyết và đánh dấu phiếu đã tự xử.',
          docs: ['doc/doc_agents/15-uncertainty-escalation.md'], decs: ['DEC-15'] },
        { id: 'telegram', type: 'external', x: 710, y: 320, title: 'Telegram Bot', sub: 'gửi và nhận tin với Boss',
          desc: 'Bot Telegram chuyển câu hỏi + bối cảnh thị trường + phân tích của AI tới điện thoại Boss. Khi Boss trả lời, hệ thống biết gắn vào đúng phiếu nào nhờ mã phiếu. Boss trả lời quá hạn → chỉ ghi nhận làm tư liệu, không đảo lại quyết định đã chốt.',
          docs: ['doc/doc_agents/16-telegram-bot-design.md'], decs: [] },
        { id: 'directive', type: 'boss', x: 1050, y: 320, title: 'Lời chỉ đạo của Boss', sub: '2 AI phải tuân khi Boss trả lời',
          desc: 'Khi Boss trả lời đúng hạn: lời Boss được chích vào vòng quyết định kế tiếp và 2 AI phải tuân tuyệt đối — Boss bảo CHỜ thì chờ, bảo HỦY kế hoạch thì hủy, không cãi.',
          docs: ['doc/doc_agents/15-uncertainty-escalation.md'], decs: [] },
        { id: 'kill', type: 'boss', x: 1050, y: 80, title: 'Nút dừng khẩn cấp (Kill-Switch)', sub: 'đóng toàn bộ lệnh ngay lập tức',
          desc: 'Nút dừng khẩn cấp do người bấm — đóng toàn bộ lệnh ngay lập tức, bỏ qua mọi quy trình. Là phao cứu sinh cuối cùng nên phải test kỹ trong checklist trước khi chạy tiền thật.',
          docs: ['doc/doc_flow_code/07-developer-checklist-and-definition-of-done.md'], decs: [] }
      ],
      edges: [
        { from: 'boss_wake', to: 'directive', label: 'hội đồng 3 bên', dashed: true },
        { from: 'escalate', to: 'ticket', label: 'tạo phiếu hỏi' },
        { from: 'ticket', to: 'telegram', label: 'đẩy thông báo' },
        { from: 'telegram', to: 'directive', label: 'Boss trả lời ≤30 phút' },
        { from: 'ticket', to: 'directive', label: 'quá hạn → tự quyết', dashed: true }
      ]
    },

    // ======================= FLOW 7: MULTI-INSTANCE =======================
    {
      id: 'instances',
      icon: '🏭',
      title: '7. Đa tiến trình Per-Symbol (ADR-001)',
      desc: 'Nguyên tắc «1 cặp tiền = 1 process độc lập»: mỗi cặp có sổ sách riêng, hẹn giờ riêng, executor riêng — một cặp sập không kéo các cặp khác chết theo. Thứ duy nhất dùng chung là database kinh nghiệm (đọc thoải mái, ghi phải qua người ghi sổ duy nhất). Muốn thêm cặp mới = thêm dòng cấu hình + sinh thêm process.',
      nodes: [
        { id: 'p1', type: 'external', x: 30, y: 40, title: 'Process AUDCAD', sub: 'main.py --symbol AUDCAD',
          desc: 'Process phụ trách cặp AUDCAD — hoàn toàn độc lập: sổ sách riêng (file dca_AUDCAD.db, 14 bảng, ghi chắc chắn synchronous=FULL), hẹn giờ riêng, 2 AI riêng, executor riêng. Nó crash thì 3 cặp còn lại vẫn chạy bình thường.',
          docs: ['doc/doc_flow_code/01-architecture-and-project-structure.md'], decs: ['ADR-001'] },
        { id: 'p2', type: 'external', x: 30, y: 180, title: 'Process AUDNZD', sub: 'main.py --symbol AUDNZD',
          desc: 'Process cặp AUDNZD — sổ sách riêng (dca_AUDNZD.db), bật chế độ WAL và chờ 5 giây khi database bận để tránh lỗi khóa.', docs: [], decs: ['ADR-001'] },
        { id: 'p3', type: 'external', x: 30, y: 320, title: 'Process GBPUSD', sub: 'main.py --symbol GBPUSD',
          desc: 'Process cặp GBPUSD — sổ sách riêng (dca_GBPUSD.db).', docs: [], decs: ['ADR-001'] },
        { id: 'p4', type: 'external', x: 30, y: 460, title: 'Process NZDCAD', sub: 'main.py --symbol NZDCAD',
          desc: 'Process cặp NZDCAD — sổ sách riêng (dca_NZDCAD.db).', docs: [], decs: ['ADR-001'] },
        { id: 'expdb', type: 'db', x: 460, y: 230, title: 'Sổ kinh nghiệm chung (experience.db)', sub: 'chỉ đọc — ghi qua LessonWriter',
          desc: 'Sổ kinh nghiệm DÙNG CHUNG cho cả 4 process (bài học, bộ nhớ đệm, hồ sơ cặp, sổ chấm điểm bài học). Các process chỉ được ĐỌC qua hàm get_memory_pack; muốn GHI phải đi qua người ghi sổ duy nhất (LessonWriter) — nhờ đó 4 process cùng chạy mà không bao giờ khoá database vì tranh ghi.',
          docs: ['doc/doc_experience/01-experience-db-spec.md'], decs: [] },
        { id: 'mt5_all', type: 'external', x: 460, y: 480, title: 'MT5 Terminal (dùng chung)', sub: 'lệnh phân biệt bằng magic number',
          desc: 'Một terminal MT5 duy nhất phục vụ cả 4 process cùng lúc. Để không nhận nhầm lệnh của nhau, mỗi process đánh dấu lệnh của mình bằng «magic number» riêng và chỉ đọc/ghi đúng lệnh mang mã đó.',
          docs: ['doc/doc_phuong_phap/09-data-sources.md'], decs: [] },
        { id: 'spawn', type: 'orchestrator', x: 870, y: 230, title: 'Bộ sinh process (Spawner)', sub: 'main.py --all / Windows Service',
          desc: 'Bộ phận sinh process: chạy lệnh main.py --all sẽ đọc danh sách cặp từ file cấu hình symbols.yaml rồi sinh đủ N process tương ứng. Chạy production trên VPS Windows thì đăng ký thành 4 Windows Service (qua NSSM) để tự khởi động lại khi chết.',
          docs: ['doc/doc_flow_code/06-phase-5-e2e-testing-and-deployment.md'], decs: [] }
      ],
      edges: [
        { from: 'p1', to: 'expdb', label: 'đọc bài học (chỉ đọc)', dashed: true },
        { from: 'p2', to: 'expdb', dashed: true },
        { from: 'p3', to: 'expdb', dashed: true },
        { from: 'p4', to: 'expdb', dashed: true },
        { from: 'p1', to: 'mt5_all', dashed: true },
        { from: 'p2', to: 'mt5_all', dashed: true },
        { from: 'p3', to: 'mt5_all', dashed: true },
        { from: 'p4', to: 'mt5_all', dashed: true },
        { from: 'spawn', to: 'p1', label: 'sinh process', dashed: true }
      ]
    }
  ]
};
