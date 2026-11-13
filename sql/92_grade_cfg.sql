-- เกณฑ์เกรด 1–3 + โควต้า ต่อรอบการประเมิน (รันซ้ำได้)
-- grade_cfg = null → ใช้สเกลเดิม A+ … F และไม่มีโควต้า (รอบเก่า/ข้อมูลนำเข้า)
alter table "PFormPro_eval_cycles" add column if not exists grade_cfg jsonb;

-- ตั้งเกณฑ์ใหม่ให้รอบที่เปิดใช้อยู่ (เฉพาะที่ยังไม่ได้ตั้ง): A ≥ 85 · B ≥ 75 · C ≥ 70 · D < 70 · โควต้า A 20% B 50% C 30%
update "PFormPro_eval_cycles"
set grade_cfg = '{"levels":[{"g":"A","min":85,"label":"ดีเยี่ยม"},{"g":"B","min":75,"label":"ดี"},{"g":"C","min":70,"label":"พอใช้"},{"g":"D","min":0,"label":"ต้องปรับปรุง"}],"quota":{"A":20,"B":50,"C":30}}'::jsonb
where is_active and grade_cfg is null;

-- คำนวณเกรดของแบบประเมินที่ยังไม่ done ในรอบนั้นตามเกณฑ์ใหม่ (คะแนนรวมเดิม) · done ไม่แปลง
update "PFormPro_evaluations" e
set grade = case when e.total >= 85 then 'A' when e.total >= 75 then 'B' when e.total >= 70 then 'C' else 'D' end
from "PFormPro_eval_cycles" c
where c.id = e.cycle_id and c.is_active and e.status <> 'done' and e.total is not null
  and e.form in ('g1','g2_tech','g2_sup','g2_adm','g3_dep','g3_techn','g3_tech2','g3_off','new');

select id, name, is_active, grade_cfg is not null as has_grade_cfg from "PFormPro_eval_cycles" order by year_be desc, round desc;
