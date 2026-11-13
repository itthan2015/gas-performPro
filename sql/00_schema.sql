-- PerformPro · Supabase schema (ทุกตารางขึ้นต้นด้วย PFormPro_)
-- รันไฟล์นี้ใน Supabase > SQL Editor ครั้งเดียว

create table if not exists "PFormPro_divisions" (
  id serial primary key,
  name text not null unique
);

create table if not exists "PFormPro_departments" (
  id serial primary key,
  name text not null unique,
  division_id int references "PFormPro_divisions"(id) on delete set null
);

create table if not exists "PFormPro_employees" (
  emp_code text primary key,
  full_name text not null,
  grade int not null check (grade between 1 and 5),
  position text not null,
  department_id int references "PFormPro_departments"(id),
  work_site text default 'THAN',
  employment_type text default 'รายเดือน',
  start_date date,
  national_id_last4 text,   -- 4 ตัวท้ายเลขบัตรประชาชน (ใช้ยืนยันตัวตน)
  birth_date date,          -- วันเกิด (ค.ศ.)
  phone_last4 text,         -- 4 ตัวท้ายเบอร์โทรศัพท์
  phone text,               -- เบอร์โทรเต็ม (แสดงในโปรไฟล์ เฉพาะ HR)
  remark text,              -- หมายเหตุ (มี #ลาออก = isactive false)
  eval_form text,                    -- แบบฟอร์มประเมิน (ว่าง = อัตโนมัติจากเกรด+ตำแหน่ง)
  emp_status text default 'working',  -- working / resigned / check
  emp_status_detail text,
  resign_date date,
  last_scan date,
  active boolean default true,      -- ปิดใช้งาน = เข้าสู่ระบบไม่ได้ และไม่แสดงในรายชื่อ
  evaluate boolean default true     -- ร่วมประเมินในรอบปัจจุบัน
);

create table if not exists "PFormPro_eval_cycles" (
  id serial primary key,
  name text not null,
  year_be int not null,
  round int not null default 1,
  data_from date,
  data_to date,
  is_active boolean default false,
  grade_cfg jsonb   -- เกณฑ์เกรด 1–3 + โควต้า (null = สเกลเดิม) ดู sql/92_grade_cfg.sql
);

alter table "PFormPro_eval_cycles" add column if not exists grade_cfg jsonb;

create table if not exists "PFormPro_attendance" (
  cycle_id int references "PFormPro_eval_cycles"(id) on delete cascade,
  emp_code text references "PFormPro_employees"(emp_code) on delete cascade,
  late_min numeric default 0,
  sick_days numeric default 0,
  personal_days numeric default 0,
  absent_days numeric default 0,
  vacation_days numeric default 0,
  verbal_count numeric default 0,   -- หนังสือเตือนวาจา (ครั้ง)
  written_count numeric default 0,  -- หนังสือเตือนลายลักษณ์อักษร (ฉบับ)
  updated_by text,
  updated_at timestamptz default now(),
  primary key (cycle_id, emp_code)
);

create table if not exists "PFormPro_weight_sets" (
  form text primary key check (form in ('new','sup')),
  weights jsonb not null,
  updated_at timestamptz default now()
);

-- บัญชีหัวหน้า / ผู้อนุมัติ / ผู้บริหาร / HR (เข้าสู่ระบบด้วยรหัสพนักงาน + รหัสผ่าน)
-- พนักงานทั่วไปไม่ต้องมีแถวในตารางนี้ (เข้าสู่ระบบด้วยคำถามยืนยันตัวตน)
create table if not exists "PFormPro_app_users" (
  emp_code text primary key references "PFormPro_employees"(emp_code) on delete cascade,
  full_name text not null,
  role text not null check (role in ('eval','div','exec','hr','admin')),
  scope_type text not null check (scope_type in ('dept','div','all')),
  scope_values text[] not null default '{}',   -- เลือกได้หลายแผนก / หลายฝ่าย
  password_hash text,
  password_salt text,
  active boolean default true
);

-- นับจำนวนครั้งที่เข้าสู่ระบบผิด (ผิดครบ 3 ครั้ง = ล็อก จนกว่า HR จะปลดล็อก)
create table if not exists "PFormPro_login_attempts" (
  emp_code text primary key,
  fails int default 0,
  locked boolean default false,
  updated_at timestamptz default now()
);

create table if not exists "PFormPro_evaluations" (
  id bigserial primary key,
  cycle_id int not null references "PFormPro_eval_cycles"(id) on delete cascade,
  emp_code text not null references "PFormPro_employees"(emp_code) on delete cascade,
  form text not null check (form in ('new','sup','g1','g2_tech','g2_sup','g2_adm','g3_dep','g3_techn','g3_tech2','g3_off','g45')),
  status text not null default 'draft' check (status in ('draft','returned','div','exec','ack','hr','done')),
  scores jsonb not null default '{}'::jsonb,
  total numeric default 0,
  grade text,
  return_note text default '',
  updated_by text,
  updated_at timestamptz default now(),
  unique (cycle_id, emp_code)
);

create table if not exists "PFormPro_eval_history" (
  id bigserial primary key,
  evaluation_id bigint references "PFormPro_evaluations"(id) on delete cascade,
  step text not null,
  label text not null,
  actor_code text,
  actor_name text,
  note text default '',
  created_at timestamptz default now()
);

-- เอกสาร / รูปภาพแนบของพนักงานแต่ละคน (ไฟล์จริงเก็บใน Supabase Storage bucket "pformpro-attachments")
create table if not exists "PFormPro_attachments" (
  id bigserial primary key,
  emp_code text not null references "PFormPro_employees"(emp_code) on delete cascade,
  file_name text not null,
  mime text,
  size_bytes bigint,
  storage_path text not null unique,
  uploaded_by text,
  uploaded_by_name text,
  created_at timestamptz default now()
);
create index if not exists pformpro_attachments_emp_idx on "PFormPro_attachments"(emp_code);

insert into storage.buckets (id, name, public) values ('pformpro-attachments', 'pformpro-attachments', false) on conflict (id) do nothing;

-- ปิดการเข้าถึงจาก anon key ทั้งหมด (Apps Script ใช้ service_role key ฝั่งเซิร์ฟเวอร์เท่านั้น)
alter table "PFormPro_divisions" enable row level security;
alter table "PFormPro_departments" enable row level security;
alter table "PFormPro_employees" enable row level security;
alter table "PFormPro_eval_cycles" enable row level security;
alter table "PFormPro_attendance" enable row level security;
alter table "PFormPro_weight_sets" enable row level security;
alter table "PFormPro_app_users" enable row level security;
alter table "PFormPro_login_attempts" enable row level security;
alter table "PFormPro_evaluations" enable row level security;
alter table "PFormPro_eval_history" enable row level security;
alter table "PFormPro_attachments" enable row level security;

-- ───────── ข้อมูลตั้งต้น ─────────
insert into "PFormPro_divisions" (name) values ('ฝ่ายผลิต'),('ฝ่ายควบคุมคุณภาพ'),('ฝ่ายคลังสินค้าและออกบิล'),('ฝ่ายบริหารและบุคคล') on conflict do nothing;

insert into "PFormPro_departments" (name, division_id) values
 ('แผนกเคลือบสี',(select id from "PFormPro_divisions" where name='ฝ่ายผลิต')),
 ('แผนกโลหะแผ่น',(select id from "PFormPro_divisions" where name='ฝ่ายผลิต')),
 ('แผนกชิ้นส่วนคอยล์',(select id from "PFormPro_divisions" where name='ฝ่ายผลิต')),
 ('แผนกชิ้นส่วนทั่วไป',(select id from "PFormPro_divisions" where name='ฝ่ายผลิต')),
 ('แผนกควบคุมคุณภาพและสอบเทียบ',(select id from "PFormPro_divisions" where name='ฝ่ายควบคุมคุณภาพ')),
 ('แผนกขนส่ง',(select id from "PFormPro_divisions" where name='ฝ่ายคลังสินค้าและออกบิล')),
 ('แผนกคลังสินค้าสำเร็จ',(select id from "PFormPro_divisions" where name='ฝ่ายคลังสินค้าและออกบิล')),
 ('แผนกออกบิล',(select id from "PFormPro_divisions" where name='ฝ่ายคลังสินค้าและออกบิล')),
 ('แผนกบุคคลธุรการ',(select id from "PFormPro_divisions" where name='ฝ่ายบริหารและบุคคล')),
 ('สำนักงานบริหาร',(select id from "PFormPro_divisions" where name='ฝ่ายบริหารและบุคคล'))
on conflict do nothing;

insert into "PFormPro_employees" (emp_code, full_name, grade, position, department_id, start_date) values
 ('38031','ธันวา เทียนพิมาย',3,'ช่าง2',(select id from "PFormPro_departments" where name='แผนกเคลือบสี'),'1995-01-26'),
 ('60082','หฤษฎ์ สมาเด๊ะ',4,'หัวหน้าแผนก',(select id from "PFormPro_departments" where name='แผนกเคลือบสี'),'2017-11-01'),
 ('59147','จักรกฤษณ์ หนูช่วย',3,'รองหัวหน้า',(select id from "PFormPro_departments" where name='แผนกเคลือบสี'),'2016-11-21'),
 ('54170','พิทักษ์ ดอนเหลือม',1,'พนักงานสาขาช่าง1.2',(select id from "PFormPro_departments" where name='แผนกเคลือบสี'),'2011-07-05'),
 ('31008','สมทบ สนน้อย',4,'หัวหน้าแผนก',(select id from "PFormPro_departments" where name='แผนกโลหะแผ่น'),'1988-10-12'),
 ('35062','จินตนา เทียนพิมาย',2,'ผู้คุมงาน',(select id from "PFormPro_departments" where name='แผนกโลหะแผ่น'),'1992-05-11'),
 ('58192','อนุรัตน์ อามาตย์มุลตรี',2,'ช่าง1',(select id from "PFormPro_departments" where name='แผนกโลหะแผ่น'),'2015-07-08'),
 ('59063','ณัฐพงษ์ ศรีสด',2,'ช่าง1',(select id from "PFormPro_departments" where name='แผนกโลหะแผ่น'),'2016-02-16'),
 ('55129','เอกชัย สิมาจารย์',1,'พนักงานสาขาช่าง1.3',(select id from "PFormPro_departments" where name='แผนกโลหะแผ่น'),'2012-08-29'),
 ('63009','กำพล วัชรีฤทัย',4,'หัวหน้าแผนก',(select id from "PFormPro_departments" where name='แผนกชิ้นส่วนคอยล์'),'2020-02-03'),
 ('50225','เจียมจิตร์ วงษาพันธ์',1,'พนักงานสาขาช่าง1.2',(select id from "PFormPro_departments" where name='แผนกชิ้นส่วนคอยล์'),'2007-08-01'),
 ('53006','กิตติมา โคตรวังอวน',1,'พนักงานสาขาช่าง1.2',(select id from "PFormPro_departments" where name='แผนกชิ้นส่วนคอยล์'),'2010-01-13'),
 ('31002','จุมพล ใจศักดิ์',4,'ผู้ชำนาญการ',(select id from "PFormPro_departments" where name='แผนกชิ้นส่วนทั่วไป'),'1988-04-11'),
 ('57262','นิรุตติ์ เดชเดชา',3,'ช่าง2',(select id from "PFormPro_departments" where name='แผนกชิ้นส่วนทั่วไป'),'2014-11-01'),
 ('56038','สุพจน์ มิ่งเมือง',2,'ผู้คุมงาน',(select id from "PFormPro_departments" where name='แผนกชิ้นส่วนทั่วไป'),'2013-02-18'),
 ('34027','ดวงใจ อับดุลเลาะ',2,'ช่าง1',(select id from "PFormPro_departments" where name='แผนกชิ้นส่วนทั่วไป'),'1991-06-03'),
 ('31004','สุณัฐนรี แก้วสุวรรณ',3,'รองหัวหน้า',(select id from "PFormPro_departments" where name='แผนกควบคุมคุณภาพและสอบเทียบ'),'1988-07-18'),
 ('26002','ขนิษฐา คดพิมพ์',3,'รองหัวหน้า',(select id from "PFormPro_departments" where name='แผนกควบคุมคุณภาพและสอบเทียบ'),'1983-04-01'),
 ('60026','คมไผ่ เสาตุ่น',2,'ช่าง1',(select id from "PFormPro_departments" where name='แผนกควบคุมคุณภาพและสอบเทียบ'),'2017-04-16'),
 ('30004','อำนวย ศรีสุวรรณ',4,'หัวหน้าแผนก',(select id from "PFormPro_departments" where name='แผนกออกบิล'),'1987-03-20'),
 ('38094','สัญญา สงนวน',2,'ช่าง1',(select id from "PFormPro_departments" where name='แผนกขนส่ง'),'1995-03-13'),
 ('58113','วิชา พานเหนือ',2,'ช่าง1',(select id from "PFormPro_departments" where name='แผนกขนส่ง'),'2015-05-04'),
 ('45068','ศรนภา สิงหะ',3,'รองหัวหน้า',(select id from "PFormPro_departments" where name='แผนกคลังสินค้าสำเร็จ'),'2002-05-28'),
 ('31007','กาญจนา โยชะนัง',4,'หัวหน้าแผนก',(select id from "PFormPro_departments" where name='แผนกบุคคลธุรการ'),'1988-10-12'),
 ('20002','จันทร์เพ็ญ โชติพงศ์',5,'ผู้จัดการฝ่ายผลิต',(select id from "PFormPro_departments" where name='สำนักงานบริหาร'),'2005-06-01'),
 ('GM001','ผู้จัดการทั่วไป',5,'ผู้จัดการทั่วไป',(select id from "PFormPro_departments" where name='สำนักงานบริหาร'),'2000-01-01')
on conflict do nothing;
update "PFormPro_employees" set evaluate = false where emp_code = 'GM001';

create unique index if not exists pformpro_cycles_year_round_uq on "PFormPro_eval_cycles"(year_be, round);
create unique index if not exists pformpro_cycles_one_active_uq on "PFormPro_eval_cycles"(is_active) where is_active;
insert into "PFormPro_eval_cycles" (name, year_be, round, data_from, data_to, is_active, grade_cfg)
select 'ประเมินผลการปฏิบัติงานประจำปี 2569 ครั้งที่ 2', 2569, 2, '2026-04-01'::date, '2026-09-30'::date, not exists (select 1 from "PFormPro_eval_cycles" where is_active),
  '{"levels":[{"g":"A","min":85,"label":"ดีเยี่ยม"},{"g":"B","min":75,"label":"ดี"},{"g":"C","min":70,"label":"พอใช้"},{"g":"D","min":0,"label":"ต้องปรับปรุง"}],"quota":{"A":20,"B":50,"C":30}}'::jsonb
where not exists (select 1 from "PFormPro_eval_cycles" where year_be = 2569 and round = 2);

insert into "PFormPro_attendance" (cycle_id, emp_code, late_min, sick_days, personal_days, absent_days)
select (select id from "PFormPro_eval_cycles" where is_active limit 1), v.code, v.late, v.sick, v.personal, v.absent
from (values
 ('38031',0,2,7,0),('60082',0,0,2,0),('59147',0,6,6.63,0),('54170',0,3,3,0),('31008',0,2,2,0),('35062',0,0,0,0),
 ('58192',3,0,1,0),('59063',0,0,1,0),('55129',1,0,0,0),('63009',0,2,5,0),('50225',4,1,12,0),('53006',0,0,0,0),
 ('31002',0,0,0,0),('57262',0,2,2,0),('56038',0,4,5,0),('34027',0,0,0,0),('31004',0,0,3,0),('26002',0,4,1,0),
 ('60026',0,0.5,0,0),('30004',3,1,3,0),('38094',0,0,2,0),('58113',0,0,1,0),('45068',26,1.5,2.38,0)
) as v(code, late, sick, personal, absent)
on conflict do nothing;

insert into "PFormPro_weight_sets" (form, weights) values
 ('new','[20,20,10,5,5,10,30]'::jsonb),
 ('sup','[10,30,30,15,10,5]'::jsonb)
on conflict (form) do nothing;

-- ข้อมูลยืนยันตัวตนตัวอย่าง (แทนที่ด้วยข้อมูลจริงจากระบบบุคคล)
update "PFormPro_employees" e set national_id_last4 = v.nid, birth_date = v.dob::date, phone_last4 = v.ph
from (values
 ('38031','7489','1972-04-16','8910'),
 ('60082','9358','1993-11-08','8089'),
 ('59147','5093','1991-12-18','6474'),
 ('54170','2230','1989-03-09','0241'),
 ('31008','2352','1968-01-13','7143'),
 ('35062','5978','1968-11-17','8509'),
 ('58192','2448','1991-05-08','0279'),
 ('59063','9897','1991-12-15','9238'),
 ('55129','6551','1991-02-23','5352'),
 ('63009','8271','1997-10-19','9872'),
 ('50225','1775','1982-06-06','4336'),
 ('53006','4514','1988-03-06','5685'),
 ('31002','4838','1968-07-07','8769'),
 ('57262','7778','1990-11-23','2309'),
 ('56038','4922','1989-11-14','4013'),
 ('34027','9813','1970-08-08','3994'),
 ('31004','0676','1966-09-09','8227'),
 ('26002','9838','1959-11-02','3769'),
 ('60026','5894','1995-03-06','3265'),
 ('30004','1676','1963-05-08','9227'),
 ('38094','6386','1975-07-25','6837'),
 ('58113','6847','1992-10-10','6688'),
 ('45068','3492','1980-09-06','6883'),
 ('31007','4433','1963-12-12','2414'),
 ('20002','8838','1980-03-03','1569'),
 ('GM001','0000','1975-01-01','0000')
) as v(code, nid, dob, ph) where e.emp_code = v.code;

-- บัญชีผู้ใช้ระดับหัวหน้าขึ้นไป (ตั้งรหัสผ่านเริ่มต้นด้วยฟังก์ชัน setupDemoPasswords ใน Apps Script)
insert into "PFormPro_app_users" (emp_code, full_name, role, scope_type, scope_values) values
 ('31007','กาญจนา โยชะนัง','hr','all','{}'),
 ('60082','หฤษฎ์ สมาเด๊ะ','eval','dept','{แผนกเคลือบสี}'),
 ('31008','สมทบ สนน้อย','eval','dept','{แผนกโลหะแผ่น}'),
 ('63009','กำพล วัชรีฤทัย','eval','dept','{แผนกชิ้นส่วนคอยล์}'),
 ('31002','จุมพล ใจศักดิ์','eval','dept','{แผนกชิ้นส่วนทั่วไป,แผนกชิ้นส่วนคอยล์}'),
 ('31004','สุณัฐนรี แก้วสุวรรณ','eval','dept','{แผนกควบคุมคุณภาพและสอบเทียบ}'),
 ('30004','อำนวย ศรีสุวรรณ','eval','div','{ฝ่ายคลังสินค้าและออกบิล}'),
 ('20002','จันทร์เพ็ญ โชติพงศ์','div','div','{ฝ่ายผลิต}'),
 ('GM001','ผู้จัดการทั่วไป','exec','all','{}')
on conflict do nothing;

-- ผลประเมินรอบก่อนหน้า: รันไฟล์ import_2569_round1.sql ต่อจากไฟล์นี้


-- ให้ PostgREST โหลดโครงสร้างตารางใหม่ทันที
notify pgrst, 'reload schema';
