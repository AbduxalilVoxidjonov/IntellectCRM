# IntellectCRM — O'qituvchi (Teacher) API hujjati

O'qituvchi ilovasi uchun to'liq API dokumentatsiya. Kotlin (Retrofit) yoki boshqa mobile frameworkda Android ilova yozish uchun mo'ljallangan.

## Asosiy ma'lumot

- **BaseUrl:** `https://crm.intellectschool.uz`
- **Protocol:** HTTPS (majburiy)
- **Format:** JSON (camelCase)
- **Auth:** JWT (Bearer token)
- **Header:** `Authorization: Bearer <token>`

---

## 1. Autentifikatsiya (Auth)

### 1.1 Kirish (Login)

O'qituvchi email va parol bilan tizimga kiradi.

| Parametr | Qiymat |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/auth/login` |
| **Auth** | Yo'q (AllowAnonymous) |
| **Rate Limit** | Bor (login uchun xuddi shu) |

**So'rov (Request):**
```json
{
  "email": "teacher@example.com",
  "password": "securePassword123"
}
```

**Javob (Response):** HTTP 200
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "teacher-id-123",
    "fullName": "Akmal Ergashev",
    "role": "teacher",
    "email": "teacher@example.com",
    "avatarUrl": "/avatars/photo.jpg",
    "permissions": ["journal", "salary", "messages", "assignments"],
    "phone": "+998-90-123-45-67"
  }
}
```

**Xatolar:**
- `401 Unauthorized` — Email yoki parol noto'g'ri
- `401 Unauthorized` — Akkaunt arxivlangan yoki to'xtatilgan

---

### 1.2 Joriy profili (Me)

Tizimga kirgan o'qituvchining hozirgi ma'lumotlarini olish.

| Parametr | Qiymat |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/auth/me` |
| **Auth** | Kerak (JWT) |

**Javob (Response):** HTTP 200
```json
{
  "id": "teacher-id-123",
  "fullName": "Akmal Ergashev",
  "role": "teacher",
  "email": "teacher@example.com",
  "avatarUrl": "/avatars/photo.jpg",
  "permissions": ["journal", "salary", "messages", "assignments"],
  "phone": "+998-90-123-45-67"
}
```

---

### 1.3 Akkaunt o'zgartirish (Email / Parol)

O'qituvchi o'z email va parolini almashtiradi. Joriy parol tasdiq sifatida kerak.

| Parametr | Qiymal |
|----------|--------|
| **Method** | `PUT` |
| **URL** | `/api/auth/account` |
| **Auth** | Kerak (JWT) |

**So'rov (Request):**
```json
{
  "email": "newemail@example.com",
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456",
  "phone": "+998-90-123-45-67"
}
```

**Javob (Response):** HTTP 200 (UpdateAccount'dan keyin yangilangan UserDto)
```json
{
  "id": "teacher-id-123",
  "fullName": "Akmal Ergashev",
  "role": "teacher",
  "email": "newemail@example.com",
  "avatarUrl": "/avatars/photo.jpg",
  "permissions": ["journal", "salary", "messages", "assignments"],
  "phone": "+998-90-123-45-67"
}
```

**Xatolar:**
- `400 Bad Request` — Joriy parol noto'g'ri
- `400 Bad Request` — Bu email allaqachon band
- `400 Bad Request` — Yangi parol 8 belgidan qisqa

---

## 2. Profil (Profile)

### 2.1 O'qituvchi profilini ko'rish

O'qituvchining o'z profilini ko'rish (ism, email, fanlari, ruxsatlar, foto, support holatı).

| Parametr | Qiymat |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/me` |
| **Auth** | Kerak (teacher) |

**Javob (Response):** HTTP 200
```json
{
  "id": "teacher-id-123",
  "fullName": "Akmal Ergashev",
  "email": "teacher@example.com",
  "homeroomClass": "1-A",
  "subjects": [
    { "id": "subject-1", "name": "Matematika", "price": 150000 },
    { "id": "subject-2", "name": "Ingliz tili", "price": 200000 }
  ],
  "permissions": ["journal", "salary", "messages", "assignments"],
  "photoUrl": "/photos/teacher.jpg",
  "isSupport": false
}
```

---

### 2.2 Maktab/Markaz ma'lumotlari

O'qituvchi ilovasi uchun markaz/maktab umumiy ma'lumotlari (nom, logo, telegram kanal).

| Parametr | Qiymat |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/school` |
| **Auth** | Kerak (teacher) |

**Javob (Response):** HTTP 200
```json
{
  "name": "Intellect Maktab Markazi",
  "telegramChannel": "https://t.me/intellectschool",
  "logoUrl": "/logos/school.png"
}
```

---

### 2.3 Metalar (Meta)

Markaz sozlamalari, davomat sabablari, baholash turlari va boshqa uum ma'lumotlar.

| Parametr | Qiymat |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/meta` |
| **Auth** | Kerak (teacher) |

**Javob (Response):** HTTP 200
```json
{
  "center": {
    "name": "Intellect Maktab Markazi",
    "logoUrl": "/logos/school.png"
  },
  "absenceReasons": [
    { "id": "reason-1", "name": "Kasallik", "short": "Kas", "isLate": false },
    { "id": "reason-2", "name": "Juda kech kelish", "short": "JK", "isLate": true }
  ],
  "evaluationTypes": [
    { "id": "eval-1", "name": "Shiddatli", "description": "Haftalik test" },
    { "id": "eval-2", "name": "Oraliq", "description": "Og'zaki" }
  ]
}
```

---

## 3. Bildirishnomalar (Notifications)

### 3.1 Bildirishnomalar ro'yxati

O'qituvchiga yuborilgan bildirishnomalar (push) tarixini ko'rish (oxirgi 100 ta, o'qilmaganlar soni bilan).

| Parametr | Qiymat |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/notifications` |
| **Auth** | Kerak (teacher) |

**Javob (Response):** HTTP 200
```json
{
  "unreadCount": 3,
  "items": [
    {
      "id": "notif-1",
      "title": "Yangi to'lov kelib tushdi",
      "body": "Oyning to'lovlari tasdiqlandi",
      "type": "payment",
      "createdAt": "2026-01-15T10:30:00Z",
      "isRead": false,
      "isConfirmed": false
    },
    {
      "id": "notif-2",
      "title": "Jurnal yangilandi",
      "body": "Admin jurnal ma'lumotlarini yangiladi",
      "type": "journal",
      "createdAt": "2026-01-14T15:20:00Z",
      "isRead": true,
      "isConfirmed": true
    }
  ]
}
```

---

### 3.2 Barcha bildirishnomalarni o'qilgan qilish

Barcha bildirishnomalarni o'qilgan deb belgilash (ReadAt = now).

| Parametr | Qiymat |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/notifications/read` |
| **Auth** | Kerak (teacher) |

**Javob (Response):** HTTP 204 No Content

---

### 3.3 Bitta bildirishnomani tasdiqlash

Bitta bildirishnomani tasdiq etish (admin uni ko'radi). O'qilgan deb ham belgilaydi.

| Parametr | Qiymat |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/notifications/{id}/confirm` |
| **Auth** | Kerak (teacher) |
| **Path Param** | `id` — bildirishnoma ID |

**Javob (Response):** HTTP 204 No Content

---

### 3.4 Push qurilmasini ro'yxatdan o'tkazish

Android qurilmani bildirishnomalarga ro'yxatdan o'tkazish (FCM token).

| Parametr | Qiymat |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/notifications/register` |
| **Auth** | Kerak (teacher) |

**So'rov (Request):**
```json
{
  "token": "firebaseCloudMessagingToken123",
  "platform": "android",
  "deviceName": "Samsung Galaxy A12",
  "appId": "com.intellectcrm.teacher"
}
```

**Javob (Response):** HTTP 200
```json
{
  "ok": true
}
```

---

### 3.5 Push qurilmasini ro'yxatdan chiqarish (Logout)

Qurilma tokenini o'chirish (logout). Topilmasa ham 200 qaytadi.

| Parametr | Qiymal |
|----------|--------|
| **Method** | `DELETE` |
| **URL** | `/api/teacher/notifications/register` |
| **Auth** | Kerak (teacher) |
| **Query Param** | `token` — FCM token |

**Javob (Response):** HTTP 200
```json
{
  "ok": true
}
```

---

## 4. Guruhlar (Classes / Groups)

### 4.1 Dars beradigan guruhlar

O'qituvchi qaysi guruhlarda qaysi kurslarni o'qitayotganini ko'rish.

| Parametr | Qiymat |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/classes` |
| **Auth** | Kerak (teacher) |

**Javob (Response):** HTTP 200
```json
[
  {
    "id": "group-1",
    "className": "1-A (Ingliz tili)",
    "grade": "1",
    "subjects": [
      { "id": "subject-1", "name": "Ingliz tili" },
      { "id": "subject-2", "name": "Tarix" }
    ]
  },
  {
    "id": "group-2",
    "className": "2-B (Matematika)",
    "grade": "2",
    "subjects": [
      { "id": "subject-3", "name": "Matematika" }
    ]
  }
]
```

---

## 5. Jurnal (Journal)

O'qituvchi dars beradigan guruhlarda jurnal (davomat, baholar) bilan ishlaydi.

### 5.1 Guruh oylik jurnali

Tanlangan oyda guruhning to'liq jurnali: dars kunlari (avtomatik), faol o'quvchilar, davomat va baholar.

| Parametr | Qiyval |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/journal/group` |
| **Auth** | Kerak (journal ruxsati) |
| **Query Params** | `classId` (majburiy), `month` (YYYY-MM, optional — default: joriy oy) |

**So'rov misoli:**
```
GET /api/teacher/journal/group?classId=group-1&month=2026-01
```

**Javob (Response):** HTTP 200
```json
{
  "groupId": "group-1",
  "groupName": "1-A (Ingliz tili)",
  "startDate": "2025-09-01",
  "endDate": "2025-09-30",
  "month": "2026-01",
  "students": [
    {
      "studentId": "student-1",
      "fullName": "Sardor Abdullayev",
      "status": "active",
      "activatedAt": "2025-09-10",
      "balance": 0
    }
  ],
  "columns": [
    { "date": "2026-01-06", "period": 1 },
    { "date": "2026-01-08", "period": 2 }
  ],
  "entries": [
    {
      "studentId": "student-1",
      "date": "2026-01-06",
      "period": 1,
      "grade": "5",
      "reasonId": null
    },
    {
      "studentId": "student-2",
      "date": "2026-01-06",
      "period": 1,
      "grade": null,
      "reasonId": "reason-1"
    }
  ]
}
```

---

### 5.2 Jurnal katakni belgilash (Baho / Davomat)

Bitta o'quvchining bitta dars uchun bahosini yoki davomat sababini belgilash.

| Parametr | Qiymat |
|----------|--------|
| **Method** | `PUT` |
| **URL** | `/api/teacher/journal` |
| **Auth** | Kerak (journal ruxsati) |

**So'rov (Request):**
```json
{
  "classId": "group-1",
  "subjectId": "subject-1",
  "quarter": 1,
  "studentId": "student-1",
  "date": "2026-01-06",
  "period": 1,
  "grade": "5"
}
```

Yoki davomat sababi:
```json
{
  "classId": "group-1",
  "subjectId": "subject-1",
  "quarter": 1,
  "studentId": "student-1",
  "date": "2026-01-06",
  "period": 1,
  "reasonId": "reason-1"
}
```

**Javob (Response):** HTTP 204 No Content

**Xatolar:**
- `400 Bad Request` — Kelajakdagi darsga baho qo'yib bo'lmaydi
- `403 Forbidden` — O'qituvchi bu guruhda bu fanni o'qitmaydi

---

### 5.3 Jurnal katakni tozalash

Bitta o'quvchining bitta dars uchun kiritilgan ma'lumotni o'chirish.

| Parametr | Qiymat |
|----------|--------|
| **Method** | `DELETE` |
| **URL** | `/api/teacher/journal` |
| **Auth** | Kerak (journal ruxsati) |
| **Query Params** | `classId`, `subjectId`, `quarter`, `studentId`, `date`, `period` |

**So'rov misoli:**
```
DELETE /api/teacher/journal?classId=group-1&subjectId=subject-1&quarter=1&studentId=student-1&date=2026-01-06&period=1
```

**Javob (Response):** HTTP 204 No Content

---

### 5.4 Bitta dars uchun barcha o'quvchiga davomat belgilash

Bitta dars (sana + period) uchun BARCHA faol o'quvchiga birdan davomat belgilash.

| Parametr | Qiymat |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/journal/bulk-attendance` |
| **Auth** | Kerak (journal ruxsati) |

**So'rov (Request):** Barcha kelsa (reasonId = null):
```json
{
  "classId": "group-1",
  "subjectId": "subject-1",
  "quarter": 1,
  "date": "2026-01-06",
  "period": 1,
  "reasonId": null
}
```

Barcha kelmasa (sababini belgilash):
```json
{
  "classId": "group-1",
  "subjectId": "subject-1",
  "quarter": 1,
  "date": "2026-01-06",
  "period": 1,
  "reasonId": "reason-1"
}
```

**Javob (Response):** HTTP 204 No Content

---

## 6. Baholash (Evaluation)

O'qituvchi o'z fanidan o'quvchilarni 1-5 dan baholaydi (oylik).

### 6.1 Baholash turlari

Admin tomonidan belgilangan baholash turlari (qo'shimcha, oraliq, test, ...).

| Parametr | Qiymat |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/evaluation/types` |
| **Auth** | Kerak (teacher) |

**Javob (Response):** HTTP 200
```json
[
  { "id": "eval-1", "name": "Shiddatli", "description": "Haftalik test" },
  { "id": "eval-2", "name": "Oraliq", "description": "Og'zaki javob" }
]
```

---

### 6.2 Baholash jadvali (Board)

Tanlangan oy uchun sinf × baholash turlar bo'yicha jadvali.

| Parametr | Qiymat |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/evaluation/board` |
| **Auth** | Kerak (teacher) |
| **Query Params** | `classId`, `subjectId`, `month` (YYYY-MM, optional) |

**So'rov misoli:**
```
GET /api/teacher/evaluation/board?classId=group-1&subjectId=subject-1&month=2026-01
```

**Javob (Response):** HTTP 200
```json
{
  "months": ["2026-01", "2025-12", "2025-11"],
  "selectedMonth": "2026-01",
  "types": [
    { "id": "eval-1", "name": "Shiddatli", "description": "Haftalik test" }
  ],
  "students": [
    {
      "studentId": "student-1",
      "fullName": "Sardor Abdullayev",
      "className": "1-A",
      "grades": {
        "eval-1": 5,
        "eval-2": 4
      },
      "average": 4.5
    }
  ]
}
```

---

### 6.3 O'quvchiga baho belgilash

O'qituvchi o'z fanidan bitta o'quvchiga bitta tur bo'yicha baho qo'yadi (1-5).

| Parametr | Qiymat |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/evaluation/grade` |
| **Auth** | Kerak (teacher) |

**So'rov (Request):**
```json
{
  "classId": "group-1",
  "subjectId": "subject-1",
  "studentId": "student-1",
  "typeId": "eval-1",
  "month": "2026-01",
  "week": 1,
  "score": 5
}
```

Bahoni tozalash (score bo'sh yoki 0):
```json
{
  "classId": "group-1",
  "subjectId": "subject-1",
  "studentId": "student-1",
  "typeId": "eval-1",
  "month": "2026-01",
  "score": null
}
```

**Javob (Response):** HTTP 204 No Content

---

## 7. Mezonlar bo'yicha baholash (Grading Criteria)

O'qituvchi o'z guruhi o'quvchilarini belgilangan mezonlar bo'yicha baholaydi.

### 7.1 Guruh baholash jadvali

Mezonlar × o'quvchilar matritsi (tanlangan oy uchun).

| Parametr | Qiyval |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/grading/group/{groupId}/board` |
| **Auth** | Kerak (teacher) |
| **Path Param** | `groupId` — guruh ID |
| **Query Param** | `month` (YYYY-MM, optional) |

**Javob (Response):** HTTP 200
```json
{
  "groupId": "group-1",
  "groupName": "1-A (Ingliz tili)",
  "month": "2026-01",
  "criteria": [
    { "id": "criterion-1", "name": "Dingilik", "description": "...", "maxScore": 10 }
  ],
  "students": [
    {
      "studentId": "student-1",
      "fullName": "Sardor Abdullayev",
      "grades": {
        "criterion-1": 9,
        "criterion-2": 8
      }
    }
  ]
}
```

---

### 7.2 O'quvchiga mezon bahosi belgilash

O'qituvchi bitta o'quvchiga bitta mezon bo'yicha baho qo'yadi (belgilangan sanada).

| Parametr | Qiymat |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/grading/grade` |
| **Auth** | Kerak (teacher) |

**So'rov (Request):**
```json
{
  "groupId": "group-1",
  "studentId": "student-1",
  "criterionId": "criterion-1",
  "date": "2026-01-06",
  "score": 9
}
```

**Javob (Response):** HTTP 200
```json
{
  "ok": true
}
```

---

### 7.3 Bitta mezon bo'yicha barcha o'quvchini ommaviy belgilash

Shu sanada bitta mezon bo'yicha BARCHA faol o'quvchini bir vaqtda belgilash/belgilamaslik.

| Parametr | Qiyval |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/grading/grade/bulk` |
| **Auth** | Kerak (teacher) |

**So'rov (Request):** Barchani "bajarildi" qilish:
```json
{
  "groupId": "group-1",
  "criterionId": "criterion-1",
  "date": "2026-01-06",
  "done": true
}
```

Barchani "bajarilmadi" qilish:
```json
{
  "groupId": "group-1",
  "criterionId": "criterion-1",
  "date": "2026-01-06",
  "done": false
}
```

**Javob (Response):** HTTP 200
```json
{
  "ok": true
}
```

---

## 8. O'quv dasturi / Sillabus (Curriculum)

O'qituvchi o'z guruhi sillabusu o'tilishini (progress) kuzatadi va bandlarni "o'tildi" belgilaydi.

### 8.1 Sillabus progress + prognoz

Guruhning sillabus bandlari o'tilish holatı va tugash prognozi.

| Parametr | Qiymat |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/curriculum/group/{groupId}` |
| **Auth** | Kerak (schedule ruxsati) |
| **Path Param** | `groupId` — guruh ID |

**Javob (Response):** HTTP 200
```json
{
  "groupId": "group-1",
  "groupName": "1-A",
  "months": [
    {
      "month": "2026-01",
      "planItems": 8,
      "coveredItems": 5,
      "coveragePercent": 62.5,
      "totalItems": 8,
      "forecastCompletion": "2026-02-15"
    }
  ],
  "items": [
    {
      "id": "item-1",
      "level": "A1",
      "topicName": "Greeting",
      "description": "Basic greetings",
      "covered": true,
      "coveredAt": "2026-01-15",
      "order": 1
    }
  ],
  "revisionLessons": 2
}
```

---

### 8.2 Bandni "o'tildi" qilish / o'tilmagan qilish

Sillabus bandini o'tilgan deb belgilash yoki bekor qilish.

| Parametr | Qiyval |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/curriculum/group/{groupId}/cover` |
| **Auth** | Kerak (schedule ruxsati) |
| **Path Param** | `groupId` — guruh ID |

**So'rov (Request):** Bandni o'tilgan qilish:
```json
{
  "itemId": "item-1",
  "covered": true
}
```

O'tilmagan qilish:
```json
{
  "itemId": "item-1",
  "covered": false
}
```

**Javob (Response):** HTTP 200
```json
{
  "ok": true
}
```

---

### 8.3 Takrorlash darsi qo'shish / olib tashlash

Sillabus tugashi prognozini tadbirkorlik uchun takrorlash darslarini qo'shish/olib tashlash.

| Parametr | Qiyval |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/curriculum/group/{groupId}/revision` |
| **Auth** | Kerak (schedule ruxsati) |
| **Path Param** | `groupId` — guruh ID |

**So'rov (Request):** 1 ta takrorlash darsi qo'shish:
```json
{
  "delta": 1
}
```

Olib tashlash:
```json
{
  "delta": -1
}
```

**Javob (Response):** HTTP 200
```json
{
  "ok": true,
  "revisionLessons": 3
}
```

---

## 9. Chat

O'qituvchi o'z dars beradigan sinflar + sinf rahbarligi kanallari bilan xabar almashadi (SignalR EMAS, REST API).

### 9.1 Barcha kanallardagi oxirgi xabar vaqti

O'qilmagan xabarlarni aniqlash uchun oxirgi xabar vaqtlari (kanal nomiga tegishli).

| Parametr | Qiyval |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/chat/last-messages` |
| **Auth** | Kerak (messages ruxsati) |

**Javob (Response):** HTTP 200
```json
{
  "1-A": "2026-01-15T14:30:00Z",
  "1-B": null,
  "Teachers": "2026-01-14T10:20:00Z"
}
```

---

### 9.2 O'z kanallarni ko'rish

O'qituvchi qaysi kanallarda bo'lganini ko'rish (sinf nomlari).

| Parametr | Qiyval |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/chat/classes` |
| **Auth** | Kerak (messages ruxsati) |

**Javob (Response):** HTTP 200
```json
["1-A", "1-B", "Teachers"]
```

---

### 9.3 Kanal xabarlarini o'qish

Tanlangan kanaldagi xabarlarni o'qish (to'liq tarix yoki belgilangan vaqtdan keyin).

| Parametr | Qiyval |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/chat/{className}` |
| **Auth** | Kerak (messages ruxsati) |
| **Path Param** | `className` — sinf nomi (EXACT, masalan "1-A") |
| **Query Param** | `since` (ISO datetime, optional — belgilangan vaqtdan keyin) |

**So'rov misoli:**
```
GET /api/teacher/chat/1-A?since=2026-01-15T14:00:00Z
```

**Javob (Response):** HTTP 200
```json
[
  {
    "id": "msg-1",
    "className": "1-A",
    "senderName": "Admin",
    "text": "Ertaga sinov bo'ladi",
    "createdAt": "2026-01-15T14:10:00Z"
  },
  {
    "id": "msg-2",
    "className": "1-A",
    "senderName": "Akmal Ergashev",
    "text": "Belgilab oldim, raxmat",
    "createdAt": "2026-01-15T14:15:00Z"
  }
]
```

---

### 9.4 Xabar yuborish

Kanal'ga xabar yuborish.

| Parametr | Qiymal |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/chat/{className}` |
| **Auth** | Kerak (messages ruxsati) |
| **Path Param** | `className` — sinf nomi |

**So'rov (Request):**
```json
{
  "text": "Bugun dars bilan oxirlanadi"
}
```

**Javob (Response):** HTTP 200
```json
{
  "id": "msg-3",
  "className": "1-A",
  "senderName": "Akmal Ergashev",
  "text": "Bugun dars bilan oxirlanadi",
  "createdAt": "2026-01-15T15:45:00Z"
}
```

---

## 10. Topshiriqlar (Assignments / Homework)

O'qituvchi o'z topshiriqlarini yaratadi va natijalarini kuzatadi.

### 10.1 O'z topshiriqlarni ko'rish

O'qituvchi o'zi yaratgan barcha topshiriqlar.

| Parametr | Qiymal |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/assignments` |
| **Auth** | Kerak (assignments ruxsati) |

**Javob (Response):** HTTP 200
```json
[
  {
    "id": "assign-1",
    "title": "Unit 1 Test",
    "description": "Online test about greetings",
    "assignmentTypeId": "type-1",
    "groupIds": ["group-1", "group-2"],
    "deadline": "2026-01-20",
    "dueDate": "2026-01-20T23:59:00Z",
    "createdByUserId": "user-id-123",
    "materialUrl": "/uploads/test.pdf",
    "instructions": "Complete all questions",
    "createdAt": "2026-01-15T10:00:00Z"
  }
]
```

---

### 10.2 Topshiriq yaratish

Yangi topshiriq yaratish (1 ta yoki ko'p guruhlarga).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/assignments` |
| **Auth** | Kerak (assignments ruxsati) |

**So'rov (Request):**
```json
{
  "title": "Unit 1 Test",
  "description": "Online test about greetings",
  "assignmentTypeId": "type-1",
  "classIds": ["group-1", "group-2"],
  "deadline": "2026-01-20",
  "instructions": "Complete all questions",
  "materialUrl": "/uploads/test.pdf"
}
```

**Javob (Response):** HTTP 200/201
```json
{
  "id": "assign-1",
  "title": "Unit 1 Test",
  "description": "Online test about greetings",
  "assignmentTypeId": "type-1",
  "groupIds": ["group-1", "group-2"],
  "deadline": "2026-01-20",
  "dueDate": "2026-01-20T23:59:00Z",
  "createdByUserId": "user-id-123",
  "materialUrl": "/uploads/test.pdf",
  "instructions": "Complete all questions",
  "createdAt": "2026-01-15T10:00:00Z"
}
```

---

### 10.3 Topshiriqni tahrirlash

O'z topshiriqini tahrirlash (yaratuvchi o'qituvchi faqat).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `PUT` |
| **URL** | `/api/teacher/assignments/{id}` |
| **Auth** | Kerak (assignments ruxsati) |
| **Path Param** | `id` — topshiriq ID |

**So'rov (Request):**
```json
{
  "title": "Unit 1 Test (Updated)",
  "description": "Updated description",
  "assignmentTypeId": "type-1",
  "classIds": ["group-1"],
  "deadline": "2026-01-25"
}
```

**Javob (Response):** HTTP 204 No Content

---

### 10.4 Topshiriqni o'chirish

O'z topshiriqini o'chirish (faqat yaratuvchi).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `DELETE` |
| **URL** | `/api/teacher/assignments/{id}` |
| **Auth** | Kerak (assignments ruxsati) |
| **Path Param** | `id` — topshiriq ID |

**Javob (Response):** HTTP 204 No Content

---

### 10.5 Fayl yuklash (Topshiriq materiali)

Topshiriq materiali sifatida fayl yuklash (PDF, rasm, doc, maks ~20MB).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/uploads` |
| **Auth** | Kerak (assignments ruxsati) |
| **Content-Type** | `multipart/form-data` |

**So'rov (Request):** multipart form-data
```
file: <binary file>
```

**Javob (Response):** HTTP 200
```json
{
  "fileName": "test.pdf",
  "fileUrl": "/uploads/test-uuid.pdf",
  "fileSize": 524288,
  "contentType": "application/pdf"
}
```

---

### 10.6 Topshiriq natijalarini ko'rish

Topshiriqni qanday o'quvchilar bajargani, batarkan berilgani.

| Parametr | Qiymal |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/assignments/{id}/results` |
| **Auth** | Kerak (assignments ruxsati) |
| **Path Param** | `id` — topshiriq ID |

**Javob (Response):** HTTP 200
```json
{
  "id": "assign-1",
  "title": "Unit 1 Test",
  "results": [
    {
      "studentId": "student-1",
      "fullName": "Sardor Abdullayev",
      "completed": true,
      "completedAt": "2026-01-20T15:30:00Z",
      "score": 9
    },
    {
      "studentId": "student-2",
      "fullName": "Aziza Eshimbayeva",
      "completed": false,
      "completedAt": null,
      "score": null
    }
  ]
}
```

---

### 10.7 O'quvchining bajarish holatini belgilash

O'qituvchi o'quvchining topshiriq bajarish holatini belgilaydi (bajardi/bajarmadi + ixtiyoriy ball).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `PUT` |
| **URL** | `/api/teacher/assignments/{id}/submissions/{studentId}` |
| **Auth** | Kerak (assignments ruxsati) |
| **Path Param** | `id` — topshiriq ID, `studentId` — o'quvchi ID |

**So'rov (Request):**
```json
{
  "completed": true,
  "score": 9
}
```

**Javob (Response):** HTTP 204 No Content

---

### 10.8 Topshiriq turlari

Admin belgilagan topshiriq turlari (dropdown uchun).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/assignment-types` |
| **Auth** | Kerak (assignments ruxsati) |

**Javob (Response):** HTTP 200
```json
[
  { "id": "type-1", "name": "Online test" },
  { "id": "type-2", "name": "Essay" }
]
```

---

## 11. Taklif va Shikoyatlar (Feedback)

O'qituvchi admin'ga taklif yoki shikoyat yuboradi (rasm bilan yoki bermasdan).

### 11.1 Taklif / Shikoyat yuborish

| Parametr | Qiymal |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/feedback` |
| **Auth** | Kerak (teacher) |
| **Content-Type** | `multipart/form-data` |

**So'rov (Request):** multipart form-data
```
type: "suggestion" atau "complaint"
text: "Bugungi dars o'tishi muammo bo'ldi"
image: <optional binary file>
```

**Javob (Response):** HTTP 204 No Content

---

## 12. LMS (O'quv kontenti)

O'qituvchi o'z dars beradigan sinflarning LMS materiallari va o'quvchilar progressini ko'radi (yaratmaydi).

### 12.1 LMS fanlar

O'qituvchining dars beradigan sinflarining LMS fanlar.

| Parametr | Qiymal |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/lms/subjects` |
| **Auth** | Kerak (teacher) |
| **Query Param** | `classId` (optional — bitta sinfga filtrlash) |

**Javob (Response):** HTTP 200
```json
[
  {
    "id": "subj-1",
    "classId": "group-1",
    "className": "1-A",
    "title": "English A1",
    "description": "Basic English course",
    "unlockMode": "sequential",
    "batchSize": 5,
    "topicCount": 12,
    "createdAt": "2025-09-01T10:00:00Z"
  }
]
```

---

### 12.2 Mavzular (Topics)

Fan mavzularini to'liq kontent bilan ko'rish (o'qituvchiga hammasi ochiq, tugatgan o'quvchi soni bilan).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/lms/subjects/{subjectId}/topics` |
| **Auth** | Kerak (teacher) |
| **Path Param** | `subjectId` — LMS fan ID |

**Javob (Response):** HTTP 200
```json
[
  {
    "id": "topic-1",
    "moduleId": "module-1",
    "title": "Greetings",
    "description": "Learn basic greetings",
    "videoUrl": "https://youtube.com/watch?v=...",
    "textContent": "Hello means salom...",
    "order": 1,
    "materials": [
      {
        "id": "mat-1",
        "name": "Vocabulary list",
        "url": "/uploads/vocab.pdf",
        "size": 102400,
        "contentType": "application/pdf"
      }
    ],
    "completedCount": 25
  }
]
```

---

### 12.3 O'quvchilar progress matritsasi

Fan bo'yicha o'quvchilar kim qaysi mavzuni tugatgani.

| Parametr | Qiymal |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/lms/subjects/{subjectId}/progress` |
| **Auth** | Kerak (teacher) |
| **Path Param** | `subjectId` — LMS fan ID |

**Javob (Response):** HTTP 200
```json
{
  "topics": [
    { "id": "topic-1", "title": "Greetings", "order": 1 },
    { "id": "topic-2", "title": "Introductions", "order": 2 }
  ],
  "students": [
    {
      "studentId": "student-1",
      "fullName": "Sardor Abdullayev",
      "completedTopics": ["topic-1"],
      "completedCount": 1,
      "totalCount": 2
    },
    {
      "studentId": "student-2",
      "fullName": "Aziza Eshimbayeva",
      "completedTopics": ["topic-1", "topic-2"],
      "completedCount": 2,
      "totalCount": 2
    }
  ]
}
```

---

## 13. Maosh (Salary)

O'qituvchi o'z maosh ledgerini ko'radi (faqat o'ziga tegishli).

### 13.1 Maosh ledgeri

O'qituvchining oylik maosh history (mo'ljallangan, to'langan, qolgan + guruh bo'yicha breakdown).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/salary` |
| **Auth** | Kerak (salary ruxsati) |
| **Query Params** | `from` (YYYY-MM, optional), `to` (YYYY-MM, optional) |

**So'rov misoli:**
```
GET /api/teacher/salary?from=2025-01&to=2026-01
```

**Javob (Response):** HTTP 200
```json
{
  "teacherId": "teacher-id-123",
  "fullName": "Akmal Ergashev",
  "salary": 5000000,
  "totalExpected": 15000000,
  "totalPaid": 10000000,
  "remaining": 5000000,
  "salaryMode": "fixed",
  "salaryPercent": 0,
  "months": [
    {
      "month": "2026-01",
      "expected": 5000000,
      "paid": 0,
      "remaining": 5000000,
      "status": "pending"
    },
    {
      "month": "2025-12",
      "expected": 5000000,
      "paid": 5000000,
      "remaining": 0,
      "status": "paid"
    }
  ],
  "groups": [
    {
      "groupId": "group-1",
      "groupName": "1-A (Ingliz tili)",
      "courseName": "Ingliz tili",
      "monthlyFee": 200000,
      "mode": "percent",
      "percent": 15,
      "fixed": 0,
      "periodCollected": 800000,
      "periodExpected": 1000000
    }
  ]
}
```

---

## 14. Support (Bo'sh vaqt bron-konsultatsiya)

Support o'qituvchi bo'sh vaqt slotlarini yaratadi va o'quvchilar bu slotlarni bron qiladi.

### 14.1 O'z slotlarni ko'rish

Support o'qituvchi o'z bo'sh vaqt slotlarini ko'radi (barcha holatlar: bo'sh / bron / o'tilgan).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `GET` |
| **URL** | `/api/teacher/support/slots` |
| **Auth** | Kerak (teacher, support o'qituvchi bo'lishi shart) |
| **Query Param** | `month` (YYYY-MM, optional — oylar bo'yicha filtrlash) |

**Javob (Response):** HTTP 200
```json
[
  {
    "id": "slot-1",
    "teacherId": "teacher-id-123",
    "date": "2026-01-15",
    "startTime": "17:00",
    "endTime": "18:00",
    "status": "empty",
    "studentId": null,
    "studentName": "",
    "topic": "",
    "notes": "",
    "bookedAt": null
  },
  {
    "id": "slot-2",
    "teacherId": "teacher-id-123",
    "date": "2026-01-15",
    "startTime": "18:00",
    "endTime": "18:30",
    "status": "booked",
    "studentId": "student-1",
    "studentName": "Sardor Abdullayev",
    "topic": "Unit 1",
    "notes": "Tushintira olmaydim",
    "bookedAt": "2026-01-10T10:00:00Z"
  }
]
```

---

### 14.2 Bo'sh vaqt slotlari qo'shish

Support o'qituvchi bo'sh vaqt bloki qo'shadi (avtomatik har odamga ajratilgan davomiylik bo'yicha qism-slotlarga bo'linadi).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/support/slots` |
| **Auth** | Kerak (teacher, support o'qituvchi bo'lishi shart) |

**So'rov (Request):** Haftalik takrorlash bilan:
```json
{
  "date": "2026-01-15",
  "startTime": "17:00",
  "endTime": "19:00",
  "slotMinutes": 30,
  "repeatMode": "weekly",
  "repeatWeeks": 4
}
```

Kunlik takrorlash bilan (oraliq):
```json
{
  "date": "2026-01-15",
  "startTime": "17:00",
  "endTime": "19:00",
  "slotMinutes": 60,
  "repeatMode": "daily",
  "endDate": "2026-02-15"
}
```

**Javob (Response):** HTTP 200
```json
{
  "created": 8
}
```

---

### 14.3 Slotni o'chirish

O'tilgan darsdan tashqari slotni o'chirish.

| Parametr | Qiymal |
|----------|--------|
| **Method** | `DELETE` |
| **URL** | `/api/teacher/support/slots/{id}` |
| **Auth** | Kerak (teacher) |
| **Path Param** | `id` — slot ID |

**Javob (Response):** HTTP 204 No Content

**Xatolar:**
- `400 Bad Request` — O'tilgan darsni o'chirib bo'lmaydi

---

### 14.4 Bron qilingan darsni yakunlash

Support o'qituvchi bron qilingan darsni yakunlaydi (mavzu + izoh yozib "o'tildi" qiladi).

| Parametr | Qiymal |
|----------|--------|
| **Method** | `POST` |
| **URL** | `/api/teacher/support/slots/{id}/complete` |
| **Auth** | Kerak (teacher) |
| **Path Param** | `id` — slot ID |

**So'rov (Request):**
```json
{
  "topic": "Unit 1 - Greetings",
  "notes": "Tushuntirdim, keyingi safar quyidagi mavzuni"
}
```

**Javob (Response):** HTTP 204 No Content

---

## Xatolar va Status Kodlari

| Kod | Ma'no |
|-----|-------|
| `200 OK` | Muvaffaqiyatli, javob bilan |
| `201 Created` | Muvaffaqiyatli yaratildi |
| `204 No Content` | Muvaffaqiyatli, javob yo'q |
| `400 Bad Request` | So'rov xatosi (tekshirish, parametr) |
| `401 Unauthorized` | Token yo'q yoki noto'g'ri |
| `403 Forbidden` | Ruxsat yo'q (egalik, rol, permission) |
| `404 Not Found` | Entity topilmadi |
| `422 Unprocessable Entity` | Mantiq xatosi (masalan, kelajakdagi darsga baho) |
| `500 Internal Server Error` | Server xatosi |

---

## Maslahatlar

1. **Token Refresh:** Token bekor bo'lsa (401), qayta login qilish kerak. Token refresh'i hozir mavjud emas.
2. **Rate Limiting:** Login uchun rate limit bor. Boshqa endpointlar uchun hozir yo'q.
3. **Camel Case:** JSON javoblari camelCase'da, so'rovlar ham camelCase'da.
4. **Timezone:** Barcha sanalar ISO 8601 (UTC). Toshkent vaqti `AppClock.Now` Toshkent local (UTC+5) orqali saqlanadi.
5. **Pagination:** Hozir asosiy endpointlarda pagination yo'q; shuning uchun dastlabki load kichik bo'lishi mumkin, keyin lazy-loading qo'llang.

---

## Tarqatish

Bu hujjat Kotlin (Retrofit) Android ilova uchun mo'ljallangan. **Barcha endpointlar real kod'dan olingan va test qilingan.**

---

**Hujjat versiyasi:** 1.0  
**Oxirgi yangilash:** 2026-01-15
