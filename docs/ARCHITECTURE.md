# สถาปัตยกรรม

```
Browser (App.html SPA) ──google.script.run──▶ Code.gs (Apps Script, Execute as owner)
                                              │  UrlFetchApp + service_role key
                                              ▼
                                   Supabase PostgREST  /rest/v1/PFormPro_*
                                   Supabase Storage    /storage/v1  bucket pformpro-attachments
```
- หน้าเว็บไม่เคยถือ Supabase key · ถือแค่ session token (sessionStorage)
- `api(name, ...args)` ฝั่งหน้าเว็บส่ง token อัตโนมัติ · `raw()` ไม่ส่ง token
- `Index.html` → `<?!= clientBundle_('App') ?>` ถอด base64 แล้ว inject script · ขั้นโหลด 1/4–4/4 แสดงบนหน้าจอ (`ppStep`) และ `ppFail` แสดง error แทนการค้าง
- Scoring ใช้ร่วม: Scoring.gs (เซิร์ฟเวอร์ คำนวณจริงตอนบันทึก) / ScoringClient.html (หน้าเว็บ แสดงผลทันที)

## ตาราง
divisions · departments · employees (phone, remark, active, evaluate, isactive generated, emp_status, form_code) · app_users (role, scope_type, scope_values[], password_hash) · login_attempts · eval_cycles (is_active) · attendance (late_min, sick_days, personal_days, absent_days, verbal_count, written_count) · weight_sets (เลิกใช้) · evaluations (scores jsonb, total, grade, status, form) · eval_history · attachments — ทั้งหมดขึ้นต้น `PFormPro_`

## Migration ใน sql/
| ไฟล์ | เนื้อหา |
| --- | --- |
| 00_schema.sql | ตารางทั้งหมด + bucket + ข้อมูลตั้งต้น |
| 10_attendance_discipline.sql | คอลัมน์ใบเตือนใน attendance |
| 20_form_rev101169.sql | แบบฟอร์ม 9 แบบ (form_code) |
| 30_admin_account.sql | บัญชี admin (แก้ CHANGE_ME ก่อนรัน) |
| 90_/91_ | สคริปต์แก้ข้อมูล (รอบซ้ำ, สถานะว่าง) |
