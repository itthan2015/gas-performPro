# Changelog
รูปแบบ: วันที่ · สิ่งที่เปลี่ยน · ไฟล์ที่ต้องวางทับ / SQL ที่ต้องรัน

## 2026-11-13 — แบบฟอร์มธุรการ/เจ้าหน้าที่ เต็ม 100 (ตาม formEdit2Oper.xlsx)
- เกรด 2 · ธุรการ (g2_adm): ข้อ 4 การจัดลำดับความสำคัญของงาน เต็ม 10 → **15** (14–15 · 11–13 · 8–10 · 5–7)
- เกรด 3 · เจ้าหน้าที่ (g3_off): ข้อ 2 ความรอบรู้และมีทักษะในงานที่ทำ เต็ม 15 → **20** (19–20 · 15–18 · 5–14 · 1–4)
- ทุกแบบฟอร์มรวม 100 แล้ว (หน้าแบบฟอร์ม/แบบประเมิน/รายงานใช้ค่าเดียวกันจาก Scoring) · ไม่มีแบบประเมินที่ให้คะแนนแล้วได้รับผลกระทบ
- ไฟล์: `Scoring.gs`, `ScoringClient.html`, `App.html` → deploy อัตโนมัติเมื่อ push main · ไม่มี SQL

## 2026-11-13 — Deploy อัตโนมัติด้วย GitHub Actions + clasp
- `.github/workflows/deploy-gas.yml`: push เข้า main → เทส → `clasp push` → Deploy New version (URL เดิม)
- ตั้งค่าครั้งเดียว: Secret `CLASPRC_JSON`, Variables `GAS_SCRIPT_ID`, `GAS_DEPLOYMENT_ID` — ดู docs/DEPLOY.md

## 2026-11-13 — เกณฑ์เกรด 4 ระดับ + โควต้า
- เกรด 1–3 ใช้เกณฑ์ของรอบ (`eval_cycles.grade_cfg`) ค่าเริ่มต้น A ≥ 85 · B 75–84.99 · C 70–74.99 · D < 70 · เกรด 4–5 คงสเกล 5…1
- โควต้าต่อกลุ่มผู้ประเมิน A 20% · B 50% · C 30% · D ไม่จำกัด (ปัดเศษ ≥ .5 ขึ้น, แยกกันเด็ดขาด) · เกินโควต้า → ส่งไม่ได้
- เมนูใหม่ "เกณฑ์เกรดและโควต้า" (HR/admin) แก้คะแนนขั้นต่ำ ชื่อระดับ % โควต้า รายรอบ · กลับไปใช้สเกลเดิมได้
- หน้ารายชื่อแสดงแถบโควต้าของกลุ่ม · แดชบอร์ด/Help ใช้เกณฑ์ของรอบ · รอบเก่าที่ไม่มี grade_cfg แสดงสเกลเดิม
- แก้หน้าแบบประเมินพังเมื่อกด "ดูเกณฑ์การให้เกรด"
- เพิ่มเทส `node tests/scoring.test.js`, `node tests/server.test.js`, `node tests/ui.test.js` (Playwright)
- ไฟล์ที่ต้องวางทับ: `Scoring.gs`, `ScoringClient.html`, `Code.gs`, `App.html`, `Styles.html` → รัน `sql/92_grade_cfg.sql` → Deploy **New version**

## 2026-11-12 — โลโก้อ่านจาก Script Property LOGO_URL
- ทุกจุดเรียกรูปจาก Script Property `LOGO_URL` (ไฟล์อยู่ใน Supabase Storage) ไม่คำนวณ URL เองแล้ว · `setupLogo()` อัปโหลดแล้วตั้ง `LOGO_URL` ให้อัตโนมัติ
- ไฟล์ที่ต้องวางทับ: `Brand.gs`, `Code.gs`, `Index.html` → รัน `setupLogo()` (หรือตั้ง `LOGO_URL` เอง) → Deploy **New version**

## 2026-11-12 — ใช้โลโก้เดียวกันทั้งแอป
- แทนตัว "P" ที่เมนูซ้ายและหน้า login ด้วยโลโก้จาก Storage (`logoHtml()` ใน App.html) + แสดงโลโก้ที่หน้ากำลังโหลด · ถ้าโหลดรูปไม่ได้จะกลับไปแสดงตัว P
- ไฟล์ที่ต้องวางทับ: `App.html`, `Index.html`, `Styles.html` → Deploy **New version**

## 2026-11-12 — โลโก้ / favicon
- เพิ่มโลโก้ PerformPro (`assets/logo.svg` + PNG 32/128/180/512) ใช้เป็นไอคอนแท็บเบราว์เซอร์ผ่าน `setFaviconUrl`
- ไฟล์ไอคอนเก็บใน Supabase Storage bucket public `pformpro-public` ที่ `brand/favicon.png` (เปลี่ยนได้ด้วย Script Property `LOGO_URL`)
- ไฟล์ที่ต้องวางทับ: `Code.gs` + ไฟล์ใหม่ `Brand.gs` → รัน `setupLogo()` ใน Editor 1 ครั้ง → Deploy **New version**

## 2026-11-12 — จัดทำ repo
- รวมโค้ด เอกสาร และ migration เข้า repo · ย้ายข้อมูลส่วนบุคคลไป data-private/ (ignored)
- ลบรหัสผ่าน admin ออกจากไฟล์ (ใช้ CHANGE_ME)

## ก่อนหน้า
ดู docs/CONVERSATION.md
