-- บัญชีผู้ดูแลระบบ: รหัส admin / รหัสผ่าน CHANGE_ME
-- สิทธิ์: เข้าได้ทุกเมนู เห็นพนักงานทั้งบริษัท ตั้งค่าน้ำหนัก จัดการพนักงาน/บทบาท/หน่วยงาน และอนุมัติได้ทุกขั้น
-- รันใน Supabase > SQL Editor (รันซ้ำได้ = รีเซ็ตรหัสผ่านกลับเป็น CHANGE_ME)

create extension if not exists pgcrypto with schema extensions;

-- ให้ตารางบทบาทรองรับ 'admin' (สำหรับฐานข้อมูลที่สร้างจาก schema.sql รุ่นก่อน)
alter table "PFormPro_app_users" drop constraint if exists "PFormPro_app_users_role_check";
alter table "PFormPro_app_users" add constraint "PFormPro_app_users_role_check" check (role in ('eval','div','exec','hr','admin'));

-- แถวพนักงานของบัญชี admin (ไม่ร่วมประเมิน จึงไม่แสดงในรายชื่อประเมิน)
insert into "PFormPro_employees" (emp_code, full_name, position, grade, active, evaluate)
values ('admin', 'ผู้ดูแลระบบ', 'ผู้ดูแลระบบ (Administrator)', 5, true, false)
on conflict (emp_code) do update set active = true, evaluate = false;

-- รหัสผ่านเก็บแบบ SHA-256(salt + '|' + password) ตรงกับ hash_() ใน Code.gs
with s as (select md5(random()::text || clock_timestamp()::text) as salt)
insert into "PFormPro_app_users" (emp_code, full_name, role, scope_type, scope_values, active, password_salt, password_hash)
select 'admin', 'ผู้ดูแลระบบ', 'admin', 'all', '{}', true, s.salt,
       encode(extensions.digest(s.salt || '|' || 'CHANGE_ME', 'sha256'), 'hex')
from s
on conflict (emp_code) do update set role = 'admin', scope_type = 'all', scope_values = '{}', active = true,
  password_salt = excluded.password_salt, password_hash = excluded.password_hash;

delete from "PFormPro_login_attempts" where emp_code = 'admin';

select emp_code, role, scope_type, active from "PFormPro_app_users" where emp_code = 'admin';
