# Teacher PWA — O'qituvchi ilovasi

## Umumiy tavsif

**Teacher PWA** — o'qituvchi uchun mobil web ilova (Progressive Web App). Telefonda Chrome orqali o'rnatib olish yoki Flutter WebView ichida ishlatiladi. O'qituvchi jurnal (davomat, baholar), topshiriqlar, xabarlar, maosh ma'lumotlari va boshqa boshqaruv funksiyalarini qiladi.

**Foydalanuvchilar:** O'qituvchi (teacher rol)  
**URL:** `/teacher/` dan boshlanadi  
**Design:** Teal UI-kit, pastki 5-tab navigatsiya (mobil), desktop sidebar ham bor

---

## Joylashuvi

### Frontend fayllar (IntellectCRM.Client)

```
IntellectCRM.Client/
├── index.html                                # PWA meta teglar, manifest link
├── src/
│   ├── App.tsx                              # Route'lar (/teacher/*)
│   ├── pages/teacher/
│   │   ├── TeacherDashboard.tsx             # Bosh ekran (darslar, statistika)
│   │   ├── groups/
│   │   │   ├── TeacherGroupsPage.tsx        # Jurnal — darslar ro'yxati
│   │   │   └── TeacherGroupDetailPage.tsx   # Dars jurnali (davomat + baholar)
│   │   ├── evaluation/
│   │   │   └── EvaluationPage.tsx           # O'quvchilarga baho qo'yish
│   │   ├── assignments/
│   │   │   └── AssignmentsPage.tsx          # Topshiriqlar yaratish/tahrirlash
│   │   ├── lms/
│   │   │   ├── TeacherLmsPage.tsx           # LMS kurslar ro'yxati
│   │   │   └── TeacherLmsSubjectPage.tsx    # Bir kurssining dars mavzulari
│   │   ├── messages/
│   │   │   └── MessagesPage.tsx             # Guruh chati
│   │   ├── feedback/
│   │   │   └── FeedbackPage.tsx             # O'quvchi fikri/shikoyati
│   │   ├── support/
│   │   │   └── SupportPage.tsx              # Qo'llab-quvvatlash (support ticket)
│   │   ├── salary/
│   │   │   └── SalaryPage.tsx               # Maosh info (fixed/percent rejimi)
│   │   ├── coverage/
│   │   │   └── CoveragePage.tsx             # Dars berish vaqtini to'ldirish
│   │   ├── learning/
│   │   │   └── LearningPage.tsx             # Professional development
│   │   ├── profile/
│   │   │   └── TeacherProfilePage.tsx       # Profil (ism, email, fotosurati)
│   │   ├── account/
│   │   │   └── AccountPage.tsx              # Akkaunt o'zgartirilishi (parol, email)
│   │   └── TeacherProfilePage.tsx           # (alternativ profil)
│   ├── components/layout/
│   │   └── TeacherMobileLayout.tsx          # Layout qobiq (5-tab nav + sidebar)
│   ├── api/services/
│   │   ├── teacher.ts                       # API funksiyalari (/api/teacher/*)
│   │   └── (boshqa service'lar)
│   ├── context/
│   │   ├── auth-context.ts                  # JWT token
│   │   └── unread-context.ts                # O'qilmagan xabarlari sanayish
│   └── ...
├── public/
│   ├── favicon.svg                          # Asosiy ikonka
│   ├── icons.svg                            # Ikonkalar sprite
│   └── firebase-messaging-sw.js             # Push bildirishnoma service worker
├── vite.config.ts                           # Vite qo'llanmasi
└── package.json                             # Dependencies

```

### Backend API (IntellectCRM.Server)

```
IntellectCRM.Server/Controllers/
├── TeacherPortalController.cs               # /api/teacher/* (yo'l: ruxsatlar)
└── PublicTestController.cs                  # /api/public/manifest.webmanifest
```

---

## PWA infratuzilma

### 1. Manifest (Dinamik)

**Endpointi:** `GET /api/public/manifest.webmanifest`

**Mazmuni (misol):**
```json
{
  "name": "O'quv markazi",
  "short_name": "O'quv mark",
  "description": "O'quv markazi — o'quvchi va o'qituvchi portali",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4f46e5",
  "icons": [
    {
      "src": "<markazning_logosi>",
      "sizes": "96x96 192x192 512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Dinamik manifest:**
- Markaz nomi va logo `CenterMeta` jadvaldagi qiymatlardan olinadi
- Ilova o'rnatilganda bu manifest brauzer tomonidan o'qiladi

**index.html'da ro'yxatboti:**
```html
<link rel="manifest" href="/api/public/manifest.webmanifest" />
<meta name="theme-color" content="#4f46e5" />
<link rel="apple-touch-icon" href="/favicon.svg" />
```

---

### 2. Service Worker

**Fayli:** `public/firebase-messaging-sw.js`

**Maqsadi:**
- Firebase Cloud Messaging (FCM) push bildirishnomalari
- Darhol faollashib (`skipWaiting()`) — ilova tez tayyor
- Bildirishnoma bosilganda ilovani ochadi

**Sozlama:**
```javascript
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('notificationclick', (event) => { ... })
```

**Push qabuli:** Firebase integration — `api/public/push-config` endpointdan config va VAPID kaliti.

---

### 3. Ikonkalar

| Fayl | Format | Maqsad |
|------|--------|--------|
| `/favicon.svg` | SVG | Home screen + browser tab |
| `/icons.svg` | SVG Sprite | TeacherMobileLayout'ning bottom tab va sidebar ikonkalari |

---

## O'rnatish yo'riqnomasi

### Android (Chrome)

1. **Ilovani ochish:** Chrome'da `https://crm.intellectschool.uz/teacher` kiriting
2. **O'rnatish tugmasi:** Brauzer "O'rnatish" prompt chiqadi
3. **Tasdiqlash:** "O'rnatish" — ilova Homescreen'ga qo'shiladi
4. **Ishlatish:** Ikonka bosib ilova full-screen (standalone) modida ochiladi

### Flutter WebView (Android Agent)

- Backend Flutter ilova Android o'qituvchining telefoniga o'rnatiladi
- WebView ichida `/teacher/` URL ochiladi
- Manifest + Service Worker avtomatik ishlaydi

### iOS (Safari)

1. **Safari'da:** `https://crm.intellectschool.uz/teacher` kiriting
2. **Ulashish:** Safari ulashish menyusu → "Bosh ekranga qo'shish"
3. **Nomi:** Manifest'dagi `short_name` ("O'quv mark")
4. **Ikonka:** Apple touch icon `/favicon.svg`

### Web Brauzer (PC/Laptop)

1. **URL:** `https://crm.intellectschool.uz/teacher`
2. **Bookmarklet yoki manbar qo'shish**

---

## Login/Auth oqimi

1. **Kirish sahifasi:** `/login`
   - Email va parol
   - Backend `/api/auth/login` so'rovi
   - Javobda JWT token + user object

2. **Token saqlash:**
   ```typescript
   localStorage.setItem('token', token)
   localStorage.setItem('user', JSON.stringify(user))
   ```

3. **Auto-navigatsiya:**
   - `role === "teacher"` → `/teacher` yo'naltiriladi

4. **API so'rovlar — JWT header:**
   ```javascript
   Authorization: `Bearer ${token}`
   ```

5. **Logout:** Token o'chiriladi, `/login` ga qaytish

---

## Asosiy ekranlar (5-tab)

### 1. **Bosh (Dashboard)** (`/teacher`)
- Salom xabar
- Bugun dars beradigan guruhlar
- Joriy statistika (o'quvchi, baholar, davomat)
- Yaqinda o'tkazilishi kerak bo'lgan vazifalar
- O'qilmagan xabarlari sanayish

### 2. **Jurnal** (`/teacher/journal`)
- O'qituvchining barcha guruhlar ro'yxati
- Har guruhga bosish → jurnali (davomat, baholar, dars o'tkazildi-yo'q)
- Jurnal boshqaruvini tahrirlash (policy modal)
- Dars qo'shish / Davomat belgilash / Baho qo'yish

### 3. **Vazifa** (`/teacher/assignments`)
- O'qituvchi tomonidan yaratilgan topshiriqlar
- Yangi topshiriq yaratish
- Topshiriqni tahrirlash / o'chirish
- Natijalari ko'rish (kim topshirdi / kim topshirmadi)

### 4. **Suhbat (Messages)** (`/teacher/messages`)
- Guruh chati (SignalR WebSocket)
- Xabar yuborish (text, emoji, media)
- O'quvchi/ota-ona/o'qituvchilar bilan real-time

### 5. **Profil** (`/teacher/profile`)
- Shaxsiy ma'lumot (ism, email)
- Fotosurati
- O'z fanlarining ro'yxati
- Profil o'zgartirilishi (Settings yoki Account tab)
- Tema sozlamasi (light/dark)

---

## Qo'shimcha sahifalar (sidebar / mobil menu'dan)

- **Evaluation** — O'quvchilarga baho qo'yish (fan/oy bo'yicha)
- **LMS** — Kurs bo'yicha dars mavzulari
- **Feedback** — O'quvchi shikoyati
- **Support** — Qo'llab-quvvatlashga murojaat
- **Salary** — Maosh ma'lumotlari (fixed/percent rejimi)
- **Coverage** — Dars berish vaqtini to'ldirish
- **Learning** — Professional development
- **Account** — Akkaunt (parol, email o'zgartirilishi)

---

## Backend API bog'lanishi

### Asosiy endpointlar (`/api/teacher/*`)

| Metod | Endpoint | Maqsad |
|-------|----------|--------|
| `GET` | `/me` | O'qituvchi profili |
| `GET` | `/meta` | Umumiy meta (dars vaqtlari, sabablar) |
| `GET` | `/school` | Markaz nomi va brending |
| `GET` | `/notifications` | Bildirishnomalar |
| `POST` | `/notifications/read` | Barcha bildirishnomalarni o'qilgan qilish |
| `GET` | `/classes` | O'qituvchining guruhlar ro'yxati |
| `GET` | `/classes/{id}` | Bir guruhning tafsiloti |
| `GET` | `/journal` | Jurnal ma'lumotlari (darslar, davomat) |
| `PUT` | `/journal/notes` | Jurnal qo'shish/tahrirlash (dars, baho, davomat) |
| `DELETE` | `/journal/notes/{id}` | Jurnal qatorini o'chirish |
| `GET` | `/evaluation/types` | Baho turlari (1-5, A-F va h.k.) |
| `GET` | `/evaluation/board` | Baho jadvali (guruh + fan + oy) |
| `POST` | `/evaluation/grade` | Bitta o'quvchiga baho qo'yish |
| `GET` | `/assignments` | O'qituvchining topshiriqlar ro'yxati |
| `POST` | `/assignments` | Yangi topshiriq yaratish |
| `PUT` | `/assignments/{id}` | Topshiriqni tahrirlash |
| `DELETE` | `/assignments/{id}` | Topshiriqni o'chirish |
| `GET` | `/messages` | Guruh chati xabarlari |
| `POST` | `/messages` | Xabar yuborish |
| `GET` | `/salary` | Maosh ma'lumotlari |

**Muhim:** Barcha so'rovlarda JWT `Authorization` header (axios interceptor tomonidan avtomatik).

### Real-time

- **Chati:** SignalR Hub `/hubs/chat` (WebSocket)
- **Bildirishnomalar:** FCM push registration + `/api/public/push-config`

---

## Tema va Sozlamalar

**Ikkita tema:** Light va Dark

```typescript
// localStorage'dan o'qiladi
teacher_theme: 'light' | 'dark'
```

**Tema o'zgartirish:** Account/Settings → Tema tanlash → `window.dispatchEvent(new Event('teacher-theme'))` → komponentlar yangilanadi

---

## Desktop hamda Mobil Moslashuvchiligi

- **Mobil (< 1024px):** Pastki 5-tab navigatsiya ko'rinadi, sidebar yashiriladi
- **Desktop (>= 1024px Breakpoint: `lg`):** Chap sidebar ko'rinadi (user nomi, ikonka, navigatsiya), pastki tab nav yashiriladi
- **Sidebar (Desktop):** Teal rangga bo'yalgan, user initials bilan badge, active tab highlight
- **Viewport:** `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`

---

## O'qilmagan Xabarlari Indikatori

- **Context:** `unread-context.ts` — `useUnread()` hook
- **Badge:** Suhbat tabida o'qilmagan xabarlari nuqtasi (red dot)
- **Real-time:** SignalR orqali xabar kelganda avtomatik yangilanadi

---

## Qisqacha malaka

- **Qurilmada o'rnatish:** Manifest + Service Worker + HTTPS
- **Offline:** Service worker cache qo'shimcha sozlanib qo'shilsa, offline rejimda asosiy kontentni ko'rsatadi
- **Push bildirishnomalari:** Firebase FCM — backend tomonidan xabar yuboriladi
- **Jurnali tahrirlash siyosati:** `CenterMeta.JournalEditMode` (free/today/window) — ruxsat tekshiriladi
- **Vite bundling:** React chunk alohida, ilova kodi o'zgarsa ham React qayta yuklanmaydi
- **Ishga tushirilish:** Standart URL orqali yoki Flutter WebView'da (login form kerak bo'lsa faqat birinchi marta)
