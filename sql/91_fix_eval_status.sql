-- ตรวจ/แก้แบบประเมินที่สถานะว่างหรือไม่ถูกต้อง (ทำให้หน้า "พนักงาน" แสดงไม่ได้)
-- 1) ดูรายการที่มีปัญหา
select c.name as cycle, e.emp_code, e.status, e.total, e.grade
from "PFormPro_evaluations" e join "PFormPro_eval_cycles" c on c.id = e.cycle_id
where e.status is null or e.status not in ('none','draft','returned','div','exec','ack','hr','done');

-- 2) แก้: มีคะแนนรวมแล้ว = ร่าง · ไม่มีคะแนน = ยังไม่ประเมิน
update "PFormPro_evaluations"
set status = case when total is not null then 'draft' else 'none' end
where status is null or status not in ('none','draft','returned','div','exec','ack','hr','done');
