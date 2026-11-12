ไฟล์ในโฟลเดอร์นี้มีข้อมูลส่วนบุคคลจริง (PDPA) ใช้รันใน Supabase เท่านั้น และถูก .gitignore ไว้
- import_2569_round1.sql — พนักงาน + ผลประเมินรอบ 1/2569 (จาก Excel)
- import_employee_profile.sql — เลขบัตร 4 ตัวท้าย วันเกิด เบอร์โทร remark
- import_employees_202611101842.sql — นำเข้า/อัปเดตพนักงานจากไฟล์ JSON ล่าสุด
- update_employee_status.sql — สถานะ ทำงาน/ลาออก (ลาออก → active=false, evaluate=false)
- employees_profile.json — ต้นฉบับ + field isactive
