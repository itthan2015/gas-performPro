// รัน: node tests/ui.test.js — เปิดหน้าเว็บจริง (Index + App + ScoringClient) ด้วย Playwright พร้อม API จำลอง
const fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const strip = s => s.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
const b64 = s => Buffer.from(strip(s), 'utf8').toString('base64');
const DEF = { levels: [{ g: 'A', min: 85, label: 'ดีเยี่ยม' }, { g: 'B', min: 75, label: 'ดี' }, { g: 'C', min: 70, label: 'พอใช้' }, { g: 'D', min: 0, label: 'ต้องปรับปรุง' }], quota: { A: 20, B: 50, C: 30 } };

function page(role, quota) {
  const me = { empCode: 'u1', name: 'ผู้ทดสอบ', role, scopeType: role === 'eval' ? 'dept' : 'all', scopeValues: ['D1'] };
  const emp = (i, st, g, t) => ({ code: 'e' + i, name: 'พนักงาน ' + i, level: 1, pos: 'ช่าง', dept: 'D1', div: 'V1', form: 'new', fcode: 'g1', status: st, isactive: true, total: t, grade: g, canEdit: false, canAct: false });
  const mock = {
    apiPing: true,
    apiBootstrap: { me, cycle: { id: 1, name: 'ประเมินผลการปฏิบัติงานประจำปี 2569 ครั้งที่ 2', data_from: '2026-04-01', data_to: '2026-09-30', is_active: true, grade_cfg: DEF }, weights: {}, units: { V1: ['D1'] }, canAtt: false, empView: true, quota },
    apiListEmployees: [emp(1, 'div', 'A', 90), emp(2, 'exec', 'A', 88), emp(3, 'div', 'A', 86), emp(4, 'done', 'B', 80), emp(5, 'draft', 'C', 72)],
    apiQuota: quota,
    apiGetEvaluation: { emp: { code: 'e5', name: 'พนักงาน 5', level: 1, pos: 'ช่าง', dept: 'D1', div: 'V1', form: 'new', fcode: 'g1', skipDiv: false, start: '2020-01-01' }, att: {}, scores: { lv: [null, null, null, null, null, null, null, null], sc: [null, null, null, null, null, null, null, null], reasons: ['', '', '', '', '', '', '', ''], courses: ['', ''], comments: ['', ''] }, status: 'draft', returnNote: '', history: [], hidden: false, closed: false, canEdit: true, canAct: false, canReturn: false, prev: [], files: [], canUpload: false },
    apiGradeCfgGet: { cycleId: 1, activeId: 1, cfg: DEF, def: DEF, cycles: [{ id: 1, name: 'รอบ 2569/2', active: true, hasCfg: true }, { id: 0, name: 'รอบเก่า', active: false, hasCfg: false }] }
  };
  const gs = `<script>window.__calls=[];window.google={script:{run:(function mk(ok,fail){return new Proxy({},{get:(t,k)=>{
      if(k==='withSuccessHandler')return f=>mk(f,fail); if(k==='withFailureHandler')return f=>mk(ok,f);
      return (...a)=>{window.__calls.push([k,a]);setTimeout(()=>{const M=${JSON.stringify(mock)};
        if(k==='apiGradeCfgSave'){const c=a[2];return ok(Object.assign({},M.apiGradeCfgGet,{cfg:c}));}
        k in M?ok(M[k]):fail(new Error('no mock '+k));},5);};}});})()}};
      try{sessionStorage.setItem('pp_token','t')}catch(e){}</script>`;
  return rd('Index.html')
    .replace("<?!= include('Styles'); ?>", rd('Styles.html') + gs)
    .replace(/<\?!= JSON\.stringify\(logoUrl_\(\)\) \?>/, '""')
    .replace(/<\? if \(logoUrl_\(\)\) \{ \?>[\s\S]*?<\? \} \?>/, '')
    .replace("<?!= clientBundle_('ScoringClient') ?>", b64(rd('ScoringClient.html')))
    .replace("<?!= clientBundle_('App') ?>", b64(rd('App.html')));
}

(async () => {
  const br = await chromium.launch(), errs = [];
  const open = async (role, quota) => {
    const p = await br.newPage({ viewport: { width: 1280, height: 900 } });
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/fonts\.googleapis|ERR_FAILED|Failed to load resource/.test(m.text()) && errs.push(m.text()));
    p.on('dialog', d => d.accept());
    // sessionStorage ใช้ไม่ได้บน about:blank → เสิร์ฟผ่าน URL จำลอง
    const html = page(role, quota);
    await p.route('http://pp.test/**', r => r.request().url().endsWith('/') ? r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }) : r.abort());
    await p.goto('http://pp.test/'); await p.waitForSelector('#nav .nav-item'); return p;
  };
  const READY = { grades: '[data-gc="A.min"]', help: 'label:has([data-helptab="grade"])', dash: '#main .kpi' };
  const navTo = async (p, k) => { await p.click(`[data-nav="${k}"]`); await p.waitForSelector(READY[k]); await p.waitForFunction(() => document.getElementById('loadDlg').hidden); };

  // HR: เมนูใหม่ + ตาราง 4 ระดับ + ตรวจค่าก่อนบันทึก
  let p = await open('hr', null);
  assert.ok(await p.$('[data-nav="grades"]'), 'ไม่มีเมนูเกณฑ์เกรด');
  await navTo(p, 'grades');
  const val = s => p.$eval(s, el => el.value);
  assert.strictEqual(await val('[data-gc="A.min"]'), '85'); assert.strictEqual(await val('[data-gc="B.min"]'), '75'); assert.strictEqual(await val('[data-gc="C.min"]'), '70');
  assert.strictEqual(await val('[data-gc="A.q"]'), '20'); assert.strictEqual(await val('[data-gc="B.q"]'), '50'); assert.strictEqual(await val('[data-gc="C.q"]'), '30');
  assert.match(await p.textContent('#main'), /ไม่จำกัด/);
  assert.match(await p.textContent('#main'), /10 คน.*A 2.*B 5.*C 3/s);
  await p.fill('[data-gc="A.min"]', '70'); await p.click('[data-act="gcSave"]');
  assert.match(await p.textContent('#main'), /ต้องมากกว่าเกรด B/);
  assert.ok(!(await p.evaluate(() => window.__calls.some(c => c[0] === 'apiGradeCfgSave'))), 'ต้องไม่เรียกบันทึกเมื่อค่าผิด');
  await p.fill('[data-gc="A.min"]', '90'); await p.fill('[data-gc="A.label"]', 'ยอดเยี่ยม'); await p.click('[data-act="gcSave"]');
  await p.waitForFunction(() => window.__calls.some(c => c[0] === 'apiGradeCfgSave'));
  const saved = await p.evaluate(() => window.__calls.find(c => c[0] === 'apiGradeCfgSave')[1]);
  assert.strictEqual(saved[1], 1); assert.strictEqual(saved[2].levels[0].min, 90); assert.strictEqual(saved[2].levels[0].label, 'ยอดเยี่ยม');
  // Help แท็บเกณฑ์ใช้สเกลของรอบ · แดชบอร์ดแสดง A–D
  await navTo(p, 'help'); await p.click('label:has([data-helptab="grade"])');
  const help = await p.textContent('#main');
  assert.match(help, /พนักงานเกรด 1–3 \(A, B, C, D\)/); assert.match(help, /ยอดเยี่ยม/); assert.match(help, /โควต้าเกรด/); assert.match(help, /ไม่จำกัด/);
  await navTo(p, 'dash');
  const dash = await p.textContent('#main');
  assert.match(dash, /ต้องปรับปรุง/); assert.ok(!/A\+/.test(dash), 'แดชบอร์ดยังแสดง A+');
  await p.screenshot({ path: path.join(process.env.SHOT_DIR || '/tmp', 'ui-dash.png') });
  await navTo(p, 'grades'); await p.screenshot({ path: path.join(process.env.SHOT_DIR || '/tmp', 'ui-grades.png'), fullPage: true });

  // ผู้ประเมิน: แถบโควต้า + เกินเป็นสีเตือน
  p = await open('eval', { n: 10, caps: { A: 2, B: 5, C: 3 }, used: { A: 3, B: 1, C: 0, D: 0 }, over: ['A'] });
  const qb = await p.textContent('.quota-bar');
  assert.match(qb, /โควต้ากลุ่ม \(10 คน\)/); assert.match(qb, /A 3\/2/); assert.match(qb, /B 1\/5/); assert.match(qb, /D 0/); assert.match(qb, /เกินโควต้า/);
  assert.ok(await p.$('.quota-bar .q-over'), 'ไม่มีสีเตือนเมื่อเกิน');
  await p.screenshot({ path: path.join(process.env.SHOT_DIR || '/tmp', 'ui-list.png') });
  p = await open('eval', null);
  assert.strictEqual(await p.$('.quota-bar'), null);
  // แบบประเมิน: ปุ่ม "ดูเกณฑ์การให้เกรด" แสดงเกณฑ์ของรอบ (A–D) ไม่ error
  await p.click('tr[data-code="e5"] button'); await p.waitForSelector('[data-act="guide"]');
  await p.click('[data-act="guide"]'); await p.waitForTimeout(300); if (/แสดงหน้านี้ไม่สำเร็จ/.test(await p.textContent('#main'))) throw new Error('RENDER FAIL: ' + (await p.textContent('#main')).trim().slice(0, 120)); await p.waitForFunction(() => /ซ่อนเกณฑ์การให้เกรด/.test(document.getElementById('main').textContent));
  const evTxt = await p.textContent('#main');
  assert.ok(!/แสดงหน้านี้ไม่สำเร็จ/.test(evTxt), 'หน้าแบบประเมินพังเมื่อเปิดเกณฑ์'); assert.match(evTxt, /ต้องปรับปรุง/); assert.match(evTxt, /75 – 84\.99/);

  await br.close();
  assert.deepStrictEqual(errs, [], 'console errors');
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
