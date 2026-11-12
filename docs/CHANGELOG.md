# Changelog
รูปแบบ: วันที่ · สิ่งที่เปลี่ยน · ไฟล์ที่ต้องวางทับ / SQL ที่ต้องรัน

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
