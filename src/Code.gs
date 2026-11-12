/**
 * PerformPro · Google Apps Script + Supabase
 * Script Properties ที่ต้องตั้ง: SUPABASE_URL, SUPABASE_SERVICE_KEY
 *
 * การเข้าสู่ระบบ
 *  - พนักงาน: กรอกรหัสพนักงาน → ระบบสุ่มถาม 1 ข้อ (4 ตัวท้ายบัตรประชาชน / วันเกิด / 4 ตัวท้ายเบอร์โทร)
 *  - หัวหน้า / ผู้อนุมัติ / ผู้บริหาร / HR: รหัสพนักงาน + รหัสผ่าน (ตาราง app_users)
 *  - ผิดครบ 3 ครั้ง บัญชีถูกล็อกจนกว่า HR จะปลดล็อก
 */

var SESSION_TTL = 6 * 60 * 60;   // 6 ชั่วโมง
var CHALLENGE_TTL = 5 * 60;      // 5 นาที
var MAX_FAILS = 3;
var MAX_FILE = 10 * 1024 * 1024; // 10 MB ต่อไฟล์
var P = 'PFormPro_';               // คำนำหน้าชื่อตารางทั้งหมดใน Supabase
var BUCKET = 'pformpro-attachments'; // Supabase Storage bucket สำหรับไฟล์แนบ
var QUESTIONS = {
  id:    { label: '4 ตัวท้ายเลขบัตรประจำตัวประชาชน', ph: 'XXXX' },
  dob:   { label: 'วันเดือนปีเกิด (พ.ศ.)', ph: 'วว/ดด/ปปปป เช่น 14/03/2513' },
  phone: { label: '4 ตัวท้ายเบอร์โทรศัพท์ที่ให้ไว้กับบริษัท', ph: 'XXXX' }
};

function doGet() {
  var out = HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('PerformPro · ประเมินผลการปฏิบัติงาน')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  var icon = logoUrl_(); // Script Property LOGO_URL → รูปใน Supabase Storage (ดู Brand.gs)
  if (icon) { try { out.setFaviconUrl(icon); } catch (e) {} }
  return out;
}
function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }
function apiPing() { return true; }

// ส่งสคริปต์หน้าเว็บแบบ base64 เพื่อไม่ให้ HtmlService แปลงหรือตัดโค้ด JavaScript ที่มีแท็ก HTML อยู่ในสตริง
function clientBundle_(name) {
  var raw = HtmlService.createTemplateFromFile(name).getRawContent();
  raw = raw.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
  return Utilities.base64Encode(raw, Utilities.Charset.UTF_8);
}

// รันจาก Editor เพื่อตรวจการเชื่อมต่อ Supabase: ดูผลที่ Execution log
function testConnection() {
  var c = cfg_();
  Logger.log('SUPABASE_URL = ' + c.url);
  ['employees', 'eval_cycles', 'app_users', 'weight_sets'].forEach(function (t) {
    try { var r = sb_('get', P + t + '?select=*&limit=1'); Logger.log('✓ ' + P + t + ' อ่านได้ (' + r.length + ' แถวตัวอย่าง)'); }
    catch (e) { Logger.log('✗ ' + P + t + ' : ' + e.message); }
  });
  try { Logger.log('✓ รอบประเมินที่เปิดอยู่: ' + cycle_().name); } catch (e) { Logger.log('✗ ' + e.message); }
  try { storage_('get', 'bucket/' + BUCKET); Logger.log('✓ พบ Storage bucket ' + BUCKET); } catch (e) { Logger.log('✗ Storage bucket ' + BUCKET + ' : ' + e.message); }
  var lu = logoUrl_();
  if (!lu) Logger.log('✗ ยังไม่ได้ตั้ง Script Property LOGO_URL → รัน setupLogo() หรือใส่ Public URL ของรูปใน Supabase Storage');
  else try { var lr = UrlFetchApp.fetch(lu, { muteHttpExceptions: true }).getResponseCode(); Logger.log((lr < 300 ? '✓' : '✗') + ' โลโก้ LOGO_URL = ' + lu + ' (' + lr + ')'); } catch (e) { Logger.log('✗ โลโก้ : ' + e.message); }
}

// ───────── Supabase REST / Storage ─────────
function cfg_() {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('SUPABASE_URL'), key = p.getProperty('SUPABASE_SERVICE_KEY');
  if (!url || !key) throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SERVICE_KEY ใน Script Properties');
  return { url: url.replace(/\/$/, ''), key: key };
}
function sb_(method, path, body, prefer) {
  var c = cfg_();
  var opt = { method: method, muteHttpExceptions: true, contentType: 'application/json', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key } };
  if (prefer) opt.headers.Prefer = prefer;
  if (body !== undefined) opt.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(c.url + '/rest/v1/' + path, opt);
  var code = res.getResponseCode(), txt = res.getContentText();
  if (code >= 300) throw new Error('Supabase ' + code + ': ' + txt);
  return txt ? JSON.parse(txt) : null;
}
function storage_(method, path, payload, contentType) {
  var c = cfg_();
  var opt = { method: method, muteHttpExceptions: true, headers: { apikey: c.key, Authorization: 'Bearer ' + c.key } };
  if (payload !== undefined) { opt.payload = payload; opt.contentType = contentType || 'application/json'; }
  var res = UrlFetchApp.fetch(c.url + '/storage/v1/' + path, opt);
  if (res.getResponseCode() >= 300) throw new Error('Storage ' + res.getResponseCode() + ': ' + res.getContentText());
  var t = res.getContentText();
  try { return t ? JSON.parse(t) : null; } catch (e) { return t; }
}
function q_(v) { return encodeURIComponent(v); }
function now_() { return new Date().toISOString(); }

// ───────── รหัสผ่าน / session ─────────
function hash_(pwd, salt) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pwd, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function newSalt_() { return Utilities.getUuid().replace(/-/g, ''); }
function cache_() { return CacheService.getScriptCache(); }

function attempts_(code) { return sb_('get', P + 'login_attempts?emp_code=eq.' + q_(code))[0] || { emp_code: code, fails: 0, locked: false }; }
function lockMsg_(code) { return 'บัญชี ' + code + ' ถูกล็อกเนื่องจากยืนยันตัวตนไม่สำเร็จเกิน ' + MAX_FAILS + ' ครั้ง กรุณาติดต่อฝ่ายบุคคลเพื่อปลดล็อก'; }
function assertNotLocked_(code) { if (attempts_(code).locked) throw new Error(lockMsg_(code)); }
function registerFail_(code) {
  var a = attempts_(code), fails = (a.fails || 0) + 1, locked = fails >= MAX_FAILS;
  sb_('post', P + 'login_attempts?on_conflict=emp_code', { emp_code: code, fails: fails, locked: locked, updated_at: now_() }, 'resolution=merge-duplicates');
  throw new Error(locked ? lockMsg_(code) : 'ข้อมูลไม่ถูกต้อง เหลือโอกาสอีก ' + (MAX_FAILS - fails) + ' ครั้ง');
}
function clearFails_(code) { sb_('delete', P + 'login_attempts?emp_code=eq.' + q_(code)); }

function createSession_(type, code) {
  var token = Utilities.getUuid();
  cache_().put('sess_' + token, JSON.stringify({ type: type, code: code }), SESSION_TTL);
  return token;
}

// ผู้ใช้ปัจจุบันจาก token (อ่านบทบาท/ขอบเขตล่าสุดจากฐานข้อมูลทุกครั้ง การเปลี่ยนสิทธิ์จึงมีผลทันที)
function me_(token) {
  var raw = token ? cache_().get('sess_' + token) : null;
  if (!raw) throw new Error('SESSION_EXPIRED');
  cache_().put('sess_' + token, raw, SESSION_TTL);
  var s = JSON.parse(raw);
  var e = sb_('get', P + 'employees?emp_code=eq.' + q_(s.code) + '&active=is.true&select=emp_code,full_name')[0];
  if (!e) throw new Error('SESSION_EXPIRED');
  var u = sb_('get', P + 'app_users?emp_code=eq.' + q_(s.code) + '&active=is.true')[0];
  if (s.type !== 'staff' && u) throw new Error('SESSION_EXPIRED'); // บทบาทเปลี่ยน → ให้เข้าสู่ระบบใหม่ที่แท็บหัวหน้า / HR
  if (s.type === 'staff') {
    if (!u) throw new Error('SESSION_EXPIRED');
    return { emp_code: u.emp_code, full_name: e.full_name, role: u.role, scope_type: u.scope_type, scope_values: u.scope_values || [] };
  }
  return { emp_code: e.emp_code, full_name: e.full_name, role: 'emp', scope_type: 'self', scope_values: [] };
}
// admin = ผู้ดูแลระบบ ผ่านทุกสิทธิ์
// ตั้งค่า: ให้พนักงานดูผลประเมินของตนเองได้หรือไม่ (เก็บใน Script Properties · ค่าเริ่มต้น = เปิด)
function empView_() { return PropertiesService.getScriptProperties().getProperty('EMP_VIEW') !== 'off'; }
function apiSetEmpView(token, on) {
  var u = me_(token); requireRole_(u, ['hr']);
  PropertiesService.getScriptProperties().setProperty('EMP_VIEW', on ? 'on' : 'off');
  PropertiesService.getScriptProperties().setProperty('EMP_VIEW_BY', u.full_name + ' · ' + now_());
  return { empView: empView_(), by: u.full_name };
}
function requireRole_(u, roles) { if (u.role === 'admin') return; if (roles.indexOf(u.role) < 0) throw new Error('คุณไม่มีสิทธิ์ทำรายการนี้'); }

// ───────── API: เข้าสู่ระบบ ─────────
var ROLE_TH = { eval: 'ผู้ประเมิน', div: 'ผู้อนุมัติระดับฝ่าย', exec: 'ผู้บริหาร', hr: 'HR Admin', admin: 'ผู้ดูแลระบบ' };
function apiLoginStart(code) {
  code = String(code || '').trim();
  if (!code) throw new Error('กรุณากรอกรหัสพนักงาน');
  assertNotLocked_(code);
  var e = sb_('get', P + 'employees?emp_code=eq.' + q_(code) + '&active=is.true&select=emp_code,full_name,national_id_last4,birth_date,phone_last4')[0];
  if (!e) throw new Error('ไม่พบรหัสพนักงานนี้ในระบบ หรือบัญชีถูกปิดใช้งาน');
  // บัญชีที่มีบทบาท (ผู้ประเมิน/ผู้อนุมัติ/ผู้บริหาร/HR/Admin) ต้องเข้าทางแท็บหัวหน้า / HR เพื่อให้ได้บทบาทและขอบเขตที่ตั้งไว้
  var su = sb_('get', P + 'app_users?emp_code=eq.' + q_(code) + '&active=is.true&select=role')[0];
  if (su) throw new Error('STAFF_ACCOUNT:รหัสนี้มีบทบาท ' + (ROLE_TH[su.role] || su.role) + ' กรุณาเข้าสู่ระบบที่แท็บ "หัวหน้า / HR" ด้วยรหัสผ่าน');
  var keys = ['id', 'dob', 'phone'].filter(function (k) { return k === 'id' ? e.national_id_last4 : k === 'dob' ? e.birth_date : e.phone_last4; });
  if (!keys.length) throw new Error('ยังไม่มีข้อมูลสำหรับยืนยันตัวตน กรุณาติดต่อฝ่ายบุคคล');
  var q = keys[Math.floor(Math.random() * keys.length)], id = Utilities.getUuid();
  cache_().put('ch_' + id, JSON.stringify({ code: code, q: q }), CHALLENGE_TTL);
  return { challengeId: id, code: code, name: e.full_name, question: QUESTIONS[q].label, placeholder: QUESTIONS[q].ph };
}

function apiLoginAnswer(challengeId, answer) {
  var raw = cache_().get('ch_' + challengeId);
  if (!raw) throw new Error('คำถามหมดอายุ กรุณาเริ่มใหม่');
  var ch = JSON.parse(raw);
  assertNotLocked_(ch.code);
  var e = sb_('get', P + 'employees?emp_code=eq.' + q_(ch.code) + '&select=national_id_last4,birth_date,phone_last4')[0] || {};
  var want = '';
  if (ch.q === 'id') want = String(e.national_id_last4 || '');
  if (ch.q === 'phone') want = String(e.phone_last4 || '');
  if (ch.q === 'dob' && e.birth_date) { var p = e.birth_date.split('-'); want = p[2] + p[1] + (Number(p[0]) + 543); }
  var got = String(answer || '').replace(/\D/g, '');
  if (!got) throw new Error('กรุณากรอกคำตอบ');
  if (!want || got !== want.replace(/\D/g, '')) registerFail_(ch.code);
  cache_().remove('ch_' + challengeId);
  clearFails_(ch.code);
  return { token: createSession_('emp', ch.code) };
}

function apiStaffLogin(code, password) {
  code = String(code || '').trim();
  if (!code || !password) throw new Error('กรุณากรอกรหัสพนักงานและรหัสผ่าน');
  assertNotLocked_(code);
  var u = sb_('get', P + 'app_users?emp_code=eq.' + q_(code) + '&active=is.true')[0];
  var e = sb_('get', P + 'employees?emp_code=eq.' + q_(code) + '&active=is.true&select=emp_code')[0];
  if (!u || !e || !u.password_hash || hash_(password, u.password_salt) !== u.password_hash) registerFail_(code);
  clearFails_(code);
  return { token: createSession_('staff', code) };
}

function apiLogout(token) { if (token) cache_().remove('sess_' + token); return true; }

// ───────── ข้อมูลอ้างอิง ─────────
function cycle_() {
  var r = sb_('get', P + 'eval_cycles?is_active=is.true&order=id.desc&limit=1');
  if (!r.length) throw new Error('ยังไม่มีรอบการประเมินที่เปิดใช้งาน');
  return r[0];
}
function weights_() { var W = {}; sb_('get', P + 'weight_sets?select=form,weights').forEach(function (x) { W[x.form] = x.weights; }); return W; }
function units_() {
  var U = {};
  sb_('get', P + 'divisions?select=name&order=name').forEach(function (d) { U[d.name] = []; });
  sb_('get', P + 'departments?select=name,divisions:PFormPro_divisions(name)&order=name').forEach(function (d) { var k = d.divisions ? d.divisions.name : 'ไม่ระบุฝ่าย'; (U[k] = U[k] || []).push(d.name); });
  return U;
}
// all = true รวมพนักงานที่ปิดใช้งาน/ไม่ร่วมประเมิน (ใช้ในหน้าจัดการพนักงาน)
// อ่านข้อมูล ถ้าคอลัมน์ใหม่ยังไม่มีในฐานข้อมูล (ยังไม่ได้รัน SQL อัปเดต) จะตัดคอลัมน์นั้นออกแล้วอ่านใหม่
var OPTIONAL_COLS = ['eval_form', 'emp_status', 'emp_status_detail', 'resign_date', 'last_scan', 'phone', 'remark'];
function selectSafe_(url) {
  for (var i = 0; i <= OPTIONAL_COLS.length; i++) {
    try { return sb_('get', url); }
    catch (e) {
      var mm = /column [^ ]*?\.?([a-z_]+) does not exist/.exec(String(e.message || e));
      if (!mm || OPTIONAL_COLS.indexOf(mm[1]) < 0) throw e;
      Logger.log('คอลัมน์ ' + mm[1] + ' ยังไม่มีในฐานข้อมูล — กรุณารันไฟล์ SQL อัปเดต');
      url = url.replace(new RegExp(',' + mm[1] + '(?=[,&]|$)'), '');
    }
  }
  return sb_('get', url);
}
function employees_(all) {
  var f = all ? '' : 'active=is.true&evaluate=is.true&';
  var url = P + 'employees?' + f + 'select=emp_code,full_name,grade,position,start_date,work_site,employment_type,active,evaluate,national_id_last4,birth_date,phone_last4,phone,remark,emp_status,emp_status_detail,resign_date,last_scan,eval_form,departments:PFormPro_departments(name,divisions:PFormPro_divisions(name))&order=emp_code';
  return selectSafe_(url).map(function (e) {
    var d = e.departments || {};
    return { code: e.emp_code, name: e.full_name, level: e.grade, pos: e.position, start: e.start_date, site: e.work_site, type: e.employment_type,
      dept: d.name || '', div: d.divisions ? d.divisions.name : '', form: e.grade >= 4 ? 'sup' : 'new', skipDiv: skipDivStep(e.grade, e.position), fcode: pickForm(e.grade, e.position, e.eval_form), evalForm: e.eval_form || '', active: e.active, evaluate: e.evaluate,
      nid4: e.national_id_last4, dob: e.birth_date, phone4: e.phone_last4, phone: all ? (e.phone || '') : '', remark: all ? (e.remark || '') : '',
      status: e.emp_status || (e.active === false ? 'resigned' : 'working'), statusDetail: e.emp_status_detail || '', resign: e.resign_date || '', lastScan: e.last_scan || '' }; // phone/remark เฉพาะ HR
  });
}
function publicEmp_(e) { var o = {}; for (var k in e) if (['nid4', 'dob', 'phone4'].indexOf(k) < 0) o[k] = e[k]; return o; }
function inScope_(u, e) {
  var sv = u.scope_values || [];
  if (u.scope_type === 'all') return true;
  if (u.scope_type === 'self') return u.emp_code === e.code;
  if (u.scope_type === 'dept') return sv.indexOf(e.dept) >= 0;
  if (u.scope_type === 'div') return sv.indexOf(e.div) >= 0;
  return false;
}
function canEdit_(u, e, status) {
  if (['none', 'draft', 'returned'].indexOf(status) < 0 || !inScope_(u, e) || e.code === u.emp_code) return false;
  if (u.role === 'admin') return true;
  if (u.role === 'eval') return e.form === 'new' || u.scope_type === 'div';
  if (u.role === 'div') return e.form === 'sup';
  return false;
}
function canAct_(u, e, status) {
  if (!inScope_(u, e)) return false;
  if (u.role === 'admin') return ['div', 'exec', 'hr'].indexOf(status) >= 0;
  return (status === 'div' && u.role === 'div') || (status === 'exec' && u.role === 'exec') || (status === 'hr' && u.role === 'hr') || (status === 'ack' && u.role === 'emp' && u.emp_code === e.code);
}
function canUpload_(u, e) { if (u.role === 'admin') return true; return u.role === 'emp' ? u.emp_code === e.code : (['eval', 'div', 'hr'].indexOf(u.role) >= 0 && inScope_(u, e)); }
function scopedEmp_(u, code) {
  var e = employees_(u.role === 'hr' || u.role === 'admin').filter(function (x) { return x.code === code; })[0];
  if (!e || !inScope_(u, e)) throw new Error('ไม่พบพนักงาน หรือพนักงานอยู่นอกขอบเขตสิทธิ์ของคุณ');
  return e;
}
function attRow_(a) {
  a = a || {};
  var o = { late: Number(a.late_min || 0), sick: Number(a.sick_days || 0), personal: Number(a.personal_days || 0), absent: Number(a.absent_days || 0) };
  if (a.verbal_count != null) o.verbal = Number(a.verbal_count);
  if (a.written_count != null) o.written = Number(a.written_count);
  return o;
}
function attOf_(cycleId, code) { return attRow_(sb_('get', P + 'attendance?cycle_id=eq.' + cycleId + '&emp_code=eq.' + q_(code))[0]); }
function evalOf_(cycleId, code) { return sb_('get', P + 'evaluations?cycle_id=eq.' + cycleId + '&emp_code=eq.' + q_(code))[0] || null; }
function addHistory_(evalId, step, label, u, note) {
  sb_('post', P + 'eval_history', { evaluation_id: evalId, step: step, label: label, actor_code: u.emp_code, actor_name: u.full_name, note: note || '' });
}

// ───────── แบบฟอร์มเดิม (ก่อน rev.10.11.69) — ใช้แสดงผลประเมินรอบก่อนหน้าตามหัวข้อเดิม ─────────
var LEGACY = {
  new: { parts: [['คุณภาพของงาน', 20], ['ความรอบรู้และทักษะ', 15], ['เวลาที่ปฏิบัติงาน', 15], ['การสื่อสาร', 15], ['มนุษย์สัมพันธ์', 15], ['ความเป็นผู้นำ', 10]], att: 'การรักษาระเบียบวินัย (สถิติมาทำงาน)', attMax: 100, W: [20, 20, 10, 5, 5, 10, 30] },
  sup: { parts: [['Result Oriented', 25], ['Responsibility', 15], ['Engagement ในหน่วยงาน', 15], ['Engagement ข้ามแผนก', 15], ['แผนพัฒนาตนเอง', 10]], att: 'สถิติการมาทำงานและความประพฤติ', attMax: 24, W: [10, 30, 30, 15, 10, 5] },
  ATTMAX: { late: 15, sick: 15, personal: 15, absent: 15, verbal: 15, written: 25 }
};
function legacyTier_(k, v) {
  v = Number(v) || 0;
  switch (k) {
    case 'late': return v > 60 ? 0 : v >= 41 ? 1 : v >= 21 ? 2 : v >= 1 ? 3 : 4;
    case 'sick': return v == 0 ? 4 : v <= 2 ? 3 : v <= 4 ? 2 : v <= 10 ? 1 : 0;
    case 'personal': return v <= 2 ? 4 : v <= 3 ? 3 : v <= 4 ? 2 : v <= 5 ? 1 : 0;
    case 'absent': return v == 0 ? 4 : v == 1 ? 1 : 0;
    case 'verbal': return v == 0 ? 4 : v <= 2 ? 1 : 0;
    case 'written': return v == 0 ? 4 : 0;
  }
  return 0;
}
var legacyW_ = null;
function legacyParts_(form, att, sc) {
  var L = LEGACY[form]; att = att || {}; sc = sc || {};
  if (!legacyW_) { legacyW_ = {}; try { weights_(); legacyW_ = weights_(); } catch (e) {} }
  var W = (legacyW_[form] && legacyW_[form].length === L.W.length) ? legacyW_[form].map(Number) : L.W;
  var attRaw = Object.keys(LEGACY.ATTMAX).reduce(function (s, k) {
    var v = k === 'verbal' ? (att.verbal != null ? att.verbal : sc.verbal) : k === 'written' ? (att.written != null ? att.written : sc.written) : att[k];
    var t = legacyTier_(k, v); return s + (form === 'new' ? t / 4 * LEGACY.ATTMAX[k] : t);
  }, 0);
  var r2 = function (x) { return Math.round(x * 100) / 100; }, out = [];
  if (form === 'new') {
    L.parts.forEach(function (p, i) { var raw = sc.sc ? sc.sc[i] : null; out.push({ no: i + 1, short: p[0], weight: W[i], w: raw == null ? null : r2(raw / p[1] * W[i]) }); });
    out.push({ no: 7, short: L.att, weight: W[6], w: r2(attRaw / L.attMax * W[6]) });
  } else {
    out.push({ no: 1, short: L.att, weight: W[0], w: r2(attRaw / L.attMax * W[0]) });
    L.parts.forEach(function (p, i) {
      var arr = (sc.sup && sc.sup[i]) || [], raw = arr.reduce(function (s, x) { return s + (Number(x) || 0); }, 0);
      out.push({ no: i + 2, short: p[0], weight: W[i + 1], w: arr.length ? r2(raw / p[1] * W[i + 1]) : null });
    });
  }
  return out.filter(function (p) { return p.w != null; });
}

// ผลประเมินรอบก่อนหน้า (เฉพาะที่อนุมัติเสร็จสิ้นแล้ว)
function previous_(code, activeCycleId) {
  var rows = sb_('get', P + 'evaluations?emp_code=eq.' + q_(code) + '&status=eq.done&cycle_id=neq.' + activeCycleId + '&select=id,form,scores,total,grade,updated_at,cycle_id,eval_cycles:PFormPro_eval_cycles(name,data_from,data_to)&order=cycle_id.desc');
  if (!rows.length) return [];
  var hist = {};
  sb_('get', P + 'eval_history?evaluation_id=in.(' + rows.map(function (r) { return r.id; }).join(',') + ')&step=eq.submit&select=evaluation_id,actor_name')
    .forEach(function (h) { hist[h.evaluation_id] = h.actor_name; });
  return rows.map(function (r) {
    var c = r.eval_cycles || {}, sc = r.scores || {}, parts = [];
    if (sc.imported && sc.imported.parts) {
      parts = sc.imported.parts.filter(function (p) { return p.score != null; }).map(function (p) { return { no: p.no, short: p.title, weight: p.max, w: p.score }; });
    } else if (r.form === 'new' || r.form === 'sup') {
      parts = legacyParts_(r.form, attOf_(r.cycle_id, code), sc);   // แบบฟอร์มเดิม: แสดงตามหัวข้อเดิม
    } else if (sc.sc) {
      var k = calcScore(r.form, attOf_(r.cycle_id, code), sc);
      if (k.complete) parts = k.parts.map(function (p) { return { no: p.no, short: p.short, weight: p.weight, w: Math.round(p.weighted * 100) / 100 }; });
    }
    var G = gradeScale(r.form), g = G.filter(function (x) { return x[0] === r.grade; })[0];
    return { form: r.form, cycle: String(c.name || '').replace('ประเมินผลการปฏิบัติงาน', ''), from: c.data_from, to: c.data_to, total: Number(r.total), grade: r.grade, label: (sc.imported && sc.imported.label) || (g ? g[1] : ''),
      parts: parts, strengths: sc.strengths || [], improve: sc.improve || [], evaluator: hist[r.id] || '', doneAt: r.updated_at };
  });
}

// ไฟล์แนบ + signed URL (อายุ 1 ชั่วโมง)
function files_(u, e) {
  var rows = sb_('get', P + 'attachments?emp_code=eq.' + q_(e.code) + '&order=created_at.desc');
  return rows.map(function (f) {
    var url = '';
    try { var r = storage_('post', 'object/sign/' + BUCKET + '/' + f.storage_path, JSON.stringify({ expiresIn: 3600 })); url = cfg_().url + '/storage/v1' + (r.signedURL || r.signedUrl || ''); } catch (err) {}
    return { id: f.id, name: f.file_name, mime: f.mime || '', size: Number(f.size_bytes || 0), by: f.uploaded_by_name, at: f.created_at, url: url,
      canDel: u.role === 'hr' || u.role === 'admin' || f.uploaded_by === u.emp_code };
  });
}

// ───────── API หลัก (ทุกฟังก์ชันรับ token เป็นพารามิเตอร์แรก) ─────────
function apiBootstrap(token) {
  var u = me_(token), c = cycle_();
  var out = { me: { empCode: u.emp_code, name: u.full_name, role: u.role, scopeType: u.scope_type, scopeValues: u.scope_values }, cycle: c, weights: weights_() };
  if (u.role === 'hr' || u.role === 'admin') out.units = units_();
  out.canAtt = canAtt_(u);
  out.empView = empView_();
  if (u.role === 'hr' || u.role === 'admin') out.empViewBy = PropertiesService.getScriptProperties().getProperty('EMP_VIEW_BY') || '';
  return out;
}

function apiListEmployees(token) {
  var u = me_(token), c = cycle_();
  var evs = {}; sb_('get', P + 'evaluations?cycle_id=eq.' + c.id + '&select=emp_code,status,total,grade').forEach(function (x) { evs[x.emp_code] = x; });
  // รวมพนักงานที่ลาออก (isactive = false) ด้วย ให้หน้าเว็บกรอง ปกติ/ลาออก เอง
  return employees_(true).filter(function (e) { return e.evaluate !== false && inScope_(u, e); }).map(function (e) {
    var ev = evs[e.code], st = ev && SCORING.STATUS[ev.status] ? ev.status : 'none'; // สถานะว่าง/ไม่รู้จัก = ยังไม่ประเมิน
    var hide = u.role === 'emp' && (!empView_() || ['ack', 'hr', 'done'].indexOf(st) < 0);
    return { code: e.code, name: e.name, level: e.level, pos: e.pos, dept: e.dept, div: e.div, form: e.form, fcode: e.fcode, status: st, isactive: e.active !== false,
      total: ev && !hide ? Number(ev.total) : null, grade: ev && !hide ? ev.grade : null, canEdit: canEdit_(u, e, st), canAct: canAct_(u, e, st) };
  });
}

function getEval_(u, code) {
  var c = cycle_(), e = scopedEmp_(u, code);
  var ev = evalOf_(c.id, code), st = ev && SCORING.STATUS[ev.status] ? ev.status : 'none';
  var closed = u.role === 'emp' && !empView_();
  var hidden = u.role === 'emp' && (closed || ['ack', 'hr', 'done'].indexOf(st) < 0);
  var hist = ev ? sb_('get', P + 'eval_history?evaluation_id=eq.' + ev.id + '&order=created_at.asc&select=step,label,actor_name,note,created_at') : [];
  return { emp: publicEmp_(e), att: attOf_(c.id, code), scores: ev && !hidden ? normScores(ev.scores) : blankScores(), status: st, returnNote: ev ? ev.return_note : '',
    history: hist, hidden: hidden, closed: closed, canEdit: canEdit_(u, e, st), canAct: !closed && canAct_(u, e, st), canReturn: canAct_(u, e, st) && (st === 'div' || st === 'exec'),
    prev: closed ? [] : previous_(code, c.id), files: files_(u, e), canUpload: canUpload_(u, e) };
}
function apiGetEvaluation(token, code) { return getEval_(me_(token), code); }

// ───────── รายงานสรุปผล: รายชื่อที่มีผลตามรอบ + หน่วยงาน ─────────
function apiReportList(token, cycleId) {
  var u = me_(token), act = cycle_();
  var cycles = sb_('get', P + 'eval_cycles?select=id,name,year_be,round,data_from,data_to,is_active&order=year_be.desc,round.desc');
  var cid = Number(cycleId) || act.id, isAct = cid === act.id;
  var evs = {}; sb_('get', P + 'evaluations?cycle_id=eq.' + cid + (isAct ? '' : '&status=eq.done') + '&select=emp_code,status,total,grade').forEach(function (x) { evs[x.emp_code] = x; });
  var rows = employees_(true).filter(function (e) { return evs[e.code] && inScope_(u, e); }).map(function (e) {
    var ev = evs[e.code], hide = u.role === 'emp' && ['ack', 'hr', 'done'].indexOf(ev.status) < 0;
    return { code: e.code, name: e.name, pos: e.pos, dept: e.dept, div: e.div, level: e.level, active: e.active !== false, isactive: e.active !== false, status: ev.status, total: hide ? null : Number(ev.total), grade: hide ? '' : ev.grade };
  });
  return { cycleId: cid, activeId: act.id, cycles: cycles.map(function (x) { return { id: x.id, name: x.name, active: x.id === act.id }; }), rows: rows };
}
function apiReportGet(token, cycleId, code) {
  var u = me_(token), act = cycle_(), cid = Number(cycleId) || act.id;
  if (cid === act.id) return { current: getEval_(u, code) };
  var e = employees_(true).filter(function (x) { return x.code === code; })[0];
  if (!e || !inScope_(u, e)) throw new Error('ไม่พบพนักงาน หรือพนักงานอยู่นอกขอบเขตสิทธิ์ของคุณ');
  var cy = sb_('get', P + 'eval_cycles?id=eq.' + cid)[0];
  var ev = sb_('get', P + 'evaluations?cycle_id=eq.' + cid + '&emp_code=eq.' + q_(code) + '&select=form,scores')[0] || {};
  var p = previous_(code, act.id).filter(function (x) { return x.cycle === String(cy.name || '').replace('ประเมินผลการปฏิบัติงาน', ''); })[0];
  if (!p) throw new Error('ไม่พบผลประเมินของรอบนี้');
  var sc = ev.scores || {};
  return { hist: { emp: e, cycle: cy, form: ev.form || e.fcode, prev: p, note: sc.imported ? sc.imported.note : '', source: sc.imported ? sc.imported.source : '' } };
}

function save_(u, c, e, scores, status, extra) {
  var calc = calcScore(e.fcode, attOf_(c.id, e.code), scores);
  var row = { cycle_id: c.id, emp_code: e.code, form: e.fcode, status: status, scores: scores, total: calc.total, grade: calc.grade, updated_by: u.emp_code, updated_at: now_() };
  if (extra) for (var k in extra) row[k] = extra[k];
  return sb_('post', P + 'evaluations?on_conflict=cycle_id,emp_code', row, 'resolution=merge-duplicates,return=representation')[0];
}

function apiSaveDraft(token, code, scores) {
  var u = me_(token), c = cycle_(), e = scopedEmp_(u, code), ev = evalOf_(c.id, code), st = ev && SCORING.STATUS[ev.status] ? ev.status : 'none';
  if (!canEdit_(u, e, st)) throw new Error('แบบประเมินนี้แก้ไขไม่ได้ในสถานะปัจจุบัน');
  save_(u, c, e, scores, st === 'returned' ? 'returned' : 'draft');
  return getEval_(u, code);
}

function apiSubmit(token, code, scores) {
  var u = me_(token), c = cycle_(), e = scopedEmp_(u, code), ev = evalOf_(c.id, code), st = ev && SCORING.STATUS[ev.status] ? ev.status : 'none';
  if (!canEdit_(u, e, st)) throw new Error('แบบประเมินนี้ส่งไม่ได้ในสถานะปัจจุบัน');
  var check = calcScore(e.fcode, attOf_(c.id, code), scores);
  if (!check.complete) throw new Error('ยังให้คะแนนไม่ครบ: ' + check.missing.join(', '));
  var row = save_(u, c, e, scores, (u.role === 'div' || e.skipDiv) ? 'exec' : 'div', { return_note: '' });
  addHistory_(row.id, 'submit', 'ผู้ประเมินส่งแบบประเมิน', u, '');
  return getEval_(u, code);
}

function apiApprove(token, code) {
  var u = me_(token), c = cycle_(), e = scopedEmp_(u, code), ev = evalOf_(c.id, code);
  if (u.role === 'emp' && !empView_()) throw new Error('ฝ่ายบุคคลยังไม่เปิดให้ดูผลประเมิน');
  if (!ev || !canAct_(u, e, ev.status)) throw new Error('คุณไม่มีสิทธิ์อนุมัติแบบประเมินนี้ในขั้นตอนปัจจุบัน');
  var label = SCORING.STEPS.filter(function (s) { return s[0] === ev.status; })[0][1];
  sb_('patch', P + 'evaluations?id=eq.' + ev.id, { status: SCORING.NEXT[ev.status], updated_by: u.emp_code, updated_at: now_() });
  addHistory_(ev.id, ev.status, label, u, '');
  return getEval_(u, code);
}

function apiReturn(token, code, note) {
  var u = me_(token), c = cycle_(), e = scopedEmp_(u, code), ev = evalOf_(c.id, code);
  if (!ev || !canAct_(u, e, ev.status) || ['div', 'exec'].indexOf(ev.status) < 0) throw new Error('ส่งกลับไม่ได้ในขั้นตอนนี้');
  note = String(note || '').trim() || 'กรุณาตรวจสอบคะแนนอีกครั้ง';
  sb_('patch', P + 'evaluations?id=eq.' + ev.id, { status: 'returned', return_note: note, updated_by: u.emp_code, updated_at: now_() });
  addHistory_(ev.id, 'return', 'ส่งกลับแก้ไข', u, note);
  return getEval_(u, code);
}

// ───────── เอกสารแนบ ─────────
// file = { name, mime, size, base64 }
function apiUploadFile(token, code, file) {
  var u = me_(token), e = scopedEmp_(u, code);
  if (!canUpload_(u, e)) throw new Error('คุณไม่มีสิทธิ์แนบไฟล์ให้พนักงานคนนี้');
  var bytes = Utilities.base64Decode(String(file.base64 || ''));
  if (!bytes.length) throw new Error('ไฟล์ว่างเปล่า');
  if (bytes.length > MAX_FILE) throw new Error('ไฟล์ ' + file.name + ' มีขนาดเกิน 10 MB');
  var mime = String(file.mime || 'application/octet-stream');
  if (!/^(image\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats|application\/vnd\.ms-excel|text\/csv)/.test(mime)) throw new Error('รองรับเฉพาะรูปภาพ PDF Word และ Excel');
  var ext = (String(file.name).match(/\.([a-z0-9]{1,5})$/i) || [, 'bin'])[1].toLowerCase();
  var path = q_(code) + '/' + Utilities.getUuid() + '.' + ext;
  storage_('post', 'object/' + BUCKET + '/' + path, Utilities.newBlob(bytes, mime), mime);
  sb_('post', P + 'attachments', { emp_code: code, file_name: String(file.name).slice(0, 200), mime: mime, size_bytes: bytes.length, storage_path: path, uploaded_by: u.emp_code, uploaded_by_name: u.full_name });
  return files_(u, e);
}
function apiDeleteFile(token, code, id) {
  var u = me_(token), e = scopedEmp_(u, code);
  var f = sb_('get', P + 'attachments?id=eq.' + Number(id) + '&emp_code=eq.' + q_(code))[0];
  if (!f) throw new Error('ไม่พบไฟล์');
  if (!(u.role === 'hr' || u.role === 'admin' || f.uploaded_by === u.emp_code)) throw new Error('ลบได้เฉพาะผู้อัปโหลดหรือฝ่ายบุคคล');
  try { storage_('delete', 'object/' + BUCKET + '/' + f.storage_path); } catch (err) {}
  sb_('delete', P + 'attachments?id=eq.' + Number(id));
  return files_(u, e);
}

// ───────── HR: น้ำหนักคะแนน ─────────
function apiSaveWeights(token, form, arr) {
  var u = me_(token); requireRole_(u, ['hr']);
  if (['new', 'sup'].indexOf(form) < 0) throw new Error('แบบฟอร์มไม่ถูกต้อง');
  arr = arr.map(Number);
  var sum = arr.reduce(function (a, b) { return a + b; }, 0);
  if (Math.abs(sum - 100) > 0.001) throw new Error('น้ำหนักรวมต้องเท่ากับ 100% (ปัจจุบัน ' + sum + '%)');
  sb_('post', P + 'weight_sets?on_conflict=form', { form: form, weights: arr, updated_at: now_() }, 'resolution=merge-duplicates');
  var c = cycle_(), atts = {};
  sb_('get', P + 'attendance?cycle_id=eq.' + c.id).forEach(function (a) { atts[a.emp_code] = attRow_(a); });
  var rows = sb_('get', P + 'evaluations?cycle_id=eq.' + c.id + '&form=eq.' + form + '&select=cycle_id,emp_code,form,status,scores');
  if (rows.length) {
    rows.forEach(function (r) { var k = calcScore(r.form, atts[r.emp_code], r.scores); r.total = k.total; r.grade = k.grade; });
    sb_('post', P + 'evaluations?on_conflict=cycle_id,emp_code', rows, 'resolution=merge-duplicates');
  }
  return weights_();
}

// ───────── สถิติมาทำงาน (มาสาย ลาป่วย ลากิจ ขาดงาน หนังสือเตือน) ─────────
// สิทธิ์: Admin, HR Admin (บทบาท hr), หัวหน้าแผนก HR (บทบาท eval) และหัวหน้าฝ่าย HR (บทบาท div)
// หน่วยงาน HR = Script Property HR_UNITS (ชื่อแผนก/ฝ่าย คั่นด้วย ,) ถ้าไม่ตั้ง ใช้ชื่อที่มีคำว่า "บุคคล" หรือ "HR"
function isHrUnit_(name) {
  name = String(name || ''); if (!name) return false;
  var p = PropertiesService.getScriptProperties().getProperty('HR_UNITS');
  if (p) return p.split(',').map(function (x) { return x.trim(); }).indexOf(name) >= 0;
  return /บุคคล|HR|Human/i.test(name);
}
function canAtt_(u) {
  if (u.role === 'admin' || u.role === 'hr') return true;
  if (['eval', 'div'].indexOf(u.role) < 0) return false;
  var e = employees_(true).filter(function (x) { return x.code === u.emp_code; })[0] || {};
  return isHrUnit_(u.role === 'div' ? e.div : e.dept) || (u.scope_values || []).some(isHrUnit_);
}
function requireAtt_(u) { if (!canAtt_(u)) throw new Error('เฉพาะ HR Admin, หัวหน้าแผนก HR, หัวหน้าฝ่าย HR และผู้ดูแลระบบเท่านั้น'); }

function apiAttList(token) {
  var u = me_(token); requireAtt_(u);
  var c = cycle_(), atts = {}, evs = {};
  sb_('get', P + 'attendance?cycle_id=eq.' + c.id).forEach(function (a) { atts[a.emp_code] = a; });
  sb_('get', P + 'evaluations?cycle_id=eq.' + c.id + '&select=emp_code,status').forEach(function (x) { evs[x.emp_code] = x.status; });
  var rows = employees_(true).filter(function (e) { return e.evaluate !== false && e.code !== 'admin'; }).map(function (e) {
    var a = atts[e.code];
    return { code: e.code, name: e.name, pos: e.pos, dept: e.dept, div: e.div, form: e.form, fcode: e.fcode, level: e.level, isactive: e.active !== false, status: evs[e.code] || 'none',
      has: !!a, att: Object.assign({ verbal: 0, written: 0 }, attRow_(a)), by: a && a.updated_by || '', at: a && a.updated_at || '' };
  });
  return { cycle: c, rows: rows };
}
// rows = [{ code, late, sick, personal, absent, verbal, written }]
function apiAttSave(token, rows) {
  var u = me_(token); requireAtt_(u);
  var c = cycle_(), K = ['late', 'sick', 'personal', 'absent', 'verbal', 'written'];
  if (!rows || !rows.length) throw new Error('ไม่มีข้อมูลที่เปลี่ยนแปลง');
  var valid = {}; employees_(true).forEach(function (e) { valid[e.code] = e; });
  var out = rows.map(function (r) {
    var code = String(r.code || '').trim(); if (!valid[code]) throw new Error('ไม่พบรหัสพนักงาน ' + code);
    K.forEach(function (k) { var v = Number(r[k]); if (!(v >= 0) || v > 100000) throw new Error('ค่า ' + k + ' ของ ' + code + ' ไม่ถูกต้อง'); r[k] = v; });
    return { cycle_id: c.id, emp_code: code, late_min: r.late, sick_days: r.sick, personal_days: r.personal, absent_days: r.absent, verbal_count: r.verbal, written_count: r.written, updated_by: u.full_name, updated_at: now_() };
  });
  sb_('post', P + 'attendance?on_conflict=cycle_id,emp_code', out, 'resolution=merge-duplicates');
  // คำนวณคะแนนรวม/เกรดของแบบประเมินที่ยังไม่ปิด (ไม่ใช่ done) ใหม่
  var list = out.map(function (o) { return '"' + o.emp_code.replace(/"/g, '') + '"'; }).join(',');
  var evs = sb_('get', P + 'evaluations?cycle_id=eq.' + c.id + '&status=neq.done&emp_code=in.(' + encodeURIComponent(list) + ')&select=cycle_id,emp_code,form,status,scores');
  if (evs.length) {
    var m = {}; out.forEach(function (o) { m[o.emp_code] = attRow_(o); });
    evs.forEach(function (r) { var k = calcScore(valid[r.emp_code] ? valid[r.emp_code].fcode : r.form, m[r.emp_code], r.scores); r.form = valid[r.emp_code] ? valid[r.emp_code].fcode : r.form; r.total = k.total; r.grade = k.grade; });
    sb_('post', P + 'evaluations?on_conflict=cycle_id,emp_code', evs, 'resolution=merge-duplicates');
  }
  return apiAttList(token);
}

// ───────── HR Admin / Admin: รอบการประเมิน ─────────
function cycleName_(y, r) { return 'ประเมินผลการปฏิบัติงานประจำปี ' + y + ' ครั้งที่ ' + r; }
function apiCycleList(token) {
  var u = me_(token); requireRole_(u, ['hr']);
  var cnt = {};
  sb_('get', P + 'evaluations?select=cycle_id,status').forEach(function (x) { var k = cnt[x.cycle_id] = cnt[x.cycle_id] || { evals: 0, done: 0, att: 0 }; k.evals++; if (x.status === 'done') k.done++; });
  sb_('get', P + 'attendance?select=cycle_id').forEach(function (x) { var k = cnt[x.cycle_id] = cnt[x.cycle_id] || { evals: 0, done: 0, att: 0 }; k.att++; });
  return sb_('get', P + 'eval_cycles?select=*&order=year_be.desc,round.desc').map(function (x) {
    var k = cnt[x.id] || { evals: 0, done: 0, att: 0 };
    return { id: x.id, name: x.name, year: x.year_be, round: x.round, from: x.data_from, to: x.data_to, active: !!x.is_active, evals: k.evals, done: k.done, att: k.att };
  }).map(function (x, i, L) { x.dup = L.filter(function (y) { return y.year === x.year && y.round === x.round; }).length > 1; return x; });
}
// d = { id?, year(พ.ศ.), round, from, to, name? }
function apiCycleSave(token, d) {
  var u = me_(token); requireRole_(u, ['hr']);
  var y = Number(d.year), r = Number(d.round);
  if (!(y >= 2500 && y <= 2700)) throw new Error('ปี พ.ศ. ไม่ถูกต้อง');
  if (!(r >= 1 && r <= 12)) throw new Error('ครั้งที่ไม่ถูกต้อง');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(d.to || '')) throw new Error('กรุณาระบุช่วงวันที่ของข้อมูลให้ครบ ในรูปแบบ dd/MM/yyyy');
  if (d.from > d.to) throw new Error('วันเริ่มต้นต้องไม่เกินวันสิ้นสุด');
  var dup = sb_('get', P + 'eval_cycles?year_be=eq.' + y + '&round=eq.' + r + '&select=id').filter(function (x) { return x.id !== Number(d.id); });
  if (dup.length) throw new Error('มีรอบปี ' + y + ' ครั้งที่ ' + r + ' อยู่แล้ว');
  var row = { name: String(d.name || '').trim() || cycleName_(y, r), year_be: y, round: r, data_from: d.from, data_to: d.to };
  if (d.id) sb_('patch', P + 'eval_cycles?id=eq.' + Number(d.id), row);
  else { row.is_active = false; sb_('post', P + 'eval_cycles', row); }
  return apiCycleList(token);
}
// เปิดใช้เป็นรอบปัจจุบัน (เปิดได้ทีละ 1 รอบ)
function apiCycleActivate(token, id) {
  var u = me_(token); requireRole_(u, ['hr']);
  id = Number(id); if (!sb_('get', P + 'eval_cycles?id=eq.' + id + '&select=id').length) throw new Error('ไม่พบรอบการประเมิน');
  sb_('patch', P + 'eval_cycles?is_active=is.true&id=neq.' + id, { is_active: false });
  sb_('patch', P + 'eval_cycles?id=eq.' + id, { is_active: true });
  return apiCycleList(token);
}
function apiCycleDelete(token, id) {
  var u = me_(token); requireRole_(u, ['hr']);
  id = Number(id); var cy = sb_('get', P + 'eval_cycles?id=eq.' + id)[0]; if (!cy) throw new Error('ไม่พบรอบการประเมิน');
  if (sb_('get', P + 'evaluations?cycle_id=eq.' + id + '&select=id&limit=1').length) throw new Error('รอบนี้มีแบบประเมินแล้ว ลบไม่ได้');
  var all = sb_('get', P + 'eval_cycles?select=id,is_active&order=year_be.desc,round.desc');
  if (all.length < 2) throw new Error('ต้องมีรอบการประเมินอย่างน้อย 1 รอบ');
  sb_('delete', P + 'attendance?cycle_id=eq.' + id);
  sb_('delete', P + 'eval_cycles?id=eq.' + id);
  // ลบรอบที่เปิดอยู่: ถ้าไม่เหลือรอบที่เปิด ให้เปิดรอบล่าสุดแทน
  var rest = all.filter(function (x) { return x.id !== id; });
  if (!rest.some(function (x) { return x.is_active; })) sb_('patch', P + 'eval_cycles?id=eq.' + rest[0].id, { is_active: true });
  return apiCycleList(token);
}

// ───────── HR: นำเข้าพนักงานจากไฟล์ (template CSV) ─────────
// rows = [{ code, name, pos, level, dept, div, start, nid4, dob, phone, site, type, form, status, evaluate, remark }] ค่าว่าง = คงค่าเดิม
function apiImportEmployees(token, rows, dryRun) {
  var u = me_(token); requireRole_(u, ['hr']);
  if (!rows || !rows.length) throw new Error('ไม่มีข้อมูลในไฟล์');
  if (rows.length > 3000) throw new Error('นำเข้าได้ครั้งละไม่เกิน 3,000 แถว');
  var deps = {}, divs = {};
  sb_('get', P + 'divisions?select=id,name').forEach(function (d) { divs[d.name] = d.id; });
  sb_('get', P + 'departments?select=id,name').forEach(function (d) { deps[d.name] = d.id; });
  var old = {}; selectSafe_(P + 'employees?select=emp_code,full_name,position,grade,department_id,start_date,work_site,employment_type,active,evaluate,national_id_last4,birth_date,phone_last4,phone,remark,emp_status,eval_form').forEach(function (e) { old[e.emp_code] = e; });
  var iso = /^\d{4}-\d{2}-\d{2}$/, seen = {}, out = [], errs = [], newDeps = {}, add = 0, upd = 0;
  rows.forEach(function (r, i) {
    var line = 'แถว ' + (r._line || i + 2), code = String(r.code || '').trim(), e = old[code], err = [];
    if (!code) return errs.push(line + ': ไม่มีรหัสพนักงาน');
    if (code === 'admin') return errs.push(line + ': ห้ามใช้รหัส admin');
    if (seen[code]) return errs.push(line + ': รหัส ' + code + ' ซ้ำในไฟล์'); seen[code] = 1;
    var t = function (k) { return String(r[k] == null ? '' : r[k]).trim(); };
    var o = e ? JSON.parse(JSON.stringify(e)) : { emp_code: code, active: true, evaluate: true, emp_status: 'working' };
    if (t('name')) o.full_name = t('name'); else if (!e) err.push('ไม่มีชื่อ');
    if (t('pos')) o.position = t('pos'); else if (!e) o.position = '-';
    if (t('level')) { var lv = Number(t('level')); if (!(lv >= 1 && lv <= 5) || lv % 1) err.push('เกรดต้องเป็น 1–5'); else o.grade = lv; } else if (!e) err.push('ไม่มีเกรด');
    if (t('dept')) {
      if (deps[t('dept')]) o.department_id = deps[t('dept')];
      else if (t('div')) { newDeps[t('dept')] = t('div'); o._dept = t('dept'); }
      else err.push('ไม่พบแผนก "' + t('dept') + '" (ใส่ฝ่ายเพื่อสร้างแผนกใหม่)');
    } else if (!e) err.push('ไม่มีแผนก');
    if (t('start')) { if (!iso.test(t('start'))) err.push('วันที่เริ่มงานไม่ถูกต้อง'); else o.start_date = t('start'); }
    if (t('dob')) { if (!iso.test(t('dob'))) err.push('วันเกิดไม่ถูกต้อง'); else o.birth_date = t('dob'); }
    if (t('nid4')) { var n = t('nid4').replace(/\D/g, ''); if (n.length !== 4 && n.length !== 13) err.push('เลขบัตรต้องเป็น 4 หรือ 13 หลัก'); else o.national_id_last4 = n.slice(-4); }
    if (t('phone')) { var ph = t('phone').replace(/\D/g, ''); if (ph.length < 9) err.push('เบอร์โทรไม่ครบ'); else { o.phone = ph; o.phone_last4 = ph.slice(-4); } }
    if (t('site')) o.work_site = t('site');
    if (t('type')) o.employment_type = t('type');
    if (t('form')) { if (!SCORING.FORMS[t('form')]) err.push('รหัสแบบฟอร์ม "' + t('form') + '" ไม่ถูกต้อง'); else o.eval_form = t('form'); }
    if (t('remark')) o.remark = t('remark');
    var st = t('status'), resign = st === 'ลาออก' || /^(false|0|n|no|resigned|inactive)$/i.test(st) || /#ลาออก/.test(t('remark'));
    if (st && !resign && !/^(ปกติ|ทำงาน|true|1|y|yes|working|active)$/i.test(st)) err.push('สถานะต้องเป็น ปกติ หรือ ลาออก');
    if (resign) { o.active = false; o.evaluate = false; o.emp_status = 'resigned'; }
    else if (st) { o.active = true; if (o.emp_status === 'resigned') o.emp_status = 'working'; }
    if (t('evaluate') && !resign) o.evaluate = !/^(n|no|false|0|ไม่)$/i.test(t('evaluate'));
    if (err.length) return errs.push(line + ' (' + code + '): ' + err.join(', '));
    e ? upd++ : add++; out.push(o);
  });
  var summary = { total: rows.length, add: add, upd: upd, newDeps: Object.keys(newDeps).map(function (k) { return k + ' (' + newDeps[k] + ')'; }), errors: errs };
  if (dryRun || errs.length) return summary;
  Object.keys(newDeps).forEach(function (dn) {
    var dv = newDeps[dn];
    if (!divs[dv]) divs[dv] = sb_('post', P + 'divisions', { name: dv }, 'return=representation')[0].id;
    deps[dn] = sb_('post', P + 'departments', { name: dn, division_id: divs[dv] }, 'return=representation')[0].id;
  });
  var KEYS = ['emp_code','full_name','position','grade','department_id','start_date','work_site','employment_type','active','evaluate','national_id_last4','birth_date','phone_last4','phone','remark','emp_status','eval_form'];
  var rowsOut = out.map(function (o) { if (o._dept) o.department_id = deps[o._dept]; var x = {}; KEYS.forEach(function (k) { x[k] = o[k] === undefined ? null : o[k]; }); if (x.active == null) x.active = true; if (x.evaluate == null) x.evaluate = true; return x; });
  for (var i = 0; i < rowsOut.length; i += 200) {
    var chunk = rowsOut.slice(i, i + 200);
    for (var tries = 0; tries < OPTIONAL_COLS.length + 1; tries++) {
      try { sb_('post', P + 'employees?on_conflict=emp_code', chunk, 'resolution=merge-duplicates'); break; }
      catch (e) {
        var mm = /column [^ ]*?\.?([a-z_]+) does not exist|'([a-z_]+)' column/.exec(String(e.message || e)), col = mm && (mm[1] || mm[2]);
        if (!col || OPTIONAL_COLS.indexOf(col) < 0) throw e;
        chunk = chunk.map(function (x) { delete x[col]; return x; });
      }
    }
  }
  summary.done = true;
  return summary;
}

// ───────── HR: จัดการพนักงาน บทบาท และหน่วยงาน ─────────
function apiAdminData(token) {
  var u = me_(token); requireRole_(u, ['hr']);
  var users = {}; sb_('get', P + 'app_users?select=emp_code,role,scope_type,scope_values,password_hash').forEach(function (x) { users[x.emp_code] = x; });
  var locks = {}; sb_('get', P + 'login_attempts?locked=is.true&select=emp_code').forEach(function (a) { locks[a.emp_code] = true; });
  var emps = employees_(true).map(function (e) {
    var x = users[e.code];
    e.role = x ? x.role : 'emp'; e.scopeType = x ? x.scope_type : 'self'; e.scopeValues = x ? (x.scope_values || []) : [];
    e.hasPwd = !!(x && x.password_hash); e.locked = !!locks[e.code];
    if (e.dob) { var p = e.dob.split('-'); e.dobTh = p[2] + '/' + p[1] + '/' + (Number(p[0]) + 543); } else e.dobTh = '';
    return e;
  });
  return { emps: emps, units: units_() };
}

// d = { isNew, code, name, pos, level, dept, start(YYYY-MM-DD), active, evaluate, nid4, dobTh(วว/ดด/ปปปป พ.ศ.), phone4, role, scopeType, scopeValues[], password }
function apiSaveEmployee(token, d) {
  var u = me_(token); requireRole_(u, ['hr']);
  var code = String(d.code || '').trim(), name = String(d.name || '').trim();
  if (!code) throw new Error('กรุณากรอกรหัสพนักงาน');
  if (!name) throw new Error('กรุณากรอกชื่อ-นามสกุล');
  var exists = sb_('get', P + 'employees?emp_code=eq.' + q_(code) + '&select=emp_code')[0];
  if (d.isNew && exists) throw new Error('รหัสพนักงาน ' + code + ' มีอยู่ในระบบแล้ว');
  var dep = sb_('get', P + 'departments?name=eq.' + q_(d.dept) + '&select=id')[0];
  var sys = d.role === 'admin'; // บัญชีผู้ดูแลระบบ ไม่ต้องมีแผนก/ข้อมูลยืนยันตัวตน
  if (!dep && !sys) throw new Error('กรุณาเลือกแผนก');
  if (!sys && !/^\d{4}$/.test(d.nid4 || '')) throw new Error('4 ตัวท้ายบัตรประชาชนต้องเป็นตัวเลข 4 หลัก');
  var phone = String(d.phone || '').replace(/\D/g, '');
  if (phone.length >= 9) d.phone4 = phone.slice(-4);
  if (!sys && !/^\d{4}$/.test(d.phone4 || '')) throw new Error('4 ตัวท้ายเบอร์โทรต้องเป็นตัวเลข 4 หลัก');
  var m = String(d.dobTh || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m && !sys) throw new Error('วันเกิดต้องอยู่ในรูปแบบ วว/ดด/ปปปป (พ.ศ.)');
  var level = Number(d.level);
  if (!(level >= 1 && level <= 5)) throw new Error('ระดับพนักงานต้องอยู่ระหว่าง 1–5');
  if (d.start && !/^\d{4}-\d{2}-\d{2}$/.test(d.start)) throw new Error('วันที่เริ่มงานต้องเป็นรูปแบบ dd/MM/yyyy');
  var empRow = {
    emp_code: code, full_name: name, position: String(d.pos || '').trim() || '-', grade: level, eval_form: SCORING.FORMS[d.evalForm] ? d.evalForm : null, department_id: dep ? dep.id : null, start_date: d.start || null,
    active: (d.isactive != null ? d.isactive : d.active) !== false, evaluate: (d.isactive != null ? d.isactive : d.active) === false ? false : d.evaluate !== false, // ลาออก = ไม่รับประเมินเสมอ
    emp_status: (d.isactive != null ? d.isactive : d.active) === false ? 'resigned' : (d.status === 'check' ? 'check' : 'working'), national_id_last4: d.nid4 || null, phone_last4: d.phone4 || null, phone: phone || null, remark: String(d.remark || '').trim() || null,
    birth_date: m ? (Number(m[3]) - 543) + '-' + m[2] + '-' + m[1] : null
  };
  try { sb_('post', P + 'employees?on_conflict=emp_code', empRow, 'resolution=merge-duplicates'); }
  catch (e) {
    var miss = OPTIONAL_COLS.filter(function (k) { return String(e.message || e).indexOf(k) >= 0; });
    if (!miss.length) throw e;
    if (miss.indexOf('eval_form') >= 0 && empRow.eval_form) throw new Error('ยังไม่ได้รันไฟล์ form_rev101169.sql ใน Supabase จึงกำหนดแบบฟอร์มรายคนไม่ได้');
    miss.forEach(function (k) { delete empRow[k]; });
    sb_('post', P + 'employees?on_conflict=emp_code', empRow, 'resolution=merge-duplicates');
  }

  if (d.role === 'emp') {
    if (code === u.emp_code) throw new Error('ไม่สามารถเปลี่ยนบทบาทของบัญชีที่กำลังใช้งานอยู่');
    sb_('delete', P + 'app_users?emp_code=eq.' + q_(code));
  } else {
    if (['eval', 'div', 'exec', 'hr', 'admin'].indexOf(d.role) < 0) throw new Error('บทบาทไม่ถูกต้อง');
    if (['dept', 'div', 'all'].indexOf(d.scopeType) < 0) throw new Error('ขอบเขตไม่ถูกต้อง');
    var sv = d.scopeType === 'all' ? [] : (d.scopeValues || []).map(String);
    if (d.scopeType !== 'all' && !sv.length) throw new Error('กรุณาเลือกหน่วยงานที่ดูแลอย่างน้อย 1 หน่วยงาน');
    var cur = sb_('get', P + 'app_users?emp_code=eq.' + q_(code))[0];
    var row = { emp_code: code, full_name: name, role: d.role, scope_type: d.scopeType, scope_values: sv, active: true };
    if (d.password) {
      if (String(d.password).length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      row.password_salt = newSalt_(); row.password_hash = hash_(String(d.password), row.password_salt);
    } else if (!cur || !cur.password_hash) throw new Error('กรุณาตั้งรหัสผ่านสำหรับเข้าสู่ระบบ');
    sb_('post', P + 'app_users?on_conflict=emp_code', row, 'resolution=merge-duplicates');
  }
  return apiAdminData(token);
}

function apiUnlock(token, code) {
  var u = me_(token); requireRole_(u, ['hr']);
  clearFails_(String(code));
  return apiAdminData(token);
}

function apiAddDivision(token, name) {
  var u = me_(token); requireRole_(u, ['hr']);
  name = String(name || '').trim(); if (!name) throw new Error('กรุณากรอกชื่อฝ่าย');
  if (sb_('get', P + 'divisions?name=eq.' + q_(name)).length) throw new Error('มี' + name + 'อยู่แล้ว');
  sb_('post', P + 'divisions', { name: name });
  return apiAdminData(token);
}
function apiDeleteDivision(token, name) {
  var u = me_(token); requireRole_(u, ['hr']);
  var d = sb_('get', P + 'divisions?name=eq.' + q_(name) + '&select=id')[0]; if (!d) throw new Error('ไม่พบฝ่าย');
  if (sb_('get', P + 'departments?division_id=eq.' + d.id + '&select=id').length) throw new Error('ต้องลบหรือย้ายแผนกในฝ่ายนี้ก่อน');
  sb_('delete', P + 'divisions?id=eq.' + d.id);
  return apiAdminData(token);
}
function apiAddDepartment(token, division, name) {
  var u = me_(token); requireRole_(u, ['hr']);
  name = String(name || '').trim(); if (!name) throw new Error('กรุณากรอกชื่อแผนก');
  var d = sb_('get', P + 'divisions?name=eq.' + q_(division) + '&select=id')[0]; if (!d) throw new Error('ไม่พบฝ่าย');
  if (sb_('get', P + 'departments?name=eq.' + q_(name)).length) throw new Error('มีแผนก ' + name + ' อยู่แล้ว');
  sb_('post', P + 'departments', { name: name, division_id: d.id });
  return apiAdminData(token);
}
function apiMoveDepartment(token, name, division) {
  var u = me_(token); requireRole_(u, ['hr']);
  var d = sb_('get', P + 'departments?name=eq.' + q_(name) + '&select=id')[0]; if (!d) throw new Error('ไม่พบแผนก');
  var v = sb_('get', P + 'divisions?name=eq.' + q_(division) + '&select=id')[0]; if (!v) throw new Error('ไม่พบฝ่าย');
  sb_('patch', P + 'departments?id=eq.' + d.id, { division_id: v.id });
  return apiAdminData(token);
}
function apiDeleteDepartment(token, name) {
  var u = me_(token); requireRole_(u, ['hr']);
  var d = sb_('get', P + 'departments?name=eq.' + q_(name) + '&select=id')[0]; if (!d) throw new Error('ไม่พบแผนก');
  if (sb_('get', P + 'employees?department_id=eq.' + d.id + '&select=emp_code&limit=1').length) throw new Error('ยังมีพนักงานในแผนกนี้ ย้ายพนักงานออกก่อน');
  sb_('delete', P + 'departments?id=eq.' + d.id);
  return apiAdminData(token);
}

// ───────── รันครั้งเดียวจาก Editor: ตั้งรหัสผ่านเริ่มต้นให้บัญชีที่ยังไม่มีรหัสผ่าน ─────────
// รันครั้งเดียวจาก Editor (ทางเลือก ถ้าไม่ได้รัน admin_account.sql): สร้าง/รีเซ็ตบัญชี admin / pass@2022
function setupAdmin() {
  sb_('post', P + 'employees?on_conflict=emp_code', { emp_code: 'admin', full_name: 'ผู้ดูแลระบบ', position: 'ผู้ดูแลระบบ (Administrator)', grade: 5, active: true, evaluate: false }, 'resolution=merge-duplicates');
  var salt = newSalt_();
  sb_('post', P + 'app_users?on_conflict=emp_code', { emp_code: 'admin', full_name: 'ผู้ดูแลระบบ', role: 'admin', scope_type: 'all', scope_values: [], active: true, password_salt: salt, password_hash: hash_('pass@2022', salt) }, 'resolution=merge-duplicates');
  clearFails_('admin');
  Logger.log('บัญชี admin พร้อมใช้งาน: รหัส admin / รหัสผ่าน pass@2022 (กรุณาเปลี่ยนรหัสผ่านหลังเข้าใช้งาน)');
}

function setupDemoPasswords() {
  var DEFAULT = 'pp123456';
  sb_('get', P + 'app_users?password_hash=is.null&select=emp_code').forEach(function (x) {
    var salt = newSalt_();
    sb_('patch', P + 'app_users?emp_code=eq.' + q_(x.emp_code), { password_salt: salt, password_hash: hash_(DEFAULT, salt) });
  });
  Logger.log('ตั้งรหัสผ่านเริ่มต้นเป็น ' + DEFAULT + ' แล้ว กรุณาเปลี่ยนรหัสผ่านทุกบัญชีที่เมนูจัดการพนักงาน');
}
