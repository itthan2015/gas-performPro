# เกณฑ์เกรด 4 ระดับ + โควต้า Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เกรด 1–3 ใช้สเกล A/B/C/D ตาม `grade_cfg` ของรอบ พร้อมโควต้าต่อกลุ่มผู้ประเมิน (ห้ามส่งเมื่อเกิน) และหน้าจัดการสำหรับ HR/admin

**Architecture:** ตรรกะล้วน (ตัดเกรด, เพดานโควต้า, ตรวจ cfg) อยู่ใน `Scoring.gs` และสำเนาใน `ScoringClient.html` ทดสอบด้วย node · Code.gs อ่าน `grade_cfg` จากรอบแล้วส่งต่อ · หน้าเว็บเพิ่มหน้า `grades` และแถบโควต้าในหน้ารายชื่อ

**Tech Stack:** Google Apps Script V8, Supabase PostgREST, vanilla JS SPA, node (ทดสอบเท่านั้น ไม่มี npm)

**Spec:** `docs/superpowers/specs/2026-11-13-grade-quota-design.md`

## Global Constraints
- Scoring.gs กับ ScoringClient.html ต้องตรงกันทุกบรรทัด (ยกเว้น `<script>` wrapper)
- ค่าเริ่มต้น: A ≥ 85 ดีเยี่ยม · B ≥ 75 ดี · C ≥ 70 พอใช้ · D ≥ 0 ต้องปรับปรุง · โควต้า A 20 · B 50 · C 30 · D ไม่จำกัด
- เพดาน = `Math.floor(n * pct / 100 + 0.5)` · โควต้าแยกกันเด็ดขาด
- `grade_cfg = null` → สเกล `GR_NEW` เดิม ไม่มีโควต้า · ฟอร์ม 4–5 ใช้ `GR_SUP` เสมอ
- นับ "ใช้ไป" เฉพาะสถานะ div, exec, ack, hr, done
- ห้ามใส่ `// comment` ต่อท้ายโค้ดใน template string ของ App.html
- ข้อความผู้ใช้เป็นภาษาไทย · วันที่ผ่าน `fmtD()`

## Review Focus
1. รอบที่มี cfg แต่มีผลนำเข้าเกรดเก่า (A+, B+) → ต้องแสดงชื่อระดับจาก `GR_NEW` ไม่ว่าง ไม่ error — ทดสอบ `gradeInfo` ใน Task 1
2. คะแนนขอบ 84.99 / 85 / 74.99 / 69.99 → B / A / C / D — Task 1
3. ผู้ประเมินส่งซ้ำคนเดิมหลังถูกส่งกลับ ต้องไม่นับตัวเองซ้ำ — `quotaUse_` ตัดคนที่กำลังส่ง, Task 2
4. กลุ่ม 1–2 คน: เพดาน A = 0 → ส่งคนที่ได้ ≥ 85 ไม่ได้ ข้อความต้องบอกเหตุชัดเจน — Task 1 + 2
5. HR บันทึก cfg ไม่ถูกต้อง (A ≤ B, ค่าติดลบ, % > 100) → ปฏิเสธพร้อมข้อความ ไม่บันทึก — `normGradeCfg`, Task 1

---

### Task 0: กฎธุรกิจใน PROCESS.md
**Files:** Modify `docs/PROCESS.md` (หัวข้อ "การคิดคะแนน")
- [ ] แทนบรรทัดเกณฑ์เกรด 1–3 ด้วยกติกา 4 ระดับ + โควต้า (กลุ่ม, ปัดเศษ, แยกเด็ดขาด, ห้ามส่ง, returned คืนโควต้า, คำนวณใหม่ภายหลังเตือนเท่านั้น, รอบเก่า cfg null ใช้สเกลเดิม)
- [ ] Commit `docs: grade quota business rules`

### Task 1: ตรรกะเกรด/โควต้าใน Scoring
**Files:** Modify `src/Scoring.gs`, `src/ScoringClient.html` (สำเนา) · Create `tests/scoring.test.js`

**Interfaces (Produces):**
- `SCORING.DEFAULT_GRADE_CFG` = `{ levels:[{g:'A',min:85,label:'ดีเยี่ยม'},{g:'B',min:75,label:'ดี'},{g:'C',min:70,label:'พอใช้'},{g:'D',min:0,label:'ต้องปรับปรุง'}], quota:{A:20,B:50,C:30} }`
- `normGradeCfg(cfg) -> cfg | null` — null/undefined คืน null; ไม่ถูกต้อง throw Error ภาษาไทย (4 ระดับ g = A,B,C,D ตามลำดับ, min เป็นตัวเลข A>B>C>D=0, label ไม่ว่าง ≤ 40 ตัว, quota A/B/C 0–100)
- `gradeLevels(form, cfg) -> Array<[g, label, rangeText, desc]>` — ฟอร์ม 4–5 → `GR_SUP`; cfg null → `GR_NEW`; มี cfg → 4 แถว rangeText เช่น `'≥ 85'`, `'75 – 84.99'`, `'< 70'`
- `gradeInfo(form, cfg, grade) -> [g,label,...] | null` — หาใน `gradeLevels` ก่อน ไม่เจอหาใน `GR_NEW` แล้ว `GR_SUP`
- `calcScore(form, att, sc, W, cfg)` — เพิ่ม `cfg` (ไม่ส่ง = สเกลเดิม) ผลลัพธ์ `grade`, `label` ตาม cfg
- `quotaCaps(n, cfg) -> {A,B,C}` (cfg null → null)
- `quotaError(cfg, n, used, grade) -> string | null` — `used` = `{A,B,C,D}` ไม่รวมคนที่กำลังส่ง; ข้อความ `'เกรด A เกินโควต้าของกลุ่ม (ใช้แล้ว 2 จาก 2 คน · กลุ่ม 10 คน) กรุณาปรับคะแนนก่อนส่ง'`

- [ ] **Step 1: เขียน `tests/scoring.test.js`** โหลด Scoring.gs ด้วย `vm.runInNewContext` แล้วใช้ `assert`:
  - ฟอร์ม `g1` คะแนนรวมควบคุมผ่านฟังก์ชันช่วย `gradeOfTotal_` ในเทส (เรียก `gradeLevels` + เกณฑ์เดียวกับ calcScore) หรือสร้าง sc ให้ได้ผลรวมที่ต้องการ: 85→A, 84.99→B, 75→B, 74.99→C, 70→C, 69.99→D, 0→D
  - `calcScore('g1', {}, sc)` (ไม่มี cfg) ได้เกรดเดิม (เช่น 95→A+)
  - `calcScore('g45', {}, sc, null, DEFAULT)` ยังได้สเกล 5…1
  - `quotaCaps(n)` สำหรับ n=1→{A:0,B:1,C:0}, 2→{0,1,1}, 3→{1,2,1}, 5→{1,3,2}, 10→{2,5,3}
  - `quotaError(cfg,10,{A:2},'A')` มีข้อความ · `({A:1},'A')` null · `'D'` null เสมอ · cfg null → null
  - `gradeInfo('g1', DEFAULT, 'B+')[1] === GR_NEW` ของ B+ · `gradeInfo('g1', DEFAULT, 'A')[1] === 'ดีเยี่ยม'`
  - `normGradeCfg` throw เมื่อ B.min ≥ A.min, quota.A = 120, label ว่าง · คืน null สำหรับ null
  - Scoring.gs กับ ScoringClient.html (ตัด wrapper) เหมือนกันทุกตัวอักษร
- [ ] **Step 2:** `node tests/scoring.test.js` → FAIL (ฟังก์ชันยังไม่มี)
- [ ] **Step 3:** เขียนฟังก์ชันใน Scoring.gs แล้วคัดลอกทั้งไฟล์ไป ScoringClient.html
- [ ] **Step 4:** `node tests/scoring.test.js` → `ok`
- [ ] **Step 5:** Commit `feat: configurable grade levels and quota rules`

### Task 2: ฐานข้อมูล + เซิร์ฟเวอร์
**Files:** Create `sql/92_grade_cfg.sql` · Modify `sql/00_schema.sql`, `src/Code.gs` · Create `tests/server.test.js`

**Interfaces:**
- Consumes: Task 1 ทั้งหมด
- Produces (Code.gs):
  - `cfgOf_(cycle) -> cfg|null` (= `normGradeCfg(cycle.grade_cfg)` แบบไม่ throw → null)
  - `quotaGroup_(u, emps) -> emp[]` — `e.form === 'new' && e.evaluate !== false && e.active !== false && e.code !== u.emp_code && inScope_(u, e)`
  - `quotaUse_(cycleId, group, exceptCode) -> {A,B,C,D}` — นับจาก evaluations สถานะ div/exec/ack/hr/done
  - `quotaSummary_(u, c) -> {n, caps, used, over:[g]} | null` — null ถ้ารอบไม่มี cfg หรือกลุ่มว่าง หรือ role ไม่ใช่ eval/div/admin
  - `apiGradeCfgGet(token, cycleId) -> { cycleId, activeId, cycles:[{id,name,active,hasCfg}], cfg, def }` (hr/admin)
  - `apiGradeCfgSave(token, cycleId, cfg|null) -> apiGradeCfgGet(...)` (hr/admin) — บันทึกแล้วคำนวณ total/grade ใหม่ของแบบที่ status ≠ done ในรอบนั้น
- [ ] **Step 1: migration** `92_grade_cfg.sql`: `add column if not exists grade_cfg jsonb` + `update ... set grade_cfg = '<DEFAULT json>'::jsonb where is_active and grade_cfg is null` + select ตรวจผล · เพิ่มคอลัมน์ใน `00_schema.sql`
- [ ] **Step 2: เทส `tests/server.test.js`** โหลด Scoring.gs + Code.gs ใน vm พร้อม stub `PropertiesService`, `LockService`, `sb_` (ตารางในหน่วยความจำ), `cycle_`, `employees_`, `me_`, `attOf_`, `addHistory_`, `getEval_` แล้วตรวจ:
  - กลุ่ม 10 คน มี A ส่งแล้ว 2 → `apiSubmit` คนที่ 3 ได้ A → throw ข้อความมี "เกินโควต้า"; ได้ B → ผ่าน
  - คนที่สถานะ returned ส่งใหม่ได้ A เมื่อ A อื่นมี 1 → ผ่าน (ไม่นับตัวเอง)
  - รอบ cfg null → ไม่ตรวจโควต้า
  - ฟอร์ม g45 → ไม่ตรวจโควต้า
- [ ] **Step 3:** `node tests/server.test.js` → FAIL
- [ ] **Step 4: แก้ Code.gs**
  - `save_`, `apiSubmit`, `apiSaveWeights`, `apiAttSave` ส่ง `cfgOf_(c)` เข้า `calcScore`
  - `apiSubmit`: เมื่อ `e.form === 'new'` และ cfg มี → `LockService.getScriptLock().waitLock(20000)` → `quotaError(cfg, group.length, quotaUse_(c.id, group, code), check.grade)` → throw ถ้ามี → save → `releaseLock` ใน finally
  - `previous_`: select `eval_cycles(name,data_from,data_to,grade_cfg)` แล้วใช้ `gradeInfo(r.form, cfgOf_(c), r.grade)` แทน `gradeScale` lookup และส่ง cfg ให้ `calcScore`
  - `apiListEmployees` คืน `{ rows, quota }`? **ไม่** — คงคืน array เดิม (หลายหน้าพึ่ง) แล้วเพิ่ม `apiBootstrap.quota = quotaSummary_(u, c)` และ API ใหม่ `apiQuota(token)` คืน `quotaSummary_` ให้หน้า list รีเฟรช
  - `apiCycleSave` แบบเพิ่มใหม่: `grade_cfg` = cfg ของรอบล่าสุดที่มีค่า (order id.desc) หรือ `DEFAULT_GRADE_CFG`
  - เพิ่ม `apiGradeCfgGet`, `apiGradeCfgSave` ใต้หมวดรอบการประเมิน
- [ ] **Step 5:** `node tests/server.test.js` และ `node tests/scoring.test.js` → ok · ตรวจ syntax `new Function(Scoring.gs + Code.gs + Brand.gs)`
- [ ] **Step 6:** Commit `feat: grade_cfg per cycle and quota enforcement on submit`

### Task 3: หน้าเว็บ
**Files:** Modify `src/App.html`, `src/Styles.html` (ถ้าจำเป็น) · Create `tests/ui.test.js` (Playwright, mock `google.script.run`)

**Interfaces:**
- Consumes: `S.boot.cycle.grade_cfg`, `S.boot.quota`, `apiQuota`, `apiGradeCfgGet`, `apiGradeCfgSave`, ฟังก์ชัน Task 1
- Produces: หน้า `grades` (`vGrades`), ตัวช่วย `gcfg()` = `S.boot.cycle.grade_cfg || null`
- [ ] **Step 1: เทส UI** `tests/ui.test.js` สร้างหน้า HTML จาก Styles + ScoringClient + App ฝั่ง client พร้อม mock API (token ใน sessionStorage, boot role hr/eval) แล้วตรวจด้วย Playwright:
  - role hr: เมนูมี "เกณฑ์เกรดและโควต้า" → เปิดแล้วเห็นตาราง 4 แถวค่า 85/75/70 และ 20/50/30 · แก้ A เป็น 70 กดบันทึก → แสดงข้อความ error จาก mock (normGradeCfg) และไม่เรียก save
  - role eval: หน้ารายชื่อแสดง `A 1/2` และเมื่อ over มี class เตือน
  - Help แท็บเกณฑ์แสดง A/B/C/D ของรอบ · แดชบอร์ด hr แสดงการกระจาย 4 แถว
  - ไม่มี error ใน console
- [ ] **Step 2:** `node tests/ui.test.js` → FAIL
- [ ] **Step 3: แก้ App.html**
  - `NAV.hr` / `NAV.admin` เพิ่ม `['grades','เกณฑ์เกรดและโควต้า']` · `PAGE_TH.grades` · `NAV_IC.grades` · `goNow`: `S.gc = await run(api('apiGradeCfgGet', S.gc && S.gc.cycleId))`, `S.gcD = clone(S.gc.cfg || DEFAULT)`
  - `vGrades()`: เลือกรอบ (select), ตาราง เกรด/คะแนนขั้นต่ำ/ชื่อระดับ/% โควต้า (D: min 0 แก้ไม่ได้, โควต้า "ไม่จำกัด"), ตัวอย่างเพดาน n = 1,3,5,10, ปุ่ม บันทึก / ใช้ค่าเริ่มต้น / ใช้สเกลเดิม 7 ระดับ (confirm) · ตรวจ `normGradeCfg` ฝั่ง client ก่อนเรียก API
  - ทุก `calcScore(...)` ในหน้าเว็บส่ง `gcfg()` เป็นอาร์กิวเมนต์ที่ 5
  - `vDash` ระดับ 1–3 ใช้ `gradeLevels('g1', gcfg())` · `vHelp` แท็บเกณฑ์ใช้ `gradeLevels` + อธิบายโควต้า (เมื่อมี cfg) + ตัวอย่างใหม่
  - `vList`: ถ้า `S.boot.quota` → แถบ `โควต้ากลุ่ม (n คน): A u/c · B u/c · C u/c · D u` เกรดที่เกินแสดงสีเตือน + ข้อความ "เกินโควต้า กรุณาตรวจสอบ" · หลัง submit เรียก `apiQuota` อัปเดต
- [ ] **Step 4:** `node tests/ui.test.js` → ok · syntax `new Function(ScoringClient + App body)`
- [ ] **Step 5:** Commit `feat: grade settings page and quota bar`

### Task 4: เอกสารและส่งมอบ
**Files:** `docs/CHANGELOG.md`, `CLAUDE.md` (หน้า grades, API ใหม่, tests/), Help (ทำใน Task 3)
- [ ] CHANGELOG: วางทับ `Scoring.gs, ScoringClient.html, Code.gs, App.html` (+Styles ถ้าแก้) · รัน `sql/92_grade_cfg.sql` · Deploy New version
- [ ] รันเทสทั้งหมดอีกครั้ง → ok · Commit + push `main`
