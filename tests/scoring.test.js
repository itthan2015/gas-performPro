// รัน: node tests/scoring.test.js — ทดสอบกฎเกรด/โควต้าใน Scoring.gs (ไม่ต้องติดตั้งอะไรเพิ่ม)
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const gs = fs.readFileSync(path.join(root, 'src/Scoring.gs'), 'utf8');
const ctx = {}; vm.runInNewContext(gs + ';this.SCORING = SCORING;', ctx);
const S = ctx.SCORING, DEF = JSON.parse(JSON.stringify(S.DEFAULT_GRADE_CFG));

// 1) ตัดเกรดตามเกณฑ์ใหม่ (ขอบ)
[[100, 'A'], [85, 'A'], [84.99, 'B'], [75, 'B'], [74.99, 'C'], [70, 'C'], [69.99, 'D'], [0, 'D']]
  .forEach(([t, g]) => assert.strictEqual(ctx.gradeOf(t, 'g1', DEF)[0], g, 'total ' + t));
assert.strictEqual(ctx.gradeOf(85, 'g1', DEF)[1], 'ดีเยี่ยม');
// สเกลเดิมเมื่อไม่มี cfg และฟอร์ม 4–5 ไม่เปลี่ยน
assert.strictEqual(ctx.gradeOf(95, 'g1', null)[0], 'A+');
assert.strictEqual(ctx.gradeOf(80, 'g3_off', null)[0], 'B+');
assert.strictEqual(ctx.gradeOf(90, 'g45', DEF)[0], '5');
assert.strictEqual(ctx.gradeOf(60, 'g45', DEF)[0], '1');

// 2) calcScore ใช้ cfg (อาร์กิวเมนต์ที่ 5)
const sc = { lv: [0, 0, 0, 0, 0, 0, null, null], sc: [20, 10, 10, 10, 10, 10, null, null] };
const full = ctx.calcScore('g1', {}, sc, null, DEF);
assert.ok(full.complete); assert.strictEqual(full.total, 100); assert.strictEqual(full.grade, 'A');
assert.strictEqual(ctx.calcScore('g1', {}, sc).grade, 'A+');
const low = ctx.calcScore('g1', { absent: 5 }, sc, null, DEF); // หัก 25 → 75
assert.strictEqual(low.total, 75); assert.strictEqual(low.grade, 'B'); assert.strictEqual(low.label, 'ดี');

// 3) gradeLevels / gradeInfo
assert.deepStrictEqual(ctx.gradeLevels('g1', DEF).map(g => [g[0], g[2]]), [['A', '≥ 85'], ['B', '75 – 84.99'], ['C', '70 – 74.99'], ['D', '< 70']]);
assert.strictEqual(ctx.gradeLevels('g1', null), S.GR_NEW);
assert.strictEqual(ctx.gradeLevels('g45', DEF), S.GR_SUP);
assert.strictEqual(ctx.gradeInfo('g1', DEF, 'A')[1], 'ดีเยี่ยม');
assert.strictEqual(ctx.gradeInfo('g1', DEF, 'B+')[1], 'ดีปานกลาง'); // ข้อมูลนำเข้าเกรดเก่า
assert.strictEqual(ctx.gradeInfo('g45', DEF, '4')[1], 'ดี');
assert.strictEqual(ctx.gradeInfo('g1', DEF, 'Z'), null);

// 4) เพดานโควต้า (≥ .5 ปัดขึ้น)
const caps = n => { const c = ctx.quotaCaps(n, DEF); return [c.A, c.B, c.C]; };
assert.deepStrictEqual(caps(1), [0, 1, 0]);
assert.deepStrictEqual(caps(2), [0, 1, 1]);
assert.deepStrictEqual(caps(3), [1, 2, 1]);
assert.deepStrictEqual(caps(5), [1, 3, 2]);
assert.deepStrictEqual(caps(10), [2, 5, 3]);
assert.strictEqual(ctx.quotaCaps(10, null), null);

// 5) quotaError
assert.match(ctx.quotaError(DEF, 10, { A: 2 }, 'A'), /เกรด A เกินโควต้าของกลุ่ม \(ใช้แล้ว 2 จาก 2 คน · กลุ่ม 10 คน\)/);
assert.strictEqual(ctx.quotaError(DEF, 10, { A: 1 }, 'A'), null);
assert.strictEqual(ctx.quotaError(DEF, 10, { D: 50 }, 'D'), null);
assert.strictEqual(ctx.quotaError(null, 10, { A: 9 }, 'A'), null);
assert.match(ctx.quotaError(DEF, 2, {}, 'A'), /ใช้แล้ว 0 จาก 0 คน · กลุ่ม 2 คน/);
assert.match(ctx.quotaError(DEF, 10, { B: 5 }, 'B'), /เกรด B/);

// 6) normGradeCfg
assert.strictEqual(ctx.normGradeCfg(null), null);
assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.normGradeCfg(DEF))), DEF);
const bad = f => { const c = JSON.parse(JSON.stringify(DEF)); f(c); return () => ctx.normGradeCfg(c); };
assert.throws(bad(c => c.levels[1].min = 85));
assert.throws(bad(c => c.levels[2].min = -1));
assert.throws(bad(c => c.quota.A = 120));
assert.throws(bad(c => c.levels[0].label = ' '));
assert.throws(bad(c => c.levels[0].min = 'x'));
assert.throws(bad(c => c.levels.pop()));
assert.strictEqual(ctx.normGradeCfg({ levels: [{ g: 'A', min: '90', label: 'x' }, { g: 'B', min: 80, label: 'y' }, { g: 'C', min: 60, label: 'z' }, { g: 'D', min: 0, label: 'w' }], quota: { A: '10', B: 40, C: 50 } }).levels[0].min, 90);

// 7) Scoring.gs กับ ScoringClient.html ต้องตรงกัน
const body = s => s.slice(s.indexOf('var SCORING'), s.lastIndexOf('}') + 1);
assert.strictEqual(body(fs.readFileSync(path.join(root, 'src/ScoringClient.html'), 'utf8')), body(gs), 'ScoringClient.html ไม่ตรงกับ Scoring.gs');
console.log('ok');
