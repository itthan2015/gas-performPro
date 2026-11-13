// รัน: node tests/server.test.js — ทดสอบการตรวจโควต้าใน Code.gs ด้วยข้อมูลจำลอง (ไม่เรียก Supabase จริง)
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const src = ['src/Scoring.gs', 'src/Code.gs', 'src/Brand.gs'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

function world(opt) {
  const ctx = { console, JSON, Math };
  const DEF = { levels: [{ g: 'A', min: 85, label: 'ดีเยี่ยม' }, { g: 'B', min: 75, label: 'ดี' }, { g: 'C', min: 70, label: 'พอใช้' }, { g: 'D', min: 0, label: 'ต้องปรับปรุง' }], quota: { A: 20, B: 50, C: 30 } };
  const st = ctx.__st = {
    cycles: [{ id: 1, name: 'รอบ 1', year_be: 2569, round: 1, is_active: true, grade_cfg: opt.noCfg ? null : DEF }],
    evals: opt.evals || [], patches: [], posts: [], locked: 0,
    emps: Array.from({ length: opt.n || 10 }, (_, i) => ({ code: 'e' + (i + 1), name: 'พนักงาน ' + (i + 1), dept: 'D1', div: 'V1', form: 'new', fcode: 'g1', level: 1, pos: 'ช่าง', evaluate: true, active: true, skipDiv: false }))
      .concat(opt.extra || []),
    user: Object.assign({ emp_code: 'boss', full_name: 'หัวหน้า', role: 'eval', scope_type: 'dept', scope_values: ['D1'] }, opt.user || {})
  };
  vm.createContext(ctx);
  vm.runInContext(src + `
    var PropertiesService = { getScriptProperties: function () { return { getProperty: function () { return null; }, setProperty: function () {} }; } };
    var LockService = { getScriptLock: function () { return { waitLock: function () { __st.locked++; }, releaseLock: function () { __st.locked--; } }; } };
    me_ = function () { return __st.user; };
    requireRole_ = function (u, roles) { if (u.role !== 'admin' && roles.indexOf(u.role) < 0) throw new Error('no role'); };
    cycle_ = function () { return __st.cycles.filter(function (c) { return c.is_active; })[0]; };
    employees_ = function () { return __st.emps; };
    attOf_ = function (cid, code) { return (__st.att || {})[code] || {}; };
    addHistory_ = function () {};
    getEval_ = function (u, code) { return { ok: code }; };
    evalOf_ = function (cid, code) { return __st.evals.filter(function (e) { return e.cycle_id === cid && e.emp_code === code; })[0] || null; };
    sb_ = function (m, p, body) {
      if (m === 'get' && /^PFormPro_evaluations\\?cycle_id=eq\\.(\\d+)&select=emp_code,status,grade$/.test(p)) { var id = Number(RegExp.$1); return __st.evals.filter(function (e) { return e.cycle_id === id; }); }
      if (m === 'get' && /^PFormPro_eval_cycles\\?id=eq\\.(\\d+)/.test(p)) { var i2 = Number(RegExp.$1); return __st.cycles.filter(function (c) { return c.id === i2; }); }
      if (m === 'get' && /^PFormPro_eval_cycles\\?select=id,name,is_active,grade_cfg/.test(p)) return __st.cycles;
      if (m === 'get' && /^PFormPro_evaluations\\?cycle_id=eq\\.(\\d+)&status=neq\\.done/.test(p)) { var i3 = Number(RegExp.$1); return __st.evals.filter(function (e) { return e.cycle_id === i3 && e.status !== 'done'; }).map(function (e) { return JSON.parse(JSON.stringify(e)); }); }
      if (m === 'get' && /^PFormPro_attendance\\?cycle_id=eq/.test(p)) { var A = __st.att || {}; return Object.keys(A).map(function (k) { return { emp_code: k, late_min: A[k].late || 0, absent_days: A[k].absent || 0 }; }); }
      if (m === 'patch') { __st.patches.push([p, body]); if (/^PFormPro_eval_cycles\\?id=eq\\.(\\d+)$/.test(p)) { var i4 = Number(RegExp.$1); __st.cycles.forEach(function (c) { if (c.id === i4) Object.assign(c, body); }); } return null; }
      if (m === 'post' && /^PFormPro_evaluations\\?on_conflict/.test(p)) { var rows = Array.isArray(body) ? body : [body]; __st.posts.push(rows); rows.forEach(function (r) { var old = evalOf_(r.cycle_id, r.emp_code); if (old) Object.assign(old, r); else __st.evals.push(Object.assign({ id: __st.evals.length + 1 }, r)); }); return [evalOf_(rows[0].cycle_id, rows[0].emp_code)]; }
      throw new Error('unexpected sb_ ' + m + ' ' + p);
    };
  `, ctx);
  return ctx;
}
const ev = (code, status, grade) => ({ cycle_id: 1, emp_code: code, status, grade, total: 90, form: 'g1', scores: {} });
const FULL = { lv: [0, 0, 0, 0, 0, 0, null, null], sc: [20, 10, 10, 10, 10, 10, null, null] }; // 100 คะแนน = A

// 1) A ส่งแล้ว 2 จากเพดาน 2 → คนที่ 3 ได้ A ส่งไม่ได้ · lock ถูกปล่อย
let w = world({ evals: [ev('e1', 'div', 'A'), ev('e2', 'exec', 'A')] });
assert.throws(() => w.apiSubmit('t', 'e3', FULL), /เกรด A เกินโควต้าของกลุ่ม \(ใช้แล้ว 2 จาก 2 คน · กลุ่ม 10 คน\)/);
assert.strictEqual(w.__st.locked, 0);
assert.strictEqual(w.evalOf_(1, 'e3'), null, 'ต้องไม่บันทึกเมื่อเกินโควต้า');
// ได้ B (ขาดงาน 5 วัน → 75) ส่งได้
w.__st.att = { e3: { absent: 5 } };
w.apiSubmit('t', 'e3', FULL);
assert.strictEqual(w.evalOf_(1, 'e3').grade, 'B'); assert.strictEqual(w.evalOf_(1, 'e3').status, 'div');

// 2) draft / returned ไม่นับ · คนที่ส่งใหม่หลังถูกส่งกลับไม่ถูกนับตัวเอง
w = world({ evals: [ev('e1', 'div', 'A'), ev('e2', 'returned', 'A'), ev('e4', 'draft', 'A')] });
w.apiSubmit('t', 'e2', FULL);
assert.strictEqual(w.evalOf_(1, 'e2').status, 'div');

// 3) รอบไม่มี grade_cfg → ไม่ตรวจโควต้า ใช้สเกลเดิม
w = world({ noCfg: true, evals: [ev('e1', 'div', 'A+'), ev('e2', 'div', 'A+'), ev('e5', 'div', 'A+')] });
w.apiSubmit('t', 'e3', FULL);
assert.strictEqual(w.evalOf_(1, 'e3').grade, 'A+');

// 4) ฟอร์ม 4–5 ไม่ตรวจโควต้า
w = world({ evals: [ev('e1', 'div', 'A'), ev('e2', 'div', 'A')], extra: [{ code: 's1', name: 'หัวหน้าแผนก', dept: 'D1', div: 'V1', form: 'sup', fcode: 'g45', level: 4, pos: 'หัวหน้าแผนก', evaluate: true, active: true, skipDiv: false }], user: { role: 'div', scope_type: 'div', scope_values: ['V1'] } });
const SUP = { lv: [0, 0, 0, 0, 0, 0, 0, 0], sc: w.SCORING.FORMS.g45.c.map(p => p.max).concat([null, null, null, null, null, null, null, null]).slice(0, 8) };
w.apiSubmit('t', 's1', SUP);
assert.strictEqual(w.evalOf_(1, 's1').grade, '5');

// 5) สรุปโควต้าให้หน้ารายชื่อ: ไม่นับคนลาออก/ไม่ร่วมประเมิน/ตัวเอง
w = world({ evals: [ev('e1', 'div', 'A'), ev('e2', 'done', 'B'), ev('e3', 'draft', 'A')], extra: [{ code: 'x1', dept: 'D1', form: 'new', fcode: 'g1', evaluate: true, active: false }, { code: 'x2', dept: 'D1', form: 'new', fcode: 'g1', evaluate: false, active: true }, { code: 'boss', dept: 'D1', form: 'new', fcode: 'g1', evaluate: true, active: true }] });
let q = JSON.parse(JSON.stringify(w.apiQuota('t')));
assert.deepStrictEqual(q, { n: 10, caps: { A: 2, B: 5, C: 3 }, used: { A: 1, B: 1, C: 0, D: 0 }, over: [] });
w.__st.evals.push(ev('e4', 'hr', 'A'), ev('e5', 'ack', 'A'));
assert.deepStrictEqual(JSON.parse(JSON.stringify(w.apiQuota('t'))).over, ['A']);
assert.strictEqual(world({ noCfg: true }).apiQuota('t'), null);
assert.strictEqual(world({ user: { role: 'exec', scope_type: 'all' } }).apiQuota('t'), null);

// 6) หน้าจัดการเกณฑ์: hr บันทึกได้ · ค่าผิดถูกปฏิเสธ · eval ใช้ไม่ได้ · บันทึกแล้วคำนวณเกรดใหม่ (ยกเว้น done)
w = world({ user: { role: 'hr', scope_type: 'all' }, evals: [Object.assign(ev('e1', 'div', 'A'), { scores: FULL }), Object.assign(ev('e2', 'done', 'A'), { scores: FULL })] });
let g = w.apiGradeCfgGet('t');
assert.strictEqual(g.cycleId, 1); assert.strictEqual(g.cfg.levels[0].min, 85); assert.strictEqual(g.def.quota.B, 50);
const cfg2 = JSON.parse(JSON.stringify(g.cfg)); cfg2.levels[0].min = 101;
assert.throws(() => w.apiGradeCfgSave('t', 1, cfg2), /เกรด A/);
cfg2.levels[0].min = 100.01; assert.throws(() => w.apiGradeCfgSave('t', 1, cfg2));
cfg2.levels[0].min = 100; cfg2.levels[0].label = 'สุดยอด';
w.apiGradeCfgSave('t', 1, cfg2);
assert.strictEqual(w.__st.cycles[0].grade_cfg.levels[0].label, 'สุดยอด');
assert.strictEqual(w.evalOf_(1, 'e1').grade, 'A', '100 ≥ 100 ยังเป็น A');
cfg2.levels[0].min = 100; cfg2.levels[1].min = 99; w.__st.att = { e1: { late: 60 } }; // 99.5 → B
w.apiGradeCfgSave('t', 1, cfg2);
assert.strictEqual(w.evalOf_(1, 'e1').grade, 'B'); assert.strictEqual(w.evalOf_(1, 'e2').grade, 'A', 'done ไม่คำนวณใหม่');
w.apiGradeCfgSave('t', 1, null);
assert.strictEqual(w.__st.cycles[0].grade_cfg, null);
assert.throws(() => world({}).apiGradeCfgGet('t'), /no role/);
console.log('ok');
