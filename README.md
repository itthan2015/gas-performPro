# gas-performPro · ระบบประเมินผลการปฏิบัติงาน

Web App บน **Google Apps Script** เก็บข้อมูลใน **Supabase (PostgreSQL)** · ตารางทั้งหมดขึ้นต้นด้วย `PFormPro_`

## โครงสร้าง repo
```
src/              โค้ด Apps Script (push เข้า main → deploy อัตโนมัติ, ดู docs/DEPLOY.md)
  Code.gs           เซิร์ฟเวอร์: Supabase REST, สิทธิ์, API ทั้งหมด
  Scoring.gs        กฎคิดคะแนน/เกรด/แบบฟอร์ม/สายอนุมัติ (ต้นฉบับ)
  ScoringClient.html สำเนา Scoring.gs สำหรับหน้าเว็บ — แก้ต้องแก้คู่กันเสมอ
  Index.html        โครงหน้า + ตัวโหลดสคริปต์ (base64)
  Styles.html       CSS ทั้งหมด
  App.html          SPA หน้าเว็บ (vanilla JS)
  appsscript.json   manifest (Web app, Asia/Bangkok, V8)
sql/              สคริปต์ Supabase เรียงตามลำดับการรัน
templates/        ไฟล์ตัวอย่างสำหรับนำเข้า CSV
docs/             เอกสาร: ติดตั้ง, กระบวนการ, สถาปัตยกรรม, ประวัติการพัฒนา
CLAUDE.md         บริบทสำหรับ Claude เพื่อพัฒนาต่อ (อ่านก่อนแก้ทุกครั้ง)
data-private/     ข้อมูลพนักงานจริง — อยู่ใน .gitignore ห้าม commit
```

## เริ่มต้นเร็ว
1. Supabase → SQL Editor → รัน `sql/00_schema.sql` แล้วไฟล์ `10`, `20`, `30` ตามลำดับ
2. Apps Script → Script Properties: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
3. `clasp push` (ดูด้านล่าง) หรือสร้างไฟล์ใน Editor ให้ชื่อตรงกับ `src/`
4. รัน `testConnection` → ทุกบรรทัดต้องขึ้น ✓
5. Deploy → Web app · Execute as **Me** · Access **Anyone** · แก้โค้ดทุกครั้งต้อง **New version**

รายละเอียดเต็ม: [docs/SETUP.md](docs/SETUP.md) · กระบวนการ: [docs/PROCESS.md](docs/PROCESS.md)

## Deploy (แนะนำ: อัตโนมัติ)
push เข้า `main` แล้ว GitHub Actions จะ `clasp push` + Deploy New version ให้เอง — ตั้งค่าครั้งเดียวตาม [docs/DEPLOY.md](docs/DEPLOY.md)

หรือ push จากเครื่องตัวเอง:
```bash
npx @google/clasp@2.4.2 login
cp .clasp.json.example .clasp.json            # ใส่ scriptId ของโปรเจกต์
npx @google/clasp@2.4.2 push --force          # อัปโหลด src/ ขึ้น Apps Script
npx @google/clasp@2.4.2 deploy -i <deploymentId>   # อัปเดต Web app เดิมเป็นเวอร์ชันใหม่
```
