-- สถิติมาทำงาน: เพิ่มหนังสือเตือนวาจา / ลายลักษณ์อักษร และผู้แก้ไขล่าสุด
-- รันใน Supabase > SQL Editor ครั้งเดียว (รันซ้ำได้)
alter table "PFormPro_attendance" add column if not exists verbal_count numeric default 0;   -- หนังสือเตือนวาจา (ครั้ง)
alter table "PFormPro_attendance" add column if not exists written_count numeric default 0;  -- หนังสือเตือนลายลักษณ์อักษร (ฉบับ)
alter table "PFormPro_attendance" add column if not exists updated_by text;
alter table "PFormPro_attendance" add column if not exists updated_at timestamptz default now();

-- ย้ายจำนวนหนังสือเตือนที่ผู้ประเมินเคยกรอกในแบบประเมิน มาไว้ในสถิติมาทำงาน
insert into "PFormPro_attendance" (cycle_id, emp_code, verbal_count, written_count)
select e.cycle_id, e.emp_code, coalesce((e.scores->>'verbal')::numeric, 0), coalesce((e.scores->>'written')::numeric, 0)
from "PFormPro_evaluations" e
where (e.scores ? 'verbal' or e.scores ? 'written')
on conflict (cycle_id, emp_code) do update
  set verbal_count = coalesce(nullif("PFormPro_attendance".verbal_count, 0), excluded.verbal_count),
      written_count = coalesce(nullif("PFormPro_attendance".written_count, 0), excluded.written_count);

notify pgrst, 'reload schema';
