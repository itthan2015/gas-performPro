-- ปรับระบบให้ใช้แบบฟอร์มประเมิน เกรด 1-5 rev.10.11.69 (9 แบบฟอร์ม)
-- รันใน Supabase > SQL Editor ครั้งเดียว (รันซ้ำได้)

-- 1) แบบฟอร์มรายคน (ว่าง = ระบบเลือกจากเกรด + ตำแหน่ง)
alter table "PFormPro_employees" add column if not exists eval_form text;
alter table "PFormPro_employees" drop constraint if exists pformpro_employees_eval_form_chk;
alter table "PFormPro_employees" add constraint pformpro_employees_eval_form_chk
  check (eval_form is null or eval_form in ('g1','g2_tech','g2_sup','g2_adm','g3_dep','g3_techn','g3_tech2','g3_off','g45'));

-- 2) แบบประเมินเก็บรหัสแบบฟอร์มใหม่ (ยังรองรับ new/sup ของรอบเก่า)
alter table "PFormPro_evaluations" drop constraint if exists "PFormPro_evaluations_form_check";
alter table "PFormPro_evaluations" drop constraint if exists evaluations_form_check;
alter table "PFormPro_evaluations" add constraint pformpro_evaluations_form_chk
  check (form in ('new','sup','g1','g2_tech','g2_sup','g2_adm','g3_dep','g3_techn','g3_tech2','g3_off','g45'));

notify pgrst, 'reload schema';

-- 3) ตรวจ: แบบประเมินรอบปัจจุบันที่ยังเป็นแบบฟอร์มเดิมและยังไม่ปิด (ต้องให้คะแนนใหม่)
select e.emp_code, p.full_name, e.form, e.status
from "PFormPro_evaluations" e
join "PFormPro_eval_cycles" c on c.id = e.cycle_id and c.is_active
join "PFormPro_employees" p on p.emp_code = e.emp_code
where e.form in ('new','sup') and e.status <> 'done'
order by 1;

-- 4) (ทางเลือก) ล้างคะแนนร่างแบบฟอร์มเดิมของรอบปัจจุบัน ให้เริ่มประเมินด้วยแบบฟอร์มใหม่ — เอา -- ออกเพื่อรัน
-- update "PFormPro_evaluations" e set scores = '{}'::jsonb, total = null, grade = null
-- from "PFormPro_eval_cycles" c where c.id = e.cycle_id and c.is_active and e.form in ('new','sup') and e.status in ('draft','returned');
