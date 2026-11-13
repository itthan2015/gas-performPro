# Deploy อัตโนมัติ: git push → Apps Script

เมื่อ push เข้า branch `main` และมีการแก้ไฟล์ใน `src/` GitHub Actions (`.github/workflows/deploy-gas.yml`) จะ
1. รันเทส `tests/scoring.test.js` + `tests/server.test.js` (ไม่ผ่าน = ไม่ deploy)
2. `clasp push --force` อัปโหลดทุกไฟล์ใน `src/` ขึ้นโปรเจกต์ Apps Script
3. ถ้าตั้ง `GAS_DEPLOYMENT_ID` ไว้ → `clasp deploy -i …` = **Deploy New version** ของ Web app เดิม (URL ไม่เปลี่ยน)

> ⚠️ `clasp push` ทำให้ไฟล์ใน Apps Script **ตรงกับ `src/` ทุกไฟล์** — ไฟล์ที่มีใน Editor แต่ไม่มีใน `src/` จะถูกลบ
> แก้โค้ดที่ GitHub เท่านั้น อย่าแก้ใน Editor (จะถูกทับรอบถัดไป)

## ตั้งค่าครั้งเดียว

### 1. เปิด Apps Script API
https://script.google.com/home/usersettings → **Google Apps Script API: On** (บัญชีเดียวกับเจ้าของโปรเจกต์)

### 2. ล็อกอิน clasp ในเครื่องตัวเอง แล้วเอา credential
ต้องมี Node.js ในเครื่อง ใช้ clasp **เวอร์ชัน 2.4.2** ให้ตรงกับ workflow
```bash
npx @google/clasp@2.4.2 login
```
เบราว์เซอร์จะให้เลือกบัญชี Google (เจ้าของโปรเจกต์) → Allow
จากนั้นเปิดไฟล์ `~/.clasprc.json` (Windows: `C:\Users\<ชื่อ>\.clasprc.json`) แล้วคัดลอก **ทั้งไฟล์**

> ไฟล์นี้คือสิทธิ์เข้าถึง Apps Script/Drive ของบัญชีคุณ — ใส่ใน GitHub Secrets เท่านั้น ห้าม commit / ห้ามส่งในแชต
> ถ้าหลุด: https://myaccount.google.com/permissions → ลบสิทธิ์ของ "clasp" แล้วล็อกอินใหม่

### 3. ตั้งค่าใน GitHub
Repo → **Settings → Secrets and variables → Actions**

| ประเภท | ชื่อ | ค่า | หาได้ที่ |
| --- | --- | --- | --- |
| Secrets (แท็บ Secrets) | `CLASPRC_JSON` | เนื้อหาไฟล์ `~/.clasprc.json` ทั้งไฟล์ | ข้อ 2 |
| Variables (แท็บ Variables) | `GAS_SCRIPT_ID` | Script ID | Apps Script Editor → ⚙ Project Settings → IDs → **Script ID** |
| Variables (แท็บ Variables) | `GAS_DEPLOYMENT_ID` | Deployment ID ของ Web app (ไม่บังคับ) | Deploy → Manage deployments → เลือก Web app → **Deployment ID** (ขึ้นต้น `AKfycb…` คือส่วนใน URL `/macros/s/<ID>/exec`) |

ไม่ใส่ `GAS_DEPLOYMENT_ID` = push โค้ดอย่างเดียว ต้องกด Deploy → Manage deployments → New version เอง

### 4. ทดสอบ
Repo → **Actions → Deploy to Apps Script → Run workflow** (branch main) → ดูว่าทุกขั้นเป็นสีเขียว
แล้วเปิด Editor ดูว่าไฟล์อัปเดต · เปิด URL Web app ดูว่าเป็นเวอร์ชันใหม่

## หลังตั้งค่าแล้ว
- แก้โค้ด → commit → `git push` เข้า main → รอ ~1 นาที เสร็จ (ดูสถานะที่แท็บ Actions)
- SQL migration ยังต้องรันใน Supabase เอง (ดู CHANGELOG)
- Script Properties (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `LOGO_URL` …) ไม่ถูกแตะ

## แก้ปัญหา
| อาการ | สาเหตุ / วิธีแก้ |
| --- | --- |
| ขั้น Check settings ขึ้นเตือน "ข้ามการ deploy" | ยังไม่ได้ตั้ง `GAS_SCRIPT_ID` หรือ `CLASPRC_JSON` |
| `User has not enabled the Apps Script API` | ทำข้อ 1 แล้วรอ 2–3 นาที แล้ว Re-run |
| `invalid_grant` / `Could not read API credentials` | credential หมดอายุหรือถูกเพิกถอน → ทำข้อ 2 ใหม่ แล้วอัปเดต Secret |
| `Requested entity was not found` | Script ID ผิด หรือบัญชีที่ล็อกอินไม่มีสิทธิ์แก้โปรเจกต์ |
| deploy ไม่ผ่านแต่ push ผ่าน | Deployment ID ผิด (ต้องเป็นของ Web app ที่มีอยู่) |

## ทางเลือก: push จากเครื่องตัวเอง
```bash
npx @google/clasp@2.4.2 login
cp .clasp.json.example .clasp.json            # ใส่ scriptId
npx @google/clasp@2.4.2 push --force
npx @google/clasp@2.4.2 deploy -i <deploymentId> -d "คำอธิบาย"
```
