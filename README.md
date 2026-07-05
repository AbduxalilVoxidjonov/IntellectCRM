<div align="center">

# 🎓 IntellectCRM

### Bitta o'quv markazi uchun zamonaviy CRM + LMS platformasi

Lidlar (CRM) · O'quvchilar · Guruhlar · Moliya · Jurnal · O'quv dasturi · 3 ta alohida portal

![.NET](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

</div>

---

## ✨ Umumiy ma'lumot

**IntellectCRM** — o'quv markazlari uchun mo'ljallangan, lidlardan tortib to'lovlargacha bo'lgan
butun jarayonni boshqaradigan to'liq CRM/LMS tizimi. Bitta backend uch xil foydalanuvchiga
xizmat qiladi:

| Portal | Foydalanuvchi | Dizayn | Holati |
|---|---|---|---|
| 🟣 **Admin panel** | Markaz ma'muriyati | Violet · Desktop | To'liq |
| 🟢 **O'qituvchi ilovasi** | O'qituvchilar | Teal · Mobil (WebView) | To'liq |
| 🔵 **O'quvchi ilovasi** | O'quvchi / ota-ona | Blue · Mobil (WebView) | To'liq |

> Bitta Flutter WebView ilovadan o'qituvchi ham, o'quvchi ham kira oladi — rolga qarab tegishli portal ochiladi.

---

## 🧩 Texnologiyalar

**Backend**
- ASP.NET Core 8 (C#) — **Clean Architecture**
- Entity Framework Core 8 + **PostgreSQL** (inkremental migratsiyalar)
- **SignalR** (real-time chat / turniket) · **JWT** auth
- **FCM** (push) · **Telegram bot** · **OpenXML** (shartnoma/hisobot)

**Frontend**
- React 19 + TypeScript + **Vite**
- **Tailwind CSS** (admin) + custom CSS dizayn-tizimlari (teacher/student portallari)
- Recharts (admin grafiklar) · lucide ikonkalar · React Router

**Infratuzilma**
- **Docker Compose** (app + SQL Server + cloudflared + backup)
- **Cloudflare Tunnel** (port internetga ochilmaydi)

---

## 🏛 Solution tuzilishi

```
IntellectCRM.slnx
├── IntellectCRM.Domain          # Entitylar, Rollar (sof biznes modeli)
├── IntellectCRM.Application      # Servislar, DTO'lar, Abstraksiyalar, SignalR Hub'lar
├── IntellectCRM.Infrastructure   # AppDbContext, EF migratsiyalar
├── IntellectCRM.Server           # Controllers, Program.cs, appsettings
└── IntellectCRM.Client           # React SPA (admin + teacher + student portallari)
```

---

## 🚀 Asosiy imkoniyatlar

### 🟣 Admin panel
- **CRM / Lidlar** — kanban, sinov darslari, konversiya, statistika
- **O'quvchilar** — profil, ko'p-guruh a'zoligi, daftar (oyma-oy), to'lov tarixi
- **Guruhlar** — kurs + o'qituvchi + dars kunlari/vaqti; oylik jurnal
- **Kurslar + O'quv dasturi** — daraja → mavzu → band ierarxiyasi (Excel import)
- **Moliya** — kirim/chiqim, oylik hisoblash, **kurs/guruh bo'yicha daromad hisoboti**
- **Maosh** — qat'iy yoki guruhdan yig'ilgan to'lovning foizi
- **Daraja testi** — ommaviy test → avtomatik lid
- **Topshiriqlar · Xabarlar · Intizomiy ball · Shartnomalar · Arxiv**

### 🟢 O'qituvchi ilovasi (mobil)
- Guruhga kirib **oylik jurnal** (baho/davomat) yuritish
- **O'quv dasturi o'tilishi** + tugash prognozi (sana bilan)
- Topshiriqlar · Guruh chati · O'z maoshi · Baholash

### 🔵 O'quvchi ilovasi (mobil)
- **Duolingo uslubidagi o'quv dasturi yo'l-xaritasi** (o'tilgan/qolgan + prognoz)
- **Umumiy statistika** — diagrammalarda (baholar trendi, davomat, intizom, feedback, topshiriqlar)
- Baholar · Davomat · Intizom · To'lovlar · Reyting · Chat
- Telegram kanalga o'tish · Push bildirishnomalar

---

## 💳 Billing mantig'i (qisqacha)

- **A'zolik holati:** `trial` (sinov, to'lovsiz) · `active` · `frozen`
- **Aktivlashtirish** — birinchi oy qisman (qolgan darslar nisbatida)
- **Muzlatish** — o'tilgan darslar uchun qisman hisob
- **Oylik hisob** — faqat faol a'zoliklarning `MonthlyFee` yig'indisi (per-guruh)

---

## 🛠 Ishga tushirish

### Talablar
- .NET 8 SDK · Node.js 20+ · SQL Server (lokal: LocalDB) yoki Docker

### Lokal (development)
```bash
# Backend (API + avtomatik migratsiya, baza: IntellectCRM_DB)
dotnet run --project IntellectCRM.Server

# Frontend (ixtiyoriy dev server)
cd IntellectCRM.Client
npm install
npm run dev
```

### Build
```bash
# Backend (SPA'siz — tez)
dotnet build IntellectCRM.Server/IntellectCRM.Server.csproj -p:BuildSpa=false

# Frontend
cd IntellectCRM.Client && npx tsc -b && npm run build
```

### Docker (production)
```bash
docker compose up -d --build
```
`.env` fayli (git'ga tushmaydi): `APP_HOST`, `MSSQL_SA_PASSWORD`, `JWT_KEY`, `TUNNEL_TOKEN`,
`OWNER_LOGIN`/`OWNER_PASSWORD` (super-admin bootstrap) va h.k.

---

## 🗄 Migratsiyalar

Sxema o'zgarganda **inkremental** migratsiya qo'shiladi (baza buzilmaydi, ma'lumot saqlanadi):

```bash
dotnet build IntellectCRM.Server/IntellectCRM.Server.csproj -p:BuildSpa=false
dotnet ef migrations add <Nom> --project IntellectCRM.Infrastructure \
  --startup-project IntellectCRM.Server --no-build
```
App ishga tushganda `Migrate()` mavjud bazaga `ALTER` qo'llaydi.

---

## 🔔 Push bildirishnoma (Flutter)

1. **Firebase** loyiha → Service Account JSON ni **Admin → Sozlamalar → Push (Firebase)** ga qo'ying.
2. Flutter ilovaga shu loyihaning `google-services.json` ni qo'ying, FCM tokenni `window.__FCM_TOKEN__`
   ga (yoki `postMessage`) bering.
3. Web (`AuthProvider`) login'da tokenni avtomatik ro'yxatdan o'tkazadi, logout'da o'chiradi.

---

## 📁 Diqqatga sazovor jihatlar

- **Multi-tenant YO'Q** — bitta markazga moslangan (sodda va tez)
- **Choraklar olib tashlangan** — barcha hisob **oyma-oy** (monthly)
- **3 ta mustaqil dizayn-tizimi** — admin (violet), teacher (teal), student (blue) — bir-biriga ta'sir qilmaydi
- **Kunlik avtomatik backup** — `BACKUP DATABASE` → gzip, 7 kun saqlanadi

---

<div align="center">

**IntellectCRM** · ASP.NET Core 8 + React · Private repository

</div>
