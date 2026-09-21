// overview-builder.js — Tự sinh tab "Bản đồ TỔNG HỢP" từ toàn bộ node của các tab chi tiết.
//
// Nguyên tắc: tab Tổng hợp KHÔNG lưu data riêng — nó được build lại từ FLOW_DATA.flows
// mỗi lần load, nên sửa tab chi tiết là bản đồ tổng tự cập nhật.
// File này tách riêng để khi user xuất/ghi đè flows-data.js thì builder vẫn còn.
//
// Mỗi tab chi tiết = một "vùng" (zone) trên canvas lớn:
//   - Node được clone với id mới dạng "<flowId>.<nodeId>", tọa độ dời theo offset vùng.
//   - Edge trong cùng vùng giữ nguyên (đã prefix id).
//   - BRIDGES: các edge nét đứt nối GIỮA các vùng — thể hiện liên kết chéo giữa hệ con.
//
// Muốn đổi vị trí vùng: sửa ZONES. Muốn thêm liên kết chéo: sửa BRIDGES.

(function () {
  'use strict';

  // --- Vị trí các vùng trên canvas tổng (gốc trên-trái của vùng, banner nằm trên 80px) ---
  const ZONES = [
    { fid: 'wake_cycle',     zx: 40,   zy: 140,  tag: 'VÙNG 1' },
    { fid: 'boss_channel',   zx: 2750, zy: 140,  tag: 'VÙNG 6' },
    { fid: 'reliability',    zx: 2750, zy: 560,  tag: 'VÙNG 5' },
    { fid: 'plan_lifecycle', zx: 40,   zy: 1150, tag: 'VÙNG 2' },
    { fid: 'state_machine',  zx: 2450, zy: 1150, tag: 'VÙNG 4' },
    { fid: 'instances',      zx: 3560, zy: 1150, tag: 'VÙNG 7' },
    { fid: 'experience',     zx: 40,   zy: 1760, tag: 'VÙNG 3' }
  ];

  // --- Liên kết chéo giữa các vùng (luôn nét đứt) ---
  const BRIDGES = [
    { from: 'wake_cycle.commit',        to: 'plan_lifecycle.committed', label: 'ghi COMMITTED' },
    { from: 'plan_lifecycle.committed', to: 'wake_cycle.plan_gate',     label: 'plan hiệu lực nạp mỗi wake' },
    { from: 'plan_lifecycle.supervise', to: 'wake_cycle.route',         label: 'plan ACTIVE chờ trigger' },
    { from: 'experience.pack',          to: 'wake_cycle.agent_a',       label: 'MemoryPack → prompt' },
    { from: 'wake_cycle.agent_b',       to: 'experience.proposed',      label: 'lessons_proposed[]' },
    { from: 'plan_lifecycle.done',      to: 'experience.triggers',      label: 'đóng lệnh → thời điểm học' },
    { from: 'wake_cycle.summarizer',    to: 'plan_lifecycle.summary',   label: 'cùng 1 worker nền' },
    { from: 'wake_cycle.mt5_exec',      to: 'state_machine.flat',       label: 'đóng sạch → FLAT' },
    { from: 'reliability.freeze',       to: 'wake_cycle.route',         label: 'chặn quyết định mới' },
    { from: 'reliability.inv_watch',    to: 'wake_cycle.inv_exec',      label: 'nuôi nhánh stop khi FREEZE' },
    { from: 'boss_channel.directive',   to: 'wake_cycle.scheduler',     label: 'Boss ra lệnh' },
    { from: 'wake_cycle.reconcile',     to: 'boss_channel.escalate',    label: 'bế tắc → escalate Boss' },
    { from: 'instances.spawn',          to: 'wake_cycle.scheduler',     label: '1 process/cặp chạy cả sơ đồ này' },
    { from: 'instances.expdb',          to: 'experience.lessons',       label: 'cùng file experience.db' }
  ];

  /**
   * Build flow tổng hợp từ danh sách flows chi tiết.
   * Gọi được với bất kỳ flows nào (file gốc hoặc data đã sửa trong localStorage/import).
   */
  window.buildOverview = function (flows) {
    const byId = {};
    (flows || []).forEach(f => { if (!f.generated) byId[f.id] = f; });

    const nodes = [], edges = [];
    ZONES.forEach(z => {
      const f = byId[z.fid];
      if (!f) return;
      const xs = f.nodes.map(n => n.x), ys = f.nodes.map(n => n.y);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      const w = Math.max(...xs) - x0 + 215 + 60;
      // Banner vùng — node type 'zone', rộng bằng bề ngang vùng
      nodes.push({
        id: 'zone__' + z.fid, type: 'zone', x: z.zx, y: z.zy - 80, w: w,
        title: z.tag + ' · ' + f.title,
        sub: f.nodes.length + ' bước — sửa ở tab «' + f.title + '»',
        desc: f.desc, docs: [], decs: []
      });
      f.nodes.forEach(n => nodes.push(Object.assign({}, n, {
        id: z.fid + '.' + n.id,
        x: z.zx + (n.x - x0),
        y: z.zy + (n.y - y0)
      })));
      f.edges.forEach(e => edges.push({
        from: z.fid + '.' + e.from, to: z.fid + '.' + e.to,
        label: e.label, dashed: e.dashed
      }));
    });
    BRIDGES.forEach(b => edges.push({ from: b.from, to: b.to, label: b.label, dashed: true }));

    return {
      id: 'overview', generated: true, icon: '🗺️',
      title: '0. Bản đồ TỔNG HỢP (đầy đủ)',
      desc: 'Toàn bộ các bước của 7 tab chi tiết trên cùng một canvas, chia theo vùng chức năng. Nét đứt dài nối giữa các vùng = liên kết chéo giữa các hệ con. Tab này TỰ SINH từ các tab chi tiết — muốn sửa nội dung hay vị trí node, hãy sửa ở tab chi tiết tương ứng (tab này tự cập nhật theo).',
      nodes: nodes, edges: edges
    };
  };

  // Tự chèn tab tổng hợp lên đầu khi load file gốc
  if (window.FLOW_DATA && window.FLOW_DATA.flows) {
    window.FLOW_DATA.flows = window.FLOW_DATA.flows.filter(f => !f.generated);
    window.FLOW_DATA.flows.unshift(window.buildOverview(window.FLOW_DATA.flows));
  }
})();
