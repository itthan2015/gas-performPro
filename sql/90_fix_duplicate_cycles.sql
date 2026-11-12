-- แก้รอบการประเมินซ้ำ และรอบที่เปิดใช้งานพร้อมกันหลายรอบ
-- รันใน Supabase > SQL Editor ครั้งเดียว (รันซ้ำได้)
begin;

-- 1) รวมรอบที่ปี+ครั้งที่ซ้ำกัน: เก็บ id ที่น้อยที่สุด ย้ายแบบประเมิน/สถิติมาทำงานไปไว้ที่รอบนั้น
with d as (
  select id, min(id) over (partition by year_be, round) as keep_id from "PFormPro_eval_cycles"
)
update "PFormPro_evaluations" e set cycle_id = d.keep_id
from d where e.cycle_id = d.id and d.id <> d.keep_id
  and not exists (select 1 from "PFormPro_evaluations" x where x.cycle_id = d.keep_id and x.emp_code = e.emp_code);

with d as (
  select id, min(id) over (partition by year_be, round) as keep_id from "PFormPro_eval_cycles"
)
update "PFormPro_attendance" a set cycle_id = d.keep_id
from d where a.cycle_id = d.id and d.id <> d.keep_id
  and not exists (select 1 from "PFormPro_attendance" x where x.cycle_id = d.keep_id and x.emp_code = a.emp_code);

delete from "PFormPro_eval_cycles" c
using (select id, min(id) over (partition by year_be, round) as keep_id from "PFormPro_eval_cycles") d
where c.id = d.id and d.id <> d.keep_id;

-- 2) เปิดใช้งานได้ทีละ 1 รอบ: เก็บรอบล่าสุด (ปี/ครั้งที่มากสุด) ที่เปิดอยู่
update "PFormPro_eval_cycles" set is_active = false
where is_active and id <> (select id from "PFormPro_eval_cycles" where is_active order by year_be desc, round desc, id desc limit 1);

-- 3) กันไม่ให้เกิดซ้ำอีก
create unique index if not exists pformpro_cycles_year_round_uq on "PFormPro_eval_cycles"(year_be, round);
create unique index if not exists pformpro_cycles_one_active_uq on "PFormPro_eval_cycles"(is_active) where is_active;

commit;

select id, name, year_be, round, is_active from "PFormPro_eval_cycles" order by year_be desc, round desc;
