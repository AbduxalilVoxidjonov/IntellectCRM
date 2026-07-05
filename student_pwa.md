# Student PWA — O'quvchi ilovasi

## Umumiy tavsif

**Student PWA** — o'quvchi va ota-ona uchun mobil web ilova (Progressive Web App). Telefonda Chrome/Safari orqali o'rnatib olish mumkin yoki veb-brauzerda echilishi mumkin. O'quvchi o'z davomat, baholar, topshiriqlar, kurs progressi va maktab bilan bog'lanish qilish uchun ishlatadi.

**Foydalanuvchilar:** O'quvchi, Ota-ona (o'qish huquqi bilan)  
**URL:** `/student/` dan boshlanadi  
**Design:** Blue UI-kit, 480px-ga markazlashtirilgan, pastki 5-tab navigatsiya

---

## Joylashuvi

### Frontend fayllar (IntellectCRM.Client)

```
IntellectCRM.Client/
├── index.html                                # PWA meta teglar, manifest link
├── src/
│   ├── App.tsx                              # Route'lar (/student/*)
│   ├── pages/student/
│   │   ├── Dashboard.tsx                    # Bosh ekran (salom, darslar, baholar)
│   │   ├── Progress.tsx                     # O'quvchi dasturi bo'yicha progress
│   │   ├── SubjectProgressDetail.tsx        # Bir fan bo'yicha tafsilot
│   │   ├── Grades.tsx                       # Baholar jadvali
│   │   ├── Attendance.tsx                   # Davomat
│   │   ├── Discipline.tsx                   # Intiza (urg'u/javob ballari)
│   │   ├── Statistics.tsx                   # Hisobotlar
│   │   ├── Assignments.tsx                  # Topshiriqlar (ro'yxat)
│   │   ├── AssignmentDetail.tsx             # Topshiriq tafsiloti
│   │   ├── LmsTopics.tsx                    # Bitta kurs bo'yicha dars mavzulari
│   │   ├── LmsTopicDetail.tsx               # Mavzu tafsiloti (material, video)
│   │   ├── Chat.tsx                         # Guruh chati
│   │   ├── Finance.tsx                      # To'lov holati, balans
│   │   ├── Feedback.tsx                     # Fikr/shikoyat yuborish
│   │   ├── Profile.tsx                      # Profil (ism, tug'ilgan kun, kirish sanasi)
│   │   ├── Settings.tsx                     # Sozlamalar (tema, bildirishnoma)
│   │   ├── Location.tsx                     # Maktab joylashuvi (xarita)
│   │   ├── Lesson.tsx                       # Dars tafsiloti
│   │   ├── Grading.tsx                      # O'qituvchi qaytargan baha
│   │   ├── AiCheck.tsx                      # AI topshiriq tekshiruvi
│   │   ├── Support.tsx                      # Qo'llab-quvvatlash
│   │   ├── Account.tsx                      # Akkaunt o'zgartirilishi
│   │   ├── Certificates.tsx                 # Sertifikatlar
│   │   └── lib.ts                           # Yordamchi funksiyalar (Icon, formatlar)
│   ├── components/layout/
│   │   └── StudentMobileLayout.tsx          # Layout qobiq (5-tab nav)
│   ├── api/services/
│   │   ├── studentPortal.ts                 # API funksiyalari (/api/student/*)
│   │   └── (boshqa service'lar)
│   ├── context/
│   │   └── auth-context.ts                  # JWT token, login/logout
│   └── ...
├── public/
│   ├── favicon.svg                          # Asosiy ikonka (vektorli)
│   ├── icons.svg                            # Boshqa ikonkalar sprite
│   └── firebase-messaging-sw.js             # Push bildirishnoma service worker
├── vite.config.ts                           # Vite qo'llanmasi (PWA plugin yo'q)
└── package.json                             # Dependencies

```

### Backend API (IntellectCRM.Server)

```
IntellectCRM.Server/Controllers/
├── StudentPortalController.cs               # /api/student/* (yo'l: ruxsatlar)
└── PublicTestController.cs                  # /api/public/manifest.webmanifest (manifest endpoint)
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

**Dinamik manifest nima:**
- Markaz nomi va logo `CenterMeta` jadvaldagi qiymatlardan olinadi
- Logo bo'lmasa `/favicon.svg` ishlatiladi
- Brauzer PWA o'rnatishda bu manifest'ni o'qiydi

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
- Ilova o'rnatilganda darhol faollashib (`skipWaiting()`)
- Bildirishnoma bosilganda ilovani fokuslay yoki ochadi

**Sozlama:**
```javascript
// Self-activate: ilova darhol tayyor
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Bildirishnoma click → ilovani ochish
self.addEventListener('notificationclick', (event) => { ... })
```

**Push qabuli:** Backend `api/public/push-config` endpointdan VAPID kaliti va Firebase qo'llanmasini qaytaradi.

---

### 3. Ikonkalar va Brending

| Fayl | O'lchami | Format | Maqsad |
|------|----------|--------|--------|
| `/favicon.svg` | Any | SVG | Brauzer tebasi + iOS home screen |
| `/icons.svg` | Sprite | SVG | StudentMobileLayout'ning icon komponenti |

---

## O'rnatish yo'riqnomasi

### Android (Chrome)

1. **Ilovani ochish:** Telefon Chrome'da `https://crm.intellectschool.uz/student` kiriting
2. **Prompt:** Brauzer yuqorida "Bosh ekranga qo'shish" yoki "O'rnatish" tugmasi chiqadi
3. **Tasdiqlash:** "O'rnatish" bosing → ilova Homescreen'ga qo'shiladi
4. **Ishlatish:** Ikonka bosib ilova ochiladi (full-screen mode)

### iOS (Safari)

1. **Ilovani ochish:** Safari'da `https://crm.intellectschool.uz/student` kiriting
2. **Ulashish tugmasi:** Brauzer pastki (yoki yuqori) "Ulashish" (`...`) menyusini bosing
3. **"Bosh ekranga qo'shish"** — tanlang (bu PWA o'rnatish emas, lekin Homescreen'ga shortcut qo'shadi)
4. **Nomi:** "O'quv markazi" (manifest.short_name)
5. **Ikonka:** apple-touch-icon `/favicon.svg`

### Web Brauzer (PC/Laptop)

1. **URL:** `https://crm.intellectschool.uz/student`
2. **Bookmarklet orqali:** Yildig'iga qo'shish yoki manbar shaxsiy yorlig'iga qo'shish

---

## Login/Auth oqimi

1. **Kirish sahifasi:** `/login`
   - Email va parol kiriting
   - Backend `/api/auth/login` ga so'rov
   - Javobda `token` (JWT) + `user` (`{ id, role, fullName, ... }`)

2. **Token saqlash:**
   ```typescript
   // src/context/auth-context.ts
   localStorage.setItem('token', token)
   localStorage.setItem('user', JSON.stringify(user))
   ```

3. **Auto-navigatsiya:**
   - `role === "student"` → `/student` yo'naltiriladi
   - `role === "parent"` → `/student` (farzandi tanlash)

4. **API so'rovlar:**
   ```javascript
   // Har so'rovda Authorization header
   Authorization: `Bearer ${token}`
   ```

5. **Logout:** Token o'chiriladi, `/login` ga qaytish

---

## Asosiy ekranlar (5-tab)

### 1. **Dashboard** (`/student`)
- Salom + bugungi darslar
- To'gg'ri yakinda qolgan baholar
- Balans va oy to'lovi miqdori
- Tekshirilmagan bildirishnomalar

### 2. **Progress** (`/student/progress`)
- O'quvchi kurslari bo'yicha o'rganish bosqichi (%)
- Har kurs bo'lsa: tafsilot sahifasiga o'tish (`/progress/subject/:id`)

### 3. **Topshiriq** (`/student/assignments`)
- Tegishli topshiriqlar ro'yxati
- Status: Bajarildi / Topshirilmadi / To'ldirilmoni kutilmoqda
- Bosib: `/assignments/:id` ga tafsilot

### 4. **Chat** (`/student/chat`)
- Guruh uchun SignalR chati
- Xabar yuborish (text, emoji, media)
- O'qituvchi/o'quvchi/boshqalar bilan real-time

### 5. **Profil** (`/student/profile`)
- Shaxsiy ma'lumot (ism, kirish sanasi, tug'ilgan kun)
- Ota-ona aloqasi (telefon)
- Fotosurati
- Profil o'zgartirilishi + Settings ta'kickida tema

---

## Backend API bog'lanishi

### Asosiy endpointlar (`/api/student/*`)

| Metod | Endpoint | Maqsad |
|-------|----------|--------|
| `GET` | `/dashboard` | Dashboard ma'lumotlari (darslar, baholar) |
| `GET` | `/notebook` | O'quvchining mashgulotlar (homework) |
| `GET` | `/school` | Markaz nomi (brending) |
| `GET` | `/notifications` | Bildirishnomalar |
| `POST` | `/notifications/read` | Barcha bildirishnomalarni "o'qilgan" qilish |
| `POST` | `/notifications/{id}/confirm` | Bir bildirishnomani tasdiqlash |
| `GET` | `/grades` | Baholar jadvali |
| `GET` | `/attendance` | Davomat |
| `GET` | `/discipline` | Intiza (ballar) |
| `GET` | `/assignments` | Topshiriqlar |
| `GET` | `/assignments/{id}` | Bir topshiriq tafsiloti |
| `POST` | `/assignments/{id}/submit` | Topshiriqni topshirish (fayl + matn) |
| `GET` | `/chat` | Chati xabarlar |
| `POST` | `/chat/send` | Xabar yuborish |
| `GET` | `/finance` | Balans, to'lovlar |
| `GET` | `/profile` | Profil |
| `PUT` | `/profile` | Profilni tahrirlash |

**Muhim:** Barcha so'rovlarda JWT `Authorization` header qo'shiladi (axios interceptor).

### Qo'shimcha

- **Real-time chati:** SignalR Hub `/hubs/chat` (WebSocket)
- **Push bildirishnomalari:** FCM token registration + `/api/public/push-config`
- **Fayl yuklash:** `/uploads/` (images, documents)

---

## Sosyal tarmoq integratsiyasi

- **Telegram:** Markaz Telegram kanali linkiga ("Kanalga obuna bo'lish" tugmasi)
- **Bildirishnomalar:** 
  - Push (mobile + desktop)
  - Telegram (agar bog'langan bo'lsa)
  - SMS (Eskiz orqali)

---

## Tema va Sozlamalar

**Ikkita tema:** Light (standart) va Dark

```typescript
// localStorage'dan o'qiladi
student_theme: 'light' | 'dark'
```

**Tema o'zgartirish:** Settings → Tema tanlash → `window.dispatchEvent(new Event('student:theme'))` → barcha komponentlar yangilanadi

---

## Deskktop hamda Mobil Moslashuvchiligi

- **Mobil (< 1024px):** Pastki 5-tab navigatsiya ko'rinadi, yon sidebar yashiriladi
- **Desktop (>= 1024px):** Yon sidebar ko'rinadi, pastki tab nav yashiriladi (CSS @media)
- **Viewport:** `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`

---

## Qisqacha malaka

- **Qurilma surati sifatida o'rnatish uchun zarurligi:** Manifest + Service Worker + HTTPS + "installable" CSS
- **Ishlash:** Offline rejimda (service worker cache qo'shimcha sozlansa) o'z ichki kontentni ko'rsatadi
- **Push:** Backend FCM token orqali bildirishnoma yuboradi — device WakeLock bo'lsa telegram/SMS xabar kunaen
- **Tez:** Vite build bundle chunking (React alohida chunk) — app code o'zgarsa ham brauzer React qayta yuklamaydi
