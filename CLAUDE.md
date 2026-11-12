# CLAUDE.md — บริบทสำหรับพัฒนา PerformPro ต่อ

อ่านไฟล์นี้ + docs/PROCESS.md ก่อนแก้ไข ตอบผู้ใช้เป็นภาษาไทย กระชับ

## Stack และข้อจำกัด
- Google Apps Script (V8) + HtmlService · Supabase REST (PostgREST) ผ่าน UrlFetchApp ด้วย service_role key (Script Properties)
- หน้าเว็บเป็น SPA vanilla JS ใน `App.html` (ไม่มี build step, ไม่มี framework, ไม่มี npm)
- `Index.html` โหลด App/ScoringClient แบบ **base64** ผ่าน `clientBundle_()` — เพราะ HtmlService ตัด/แปลง JS ที่มีแท็ก HTML ในสตริง (เคยทำให้ค้างที่ "กำลังโหลด… 3/4") **ห้ามเปลี่ยนกลับเป็น include ตรง**
- ตารางทั้งหมดขึ้นต้น `PFormPro_` (ตัวพิมพ์ใหญ่ → SQL ต้องใส่ "…") · ใน Code.gs ใช้ `P + 'table'`
- SQL Editor ของ Supabase: **ห้ามใช้ temp table** (รันแยก statement) → ใช้ `from (values …) as s(...)` แทน · รอบประเมินใช้คอลัมน์ `is_active` (ไม่ใช่ active)
- วันที่แสดงผล **dd/MM/yyyy ปี พ.ศ.** ผ่าน `fmtD()` / รับค่าผ่าน `parseD()` + `dateIn()` (`DATE_BE` สลับ ค.ศ.)
- แสดงกล่อง "ระบบกำลังทำงาน" ด้วย `withLoading(msg, fn)` ทุกครั้งที่เปลี่ยนหน้า/โหลดข้อมูล รวมหน้า login · error ยังแสดงแบบเดิม

## กฎที่ต้องรักษา
1. **Scoring.gs กับ ScoringClient.html ต้องตรงกันเสมอ** (แก้ไฟล์หนึ่ง → คัดลอกเนื้อหาไปอีกไฟล์ ยกเว้น `<script>` wrapper)
2. สิทธิ์ตรวจที่ **เซิร์ฟเวอร์** เสมอ (`me_`, `requireRole_`, `inScope_`, `canAct_`, `canAtt_`) — หน้าเว็บซ่อนเมนูเพื่อ UX เท่านั้น · `admin` ผ่านทุกสิทธิ์
3. สถานะแบบประเมินที่รู้จัก: `none, draft, returned, div, exec, ack, hr, done` — ค่าอื่นถือเป็น none (กันหน้าพัง)
4. คะแนนต้องอยู่ในช่วงของ "ลักษณะผลการประเมิน" ที่เลือก ไม่งั้นนับเป็นยังไม่ให้คะแนน
5. ข้อมูลส่วนบุคคล (เลขบัตร/วันเกิด/เบอร์เต็ม/remark) ส่งให้ HR/admin เท่านั้น · ห้าม commit `data-private/`
6. แก้โค้ดแล้วตรวจ syntax: `new Function(Scoring.gs + Code.gs)` และ `new Function(ScoringClient + App script body)`
7. Template string ใน App.html: ห้ามใส่ `// comment` ในบรรทัดเดียวกับโค้ดที่ตามมา (เคยกลืน `return`)

## แผนที่โค้ด
- หน้า (App.html `PAGE_TH` / `v*()`): dash แดชบอร์ด · list รายชื่อพนักงาน · eval แบบประเมิน · approve รายการรออนุมัติ · report รายงาน · mine ผลของฉัน · weights แบบฟอร์มประเมิน · staff จัดการพนักงาน · att สถิติมาทำงาน · cycles รอบการประเมิน · help คู่มือ
- เมนูตามบทบาท: `NAV` (+ att ถ้า `S.boot.canAtt`, + help ทุกบทบาท) · เมนูซ้ายหุบได้ (hamburger)
- API (Code.gs): apiLoginStart/apiLoginAnswer/apiStaffLogin/apiLogout · apiBootstrap · apiListEmployees · apiGetEvaluation · apiSaveDraft/apiSubmit/apiApprove/apiReturn · apiReportList/apiReportGet · apiUploadFile/apiDeleteFile · apiAttList/apiAttSave · apiCycleList/Save/Activate/Delete · apiAdminData/apiSaveEmployee/apiImportEmployees/apiUnlock · apiAdd/Delete Division/Department, apiMoveDepartment · apiSetEmpView · apiSaveWeights (เลิกใช้)
- ฟังก์ชันรันมือใน Editor: `testConnection`, `setupAdmin`, `setupDemoPasswords`
- Script Properties: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `HR_UNITS` (ชื่อหน่วยงาน HR คั่น ,), `EMP_VIEW` (on/off), `EMP_VIEW_BY`
- แบบฟอร์ม (Scoring.gs `SCORING.FORMS`, rev.10.11.69): g1 · g2_tech · g2_sup · g2_adm · g3_dep · g3_techn · g3_tech2 · g3_off · g45 — เลือกอัตโนมัติจากเกรด+คำในตำแหน่ง (`formOf`) HR override รายคนได้
- สายอนุมัติ: `skipDivStep(grade, pos)` ใน Scoring

## เมื่อผู้ใช้ขอเปลี่ยนกระบวนการ
1. อัปเดต docs/PROCESS.md (กฎธุรกิจ) ก่อน แล้วแก้โค้ด
2. ถ้าแก้ schema → เพิ่มไฟล์ migration ใหม่ใน `sql/` (เลขถัดไป, รันซ้ำได้: `if not exists` / `on conflict`) และแก้ `00_schema.sql` ให้ติดตั้งใหม่ได้ครบ
3. อัปเดต docs/CHANGELOG.md (วันที่ ISO + ไฟล์ที่ต้องวางทับ) และหน้า Help ใน App.html ถ้ากระทบผู้ใช้
4. บอกผู้ใช้เสมอ: ไฟล์ไหนต้องวางทับ, SQL ไหนต้องรัน, ต้อง Deploy **New version**
