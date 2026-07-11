# O'QITUVCHI (TEACHER) MOBIL ILOVA — API HUJJATI

## Kirish

Bu hujjat IntellectCRM tizimining o'qituvchi ilovasi API'sini to'liq tasvirlaydi. 

**Asosiy ma'lumotlar:**
- **Base URL:** `https://<app_host>/api` (masalan `https://crm.intellectschool.uz/api`)
- **Autentifikatsiya:** JWT Bearer token (login'dan olinadi)
- **Qabul qilish:** Barcha so'rovlar JSON formatida
- **Javob:** JSON
- **Rol:** `teacher` (o'qituvchi)

**HTTP Headerlar:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## 1. AUTENTIFIKATSIYA (Authentication)

### 1.1 Login — JWT Token olish

```
POST /auth/login
```

**Mazmun (Body):**
```json
{
  "email": "string",
  "password": "string"
}
```

**Javob (200 OK):**
```json
{
  "token": "string",
  "user": {
    "id": "string",
    "fullName": "string",
    "role": "teacher",
    "email": "string",
    "avatarUrl": "string|null",
    "permissions": [
      "journal",
      "assignments",
      "schedule",
      "messages",
      "salary"
    ],
    "phone": "string|null"
  }
}
```

**Izoh:**
- O'qituvchi email va parol bilan kiritadi.
- `token` — JWT Bearer token (keyingi so'rovlarda `Authorization: Bearer <token>` sifatida ishlatiladi).
- `permissions` — o'qituvchiga berilgan bo'limlar (faqat taqdim etilgan bo'limlardan foydalanishi mumkin).

**Xatolar:**
- `401 Unauthorized` — Login yoki parol noto'g'ri.
- `401 Unauthorized` — Akkaunt arxivlangan yoki to'xtatilgan.

---

### 1.2 Joriy foydalanuvchi ma'lumoti

```
GET /auth/me
```

**Autentifikatsiya:** Majburiy (JWT Bearer token)

**Javob (200 OK):**
```json
{
  "id": "string",
  "fullName": "string",
  "role": "teacher",
  "email": "string",
  "avatarUrl": "string|null",
  "permissions": [
    "journal",
    "assignments",
    "schedule",
    "messages",
    "salary"
  ],
  "phone": "string|null"
}
```

**Izoh:**
- Joriy tokenning egasi haqida ma'lumot.

---

### 1.3 Akkaunt ma'lumotini yangilash (email/parol)

```
PUT /auth/account
```

**Autentifikatsiya:** Majburiy

**Mazmun (Body):**
```json
{
  "email": "string|null",
  "currentPassword": "string",
  "newPassword": "string|null",
  "phone": "string|null"
}
```

**Javob (200 OK):**
```json
{
  "id": "string",
  "fullName": "string",
  "role": "teacher",
  "email": "string",
  "avatarUrl": "string|null",
  "permissions": [
    "journal",
    "assignments",
    "schedule",
    "messages",
    "salary"
  ],
  "phone": "string|null"
}
```

**Izoh:**
- `currentPassword` — joriy parol (majburiy, tasdiqlanadi).
- `email` — bo'sh/null bo'lsa o'zgartirilmaydi.
- `newPassword` — bo'sh/null bo'lsa o'zgartirilmaydi (min 8 belgisi).
- `phone` — ixtiyoriy.

**Xatolar:**
- `400 Bad Request` — Joriy parol noto'g'ri.
- `400 Bad Request` — Yangi email allaqachon ishlatilmoqda.
- `400 Bad Request` — Yangi parol 8 belgidan kam.

---

## 2. PROFIL (Profile)

### 2.1 O'z profili

```
GET /teacher/me
```

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
{
  "id": "string",
  "fullName": "string",
  "email": "string",
  "homeroomClass": "string|null",
  "subjects": [
    {
      "id": "string",
      "name": "string",
      "price": 0.00
    }
  ],
  "permissions": [
    "journal",
    "assignments",
    "schedule",
    "messages",
    "salary"
  ],
  "photoUrl": "string|null",
  "isSupport": false
}
```

**Izoh:**
- Joriy o'qituvchining profili (FISH, email, fanlari, ruxsatlari).
- `homeroomClass` — guruh rahbarligi (null bo'lsa rahbar emas).
- `subjects` — o'qitadigan fanlar ro'yxati.
- `isSupport` — support o'qituvchi bo'lsa `true`.

---

### 2.2 Markaz nomi va brending

```
GET /teacher/school
```

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
{
  "name": "string",
  "telegramChannel": "string|null",
  "logoUrl": "string|null"
}
```

**Izoh:**
- Markaz brending ma'lumoti (ilova sarlavhasi, logo, Telegram kanali).

---

### 2.3 Markaz/portal umumiy konteksti

```
GET /teacher/meta
```

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
{
  "lessonTimes": [
    {
      "period": 1,
      "startTime": "HH:mm",
      "endTime": "HH:mm"
    }
  ],
  "absenceReasons": [
    {
      "id": "string",
      "name": "string",
      "short": "string",
      "isLate": false
    }
  ],
  "quarters": [
    {
      "quarter": 1,
      "startDate": "yyyy-MM-dd",
      "endDate": "yyyy-MM-dd",
      "gradesOpen": true
    }
  ],
  "currentQuarter": 1,
  "currentWeek": 1
}
```

**Izoh:**
- `lessonTimes` — tizimda sozlangan dars vaqtlari (period raqami + boshlanish/tugash vaqti).
- `absenceReasons` — davomat sabablari (tizimda mavjud).
- `quarters` — o'quv davrlar.
- `currentQuarter`, `currentWeek` — joriy chorak va hafta.

---

## 3. GURUHLAR (Classes)

### 3.1 O'qituvchi dars beradigan guruhlar

```
GET /teacher/classes
```

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
[
  {
    "classId": "string",
    "className": "string",
    "grade": 10,
    "subjects": [
      {
        "id": "string",
        "name": "string",
        "price": 0.00
      }
    ]
  }
]
```

**Izoh:**
- O'qituvchining dars beradigan barcha guruhlar ro'yxati.
- `subjects` — bu guruhda o'qitadigan fanlar (bir guruh — bir fan).
- Grade bo'yicha, so'ng sinf nomi bo'yicha saralangan.

---

## 4. JURNAL (Journal)

### 4.1 Guruhning oylik jurnali

```
GET /teacher/journal/group
```

**Parametrlar:**
- `classId` (majburiy) — guruh ID'si
- `month` (ixtiyoriy) — "yyyy-MM" formatida oy (default: joriy oy)

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
{
  "group": {
    "id": "string",
    "name": "string",
    "courseId": "string",
    "courseName": "string",
    "teacherName": "string",
    "days": [0, 2, 4],
    "startTime": "HH:mm",
    "endTime": "HH:mm",
    "room": "string",
    "startDate": "yyyy-MM-dd",
    "monthlyFee": 0.00
  },
  "months": [
    "yyyy-MM"
  ],
  "month": "yyyy-MM",
  "columns": [
    {
      "date": "yyyy-MM-dd",
      "period": 1,
      "dayName": "string"
    }
  ],
  "students": [
    {
      "studentId": "string",
      "fullName": "string",
      "status": "active|trial|frozen",
      "activatedAt": "yyyy-MM-dd",
      "balance": 0.00,
      "memberStart": "yyyy-MM-dd"
    }
  ],
  "entries": [
    {
      "studentId": "string",
      "date": "yyyy-MM-dd",
      "period": 1,
      "grade": 5,
      "reasonId": "string|null",
      "reasonName": "string|null"
    }
  ],
  "conductedDates": [
    "yyyy-MM-dd"
  ],
  "reschedules": []
}
```

**Izoh:**
- `columns` — dars kunlari (dars raqami + vaqti).
- `students` — faol a'zolar (status, kirgan sana, balans).
- `entries` — baho va davomat yozuvlari (grade = baho, reasonId = davomat sababi).
- `conductedDates` — "o'tildi" deb belgilangan dars sanalari.
- `memberStart` — o'quvchining guruhda hisob boshlangan sana (shundan oldingi darslar bloklangan).
- O'qituvchi shu guruhga dars bermasa **403 Forbidden** qaytadi.

**Xatolar:**
- `404 Not Found` — Guruh topilmadi.
- `403 Forbidden` — O'qituvchi bu guruhda dars bermaydi.

---

### 4.2 Bitta katakka baho/davomat kiritish

```
PUT /teacher/journal
```

**Autentifikatsiya:** Majburiy

**Mazmun (Body):**
```json
{
  "classId": "string",
  "subjectId": "string",
  "quarter": 1,
  "studentId": "string",
  "date": "yyyy-MM-dd",
  "period": 1,
  "grade": 5,
  "reasonId": "string|null",
  "homework": 0,
  "behavior": 0,
  "mastery": null
}
```

**Javob (204 No Content)**

**Izoh:**
- `grade` — 1-5 (yoki null = tozalash).
- `reasonId` — davomat sabab ID'si (bo'sh = hech kim emas).
- `date` — joriy yoki o'tgan sana (kelajak taqiq).
- Jurnal siyosati tekshiriladi (muharrir sana oynasi, faqat o'tilgan dars, admin sozlamalari).
- Agar birinchi marta davomat kiritilsa avtomatik xabar yuboriladi.

**Xatolar:**
- `400 Bad Request` — Kelajak sana.
- `400 Bad Request` — Jurnal siyosati buzilgan.
- `403 Forbidden` — O'qituvchi bu guruhda dars bermaydi.

---

### 4.3 Jurnal yozuvini tozalash

```
DELETE /teacher/journal
```

**Parametrlar:**
- `classId` (majburiy)
- `subjectId` (majburiy)
- `quarter` (majburiy) — 1
- `studentId` (majburiy)
- `date` (majburiy) — "yyyy-MM-dd"
- `period` (majburiy) — dars raqami

**Autentifikatsiya:** Majburiy

**Javob (204 No Content)**

**Izoh:**
- Sana oynasi siyosatiga bo'ysunadi.

**Xatolar:**
- `400 Bad Request` — Jurnal siyosati buzilgan.
- `403 Forbidden` — O'qituvchi bu guruhda dars bermaydi.

---

### 4.4 Bitta dars uchun BARCHA o'quvchiga davomat

```
POST /teacher/journal/bulk-attendance
```

**Autentifikatsiya:** Majburiy

**Mazmun (Body):**
```json
{
  "classId": "string",
  "subjectId": "string",
  "date": "yyyy-MM-dd",
  "period": 1,
  "studentIds": [
    "string"
  ],
  "reasonId": "string|null",
  "absent": false
}
```

**Javob (204 No Content)**

**Izoh:**
- `absent` = `false` — barcha o'quvchi **KELDI** (dars "o'tildi").
- `absent` = `true` — barcha o'quvchi **KELMADI** (`reasonId` yoki standart "Sababsiz").
- Dars avtomatik "o'tildi" (Conducted) qilinadi.

**Xatolar:**
- `400 Bad Request` — Jurnal siyosati buzilgan.
- `403 Forbidden` — O'qituvchi bu guruhda dars bermaydi.

---

## 5. BAHOLASH (Evaluation) — Fan bo'yicha

### 5.1 Baholash turlari katalogi

```
GET /teacher/evaluation/types
```

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
[
  {
    "id": "string",
    "name": "string",
    "description": "string"
  }
]
```

**Izoh:**
- Admin belgilangan baholash turlari (masalan "Muhlilik", "Rioya", "Etakchilik").

---

### 5.2 Baholash jadvali (fan bo'yicha)

```
GET /teacher/evaluation/board
```

**Parametrlar:**
- `classId` (majburiy)
- `subjectId` (majburiy)
- `month` (ixtiyoriy) — "yyyy-MM" (default: joriy oy)

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
{
  "months": [
    "yyyy-MM"
  ],
  "month": "yyyy-MM",
  "week": 1,
  "types": [
    {
      "id": "string",
      "name": "string",
      "description": "string"
    }
  ],
  "rows": [
    {
      "studentId": "string",
      "fullName": "string",
      "className": "string",
      "conducted": 0,
      "attended": 0,
      "reasons": [],
      "grades": {
        "typeId": 5
      },
      "avgGrade": 4.5
    }
  ],
  "subjectId": "string",
  "subjects": [],
  "groups": [],
  "groupId": "all"
}
```

**Izoh:**
- `grades` — tur ID → baho (1-5) shumo.
- `avgGrade` — o'rtacha baho (tur baholarining o'rtachasi).

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu guruhda bu fanni o'qitmaydi.

---

### 5.3 Bitta o'quvchiga baholash qo'yish/yangilash

```
POST /teacher/evaluation/grade
```

**Autentifikatsiya:** Majburiy

**Mazmun (Body):**
```json
{
  "studentId": "string",
  "classId": "string",
  "subjectId": "string",
  "typeId": "string",
  "month": "yyyy-MM",
  "week": 1,
  "score": 5
}
```

**Javob (204 No Content)**

**Izoh:**
- `score` — 1-5 (yoki null/0 = tozalash).
- O'qituvchi faqat o'z fanidan va o'z guruhi o'quvchilariga baho qo'yishi mumkin.

**Xatolar:**
- `400 Bad Request` — Guruh va fan ko'rsatilishi shart.
- `400 Bad Request` — Oy tanlanmagan.
- `400 Bad Request` — O'quvchi bu guruhga tegishli emas.
- `403 Forbidden` — O'qituvchi bu guruha dars bermaydi.

---

## 6. BAHOLASH MEZONLARI (Grading Criteria)

### 6.1 Guruh baholash jadvali (mezonlar)

```
GET /teacher/grading/group/{groupId}/board
```

**Parametrlar:**
- `groupId` (URL) — guruh ID'si
- `month` (query, ixtiyoriy) — "yyyy-MM"

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
{
  "groupId": "string",
  "groupName": "string",
  "months": [
    "yyyy-MM"
  ],
  "month": "yyyy-MM",
  "dates": [
    "yyyy-MM-dd"
  ],
  "criteria": [
    {
      "id": "string",
      "name": "string",
      "description": "string|null",
      "active": true,
      "order": 1
    }
  ],
  "students": [
    {
      "studentId": "string",
      "fullName": "string",
      "grades": {
        "criterionId": {
          "dateStr": true
        }
      }
    }
  ]
}
```

**Izoh:**
- Mezonlar bo'yicha (tartibi) va o'quvchilar bo'yicha jadvali.
- `grades` — mezon ID → sana → bajarilgan (`true`/`false`).
- Faqat o'qituvchining o'z guruhi.

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu guruhga dars bermaydi.
- `404 Not Found` — Guruh topilmadi.

---

### 6.2 Bitta o'quvchiga bitta mezon bahosini belgilash

```
POST /teacher/grading/grade
```

**Autentifikatsiya:** Majburiy

**Mazmun (Body):**
```json
{
  "groupId": "string",
  "studentId": "string",
  "criterionId": "string",
  "date": "yyyy-MM-dd",
  "done": true
}
```

**Javob (200 OK):**
```json
{
  "ok": true
}
```

**Izoh:**
- `done` = `true` — mezon bajarildi, `false` — bajarilmadi.

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu guruhga dars bermaydi.
- `404 Not Found` — Guruh topilmadi.

---

### 6.3 Shu sanada BARCHA o'quvchini mezon bo'yicha belgilash

```
POST /teacher/grading/grade/bulk
```

**Autentifikatsiya:** Majburiy

**Mazmun (Body):**
```json
{
  "groupId": "string",
  "criterionId": "string",
  "date": "yyyy-MM-dd",
  "done": true
}
```

**Javob (200 OK):**
```json
{
  "ok": true
}
```

**Izoh:**
- Ommaviy belgilash — faol o'quvchilarning hammasi.

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu guruhga dars bermaydi.
- `404 Not Found` — Guruh topilmadi.

---

## 7. SILLABUS / CURRICULUM (O'TILISH PROGNOZI)

### 7.1 Guruh sillabus o'tilishi + tugash prognozi

```
GET /teacher/curriculum/group/{groupId}
```

**Parametrlar:**
- `groupId` (URL) — guruh ID'si

**Autentifikatsiya:** Majburiy

**Ruxsat:** `Teacher.Permissions` ga "schedule" kirishi shart

**Javob (200 OK):**
```json
{
  "groupId": "string",
  "courseId": "string",
  "courseName": "string",
  "totalItems": 100,
  "coveredCount": 25,
  "revisionLessons": 2,
  "totalLessons": 40,
  "remainingItems": 75,
  "estLessonsLeft": 15,
  "lessonsPerWeek": 3,
  "estFinishDate": "yyyy-MM-dd",
  "levels": [
    {
      "id": "string",
      "name": "string",
      "note": "string|null",
      "order": 1,
      "topics": [
        {
          "id": "string",
          "title": "string",
          "note": "string|null",
          "order": 1,
          "items": [
            {
              "id": "string",
              "text": "string",
              "note": "string|null",
              "order": 1,
              "covered": false,
              "coveredDate": "yyyy-MM-dd|null"
            }
          ]
        }
      ]
    }
  ]
}
```

**Izoh:**
- Sillabus darajasi → mavzu → band tuzilmasi.
- `coveredCount` — o'tilgan bandlar soni.
- `estFinishDate` — lineer prognoz bo'yicha tugish sana.
- Faqat o'qituvchining o'z guruhi.

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu guruhga dars bermaydi yoki "schedule" ruxsati yo'q.
- `404 Not Found` — Guruh topilmadi.

---

### 7.2 Bandni o'tilgan deb belgilash

```
POST /teacher/curriculum/group/{groupId}/cover
```

**Parametrlar:**
- `groupId` (URL) — guruh ID'si

**Autentifikatsiya:** Majburiy

**Ruxsat:** "schedule" ruxsati majburiy

**Mazmun (Body):**
```json
{
  "itemId": "string",
  "covered": true
}
```

**Javob (200 OK):**
```json
{
  "ok": true
}
```

**Izoh:**
- `covered` = `true` — band o'tildi.
- `covered` = `false` — o'tilgan belgisi olib tashlandi.

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu guruhga dars bermaydi yoki ruxsat yo'q.
- `404 Not Found` — Guruh topilmadi.

---

### 7.3 Takrorlash darsi qo'shish/olib tashlash

```
POST /teacher/curriculum/group/{groupId}/revision
```

**Parametrlar:**
- `groupId` (URL) — guruh ID'si

**Autentifikatsiya:** Majburiy

**Ruxsat:** "schedule" ruxsati majburiy

**Mazmun (Body):**
```json
{
  "delta": 1
}
```

**Javob (200 OK):**
```json
{
  "ok": true,
  "revisionLessons": 3
}
```

**Izoh:**
- `delta` = 1 — takrorlash darsi qo'shish.
- `delta` = -1 — oxirgi takrorlash darsini olib tashlash.
- `revisionLessons` — joriy takrorlash darlari soni.

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu guruhga dars bermaydi yoki ruxsat yo'q.
- `404 Not Found` — Guruh topilmadi.

---

## 8. CHAT (GROUP CHAT)

### 8.1 Oxirgi xabar vaqtlari (barcha kanallari)

```
GET /teacher/chat/last-messages
```

**Autentifikatsiya:** Majburiy

**Ruxsat:** "messages" ruxsati majburiy

**Javob (200 OK):**
```json
{
  "10a": "2024-01-15T10:30:00Z",
  "10b": "2024-01-15T09:15:00Z",
  "staff": null
}
```

**Izoh:**
- Guruh nomi → oxirgi xabarin ISO vaqti (yoki null = xabar yo'q).
- Frontend o'qilmagan xabarlarni aniqlash uchun.

---

### 8.2 O'qituvchining barcha chatlari

```
GET /teacher/chat/classes
```

**Autentifikatsiya:** Majburiy

**Ruxsat:** "messages" ruxsati majburiy

**Javob (200 OK):**
```json
[
  "10a",
  "10b",
  "staff"
]
```

**Izoh:**
- O'qituvchiga kirish ruxsati bo'lgan barcha guruh va xodim chatlar.

---

### 8.3 Bitta chat xabarlarini o'qish

```
GET /teacher/chat/{className}
```

**Parametrlar:**
- `className` (URL) — guruh/kanal nomi
- `since` (query, ixtiyoriy) — ISO vaqti (shu vaqtdan keyingi xabarlar)

**Autentifikatsiya:** Majburiy

**Ruxsat:** "messages" ruxsati majburiy

**Javob (200 OK):**
```json
[
  {
    "id": "string",
    "className": "string",
    "senderUserId": "string",
    "senderName": "string",
    "senderRole": "teacher|student|staff",
    "text": "string",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

**Izoh:**
- `since` bo'lsa shu vaqtdan keyingi xabarlar.

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu chatga kira olmaydi.

---

### 8.4 Chatga xabar yuborish

```
POST /teacher/chat/{className}
```

**Parametrlar:**
- `className` (URL) — guruh/kanal nomi

**Autentifikatsiya:** Majburiy

**Ruxsat:** "messages" ruxsati majburiy

**Mazmun (Body):**
```json
{
  "text": "string"
}
```

**Javob (200 OK):**
```json
{
  "id": "string",
  "className": "string",
  "senderUserId": "string",
  "senderName": "string",
  "senderRole": "teacher",
  "text": "string",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Izoh:**
- Xabar real-time (SignalR) bilan boshqa qo'lga jo'natiladi.

**Xatolar:**
- `400 Bad Request` — Xabar bo'sh.
- `403 Forbidden` — O'qituvchi bu chatga yoza olmaydi.

---

## 9. TOPSHIRIQLAR / TESTLAR (Assignments)

### 9.1 O'z topshiriqlar

```
GET /teacher/assignments
```

**Autentifikatsiya:** Majburiy

**Ruxsat:** "assignments" ruxsati majburiy

**Javob (200 OK):**
```json
[
  {
    "id": "string",
    "createdByUserId": "string",
    "subjectId": "string",
    "subjectName": "string",
    "title": "string",
    "description": "string",
    "format": "written|file|test|video",
    "classIds": [
      "string"
    ],
    "classNames": [
      "string"
    ],
    "startDate": "yyyy-MM-dd|null",
    "dueDate": "yyyy-MM-dd|null",
    "lateAccept": true,
    "latePenaltyPct": 10,
    "maxScore": 100,
    "autoGrade": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "materials": [
      {
        "id": "string",
        "name": "string",
        "url": "string",
        "size": 1000000,
        "contentType": "application/pdf",
        "audioUrl": "string|null"
      }
    ],
    "questions": [
      {
        "id": "string",
        "text": "string",
        "options": [
          "string"
        ],
        "correctIndex": 0,
        "order": 1
      }
    ],
    "referenceText": "string"
  }
]
```

**Izoh:**
- O'qituvchi o'zi yaratgan topshiriqlari.

---

### 9.2 Topshiriq yaratish

```
POST /teacher/assignments
```

**Autentifikatsiya:** Majburiy

**Ruxsat:** "assignments" ruxsati majburiy

**Mazmun (Body):**
```json
{
  "subjectId": "string",
  "title": "string",
  "description": "string|null",
  "format": "written|file|test|video",
  "classIds": [
    "string"
  ],
  "startDate": "yyyy-MM-dd|null",
  "dueDate": "yyyy-MM-dd|null",
  "lateAccept": true,
  "latePenaltyPct": 10,
  "maxScore": 100,
  "autoGrade": false,
  "materials": [
    {
      "name": "string",
      "url": "string",
      "size": 1000000,
      "contentType": "application/pdf",
      "audioUrl": "string|null"
    }
  ],
  "questions": [
    {
      "text": "string",
      "options": [
        "string"
      ],
      "correctIndex": 0
    }
  ],
  "referenceText": "string|null"
}
```

**Javob (200 OK):**
```json
{
  "id": "string",
  "createdByUserId": "string",
  "subjectId": "string",
  "subjectName": "string",
  "title": "string",
  "description": "string",
  "format": "written|file|test|video",
  "classIds": [
    "string"
  ],
  "classNames": [
    "string"
  ],
  "startDate": "yyyy-MM-dd|null",
  "dueDate": "yyyy-MM-dd|null",
  "lateAccept": true,
  "latePenaltyPct": 10,
  "maxScore": 100,
  "autoGrade": false,
  "createdAt": "2024-01-15T10:30:00Z",
  "materials": [],
  "questions": [],
  "referenceText": "string"
}
```

**Xatolar:**
- `400 Bad Request` — Nomi bo'sh yoki guruhlar tanlangan emas.

---

### 9.3 Topshiriqni tahrirlash

```
PUT /teacher/assignments/{id}
```

**Parametrlar:**
- `id` (URL) — topshiriq ID'si

**Autentifikatsiya:** Majburiy

**Ruxsat:** "assignments" ruxsati majburiy

**Mazmun (Body):** (9.2 bilan bir xil)

**Javob (204 No Content)**

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu topshiriqni yaratmadi.
- `404 Not Found` — Topshiriq topilmadi.

---

### 9.4 Topshiriqni o'chirish

```
DELETE /teacher/assignments/{id}
```

**Parametrlar:**
- `id` (URL) — topshiriq ID'si

**Autentifikatsiya:** Majburiy

**Ruxsat:** "assignments" ruxsati majburiy

**Javob (204 No Content)**

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu topshiriqni yaratmadi.
- `404 Not Found` — Topshiriq topilmadi.

---

### 9.5 Fayl yuklash (topshiriq materiali)

```
POST /teacher/uploads
```

**Autentifikatsiya:** Majburiy

**Ruxsat:** "assignments" ruxsati majburiy

**Mazmun:** `multipart/form-data`
- `file` (fayl) — PDF, rasm, doc (maks ~20MB)

**Javob (200 OK):**
```json
{
  "name": "string",
  "url": "/uploads/...",
  "size": 1000000,
  "contentType": "application/pdf"
}
```

**Izoh:**
- Yuklangan fayl `/uploads/` ostida saqlanadi.
- URL topshiriq materiali sifatida ishlatiladi.

**Xatolar:**
- `400 Bad Request` — Fayl noto'g'ri turi yoki hajmi.

---

### 9.6 Topshiriq natijalari (kim bajardi/bajarmadi)

```
GET /teacher/assignments/{id}/results
```

**Parametrlar:**
- `id` (URL) — topshiriq ID'si

**Autentifikatsiya:** Majburiy

**Ruxsat:** "assignments" ruxsati majburiy

**Javob (200 OK):**
```json
{
  "id": "string",
  "title": "string",
  "submissions": [
    {
      "studentId": "string",
      "studentName": "string",
      "className": "string",
      "status": "pending|completed|graded",
      "submittedAt": "2024-01-15T10:30:00Z|null",
      "score": 85,
      "maxScore": 100
    }
  ]
}
```

**Izoh:**
- O'qituvchi o'z topshiriqlari natijalari.

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu topshiriqni yaratmadi.
- `404 Not Found` — Topshiriq topilmadi.

---

### 9.7 O'quvchi bajarish holatini belgilash

```
PUT /teacher/assignments/{id}/submissions/{studentId}
```

**Parametrlar:**
- `id` (URL) — topshiriq ID'si
- `studentId` (URL) — o'quvchi ID'si

**Autentifikatsiya:** Majburiy

**Ruxsat:** "assignments" ruxsati majburiy

**Mazmun (Body):**
```json
{
  "completed": true,
  "score": 85
}
```

**Javob (204 No Content)**

**Izoh:**
- `completed` — bajarilganmi.
- `score` — o'qituvchi berilgan ball.

**Xatolar:**
- `403 Forbidden` — O'qituvchi bu topshiriqni yaratmadi.
- `404 Not Found` — Topshiriq topilmadi.

---

### 9.8 Topshiriq turlari

```
GET /teacher/assignment-types
```

**Autentifikatsiya:** Majburiy

**Ruxsat:** "assignments" ruxsati majburiy

**Javob (200 OK):**
```json
[
  {
    "id": "string",
    "name": "string"
  }
]
```

**Izoh:**
- Tizimda mavjud topshiriq turlari (form dropdown uchun).

---

## 10. O'QITUVCHI REYTINGI

### 10.1 Reytingi (o'z guruhlari bo'yicha o'quvchilar balli)

```
GET /teacher/rating
```

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
{
  "teacherId": "string",
  "fullName": "string",
  "groupsCount": 3,
  "studentsCount": 45,
  "averageBall": 4.2,
  "rows": [
    {
      "rank": 1,
      "studentId": "string",
      "fullName": "string",
      "className": "string",
      "average": 4.5,
      "ball": 85
    }
  ]
}
```

**Izoh:**
- O'qituvchining o'z guruhlari o'quvchilarining ball bo'yicha reytingi.
- `ball` — yig'ilgan ball.

---

## 11. MAOSH (Salary)

### 11.1 Maosh ledgeri (oylik)

```
GET /teacher/salary
```

**Parametrlar:**
- `from` (ixtiyoriy) — "yyyy-MM" boshlanish oy
- `to` (ixtiyoriy) — "yyyy-MM" tugash oy

**Autentifikatsiya:** Majburiy

**Ruxsat:** "salary" ruxsati majburiy

**Javob (200 OK):**
```json
{
  "teacherId": "string",
  "fullName": "string",
  "salary": 5000000,
  "totalExpected": 15000000,
  "totalPaid": 12000000,
  "remaining": 3000000,
  "salaryMode": "fixed|percent",
  "salaryPercent": 10,
  "months": [
    {
      "month": "2024-01",
      "expected": 5000000,
      "paid": 4000000,
      "remaining": 1000000,
      "deduction": 0,
      "journalLinked": false,
      "plannedLessons": 10,
      "conductedLessons": 9,
      "missedLessons": 1,
      "lessons": [
        {
          "groupName": "10a",
          "missedDates": [
            "2024-01-15"
          ]
        }
      ]
    }
  ],
  "payments": [
    {
      "date": "2024-01-20",
      "amount": 4000000,
      "note": "string|null"
    }
  ],
  "groups": null,
  "totalDeduction": 0,
  "journalLinked": false
}
```

**Izoh:**
- `salaryMode` — "fixed" (qat'iy) yoki "percent" (foizli).
- `totalExpected` — kutilayotgan jami maosh.
- `totalPaid` — to'langan jami maosh.
- `remaining` — qolgan (to'lash kerak).
- `months` — oylik yoyilma (jurnal bog'lanishi mavjud bo'lsa ushlanma ko'rsatiladi).
- `payments` — to'lanishi jurnali.

**Xatolar:**
- `403 Forbidden` — "salary" ruxsati yo'q.

---

## 12. TAKLIF VA SHIKOYATLAR (Feedback)

### 12.1 Taklif yoki shikoyat yuborish

```
POST /teacher/feedback
```

**Autentifikatsiya:** Majburiy

**Mazmun:** `multipart/form-data`
- `type` (text) — "suggestion" (taklif) yoki "complaint" (shikoyat)
- `text` (text) — xabar matni (majburiy)
- `image` (fayl, ixtiyoriy) — rasm (maks ~20MB)

**Javob (204 No Content)**

**Izoh:**
- Admin/superadmin "Taklif va shikoyatlar" bo'limida ko'radi.
- Yuboruvchi — o'qituvchi (role).

**Xatolar:**
- `400 Bad Request` — Matn bo'sh yoki rasm noto'g'ri.

---

## 13. BILDIRISHNOMALAR / PUSH (Notifications)

### 13.1 Bildirishnomalar tarix (push)

```
GET /teacher/notifications
```

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
{
  "unread": 5,
  "items": [
    {
      "id": "string",
      "title": "string",
      "body": "string",
      "type": "string",
      "createdAt": "2024-01-15T10:30:00Z",
      "read": false,
      "confirmed": false
    }
  ]
}
```

**Izoh:**
- Yuborilgan push-bildirishnomalar ro'yxati (oxirgi 100).
- `unread` — o'qilmagan soni.

---

### 13.2 Barcha bildirishnomalarni o'qilgan deb belgilash

```
POST /teacher/notifications/read
```

**Autentifikatsiya:** Majburiy

**Javob (204 No Content)**

**Izoh:**
- Barcha o'qilmagan bildirishnomalar o'qilgan deb belgilanadi.

---

### 13.3 Bitta bildirishnomani tasdiqlash

```
POST /teacher/notifications/{id}/confirm
```

**Parametrlar:**
- `id` (URL) — bildirishnoma ID'si

**Autentifikatsiya:** Majburiy

**Javob (204 No Content)**

**Izoh:**
- Admin shu tasdiqni ko'radi.

---

### 13.4 Qurilma push-token'ini ro'yxatdan o'tkazish

```
POST /teacher/notifications/register
```

**Autentifikatsiya:** Majburiy

**Mazmun (Body):**
```json
{
  "token": "string",
  "platform": "android|ios",
  "deviceName": "string|null",
  "appId": "string|null"
}
```

**Javob (200 OK):**
```json
{
  "ok": true
}
```

**Izoh:**
- Mobil ilovasida birinchi marta chaqiriladi (Firebase FCM token).
- Platform — "android" (default) yoki "ios".

**Xatolar:**
- `400 Bad Request` — Token bo'sh.

---

### 13.5 Qurilma tokenini o'chirish (logout)

```
DELETE /teacher/notifications/register
```

**Parametrlar:**
- `token` (query) — push-token

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
{
  "ok": true
}
```

**Izoh:**
- Logout'da chaqiriladi.

---

## 14. SUPPORT O'QITUVCHI (Support Teacher)

*(Agar `teacher.isSupport` = true bo'lsa — faqat shu o'qituvchi uchun)*

### 14.1 O'z bo'sh vaqt slotlari

```
GET /teacher/support/slots
```

**Parametrlar:**
- `month` (ixtiyoriy) — "yyyy-MM" (oylar bo'yicha filtir)

**Autentifikatsiya:** Majburiy

**Javob (200 OK):**
```json
[
  {
    "id": "string",
    "teacherId": "string",
    "date": "yyyy-MM-dd",
    "startTime": "HH:mm",
    "endTime": "HH:mm",
    "status": "open|booked|done",
    "studentId": "string|null",
    "studentName": "string|null",
    "topic": "string|null",
    "notes": "string|null",
    "bookedAt": "2024-01-15T10:30:00Z|null"
  }
]
```

**Izoh:**
- O'qituvchining barcha slotlari (bo'sh, bron qilingan, o'tilgan).

**Xatolar:**
- `400 Bad Request` — Support o'qituvchi emas.

---

### 14.2 Bo'sh vaqt bloki qo'shish

```
POST /teacher/support/slots
```

**Autentifikatsiya:** Majburiy

**Mazmun (Body):**
```json
{
  "date": "yyyy-MM-dd",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "slotMinutes": 30,
  "repeatWeeks": 4,
  "repeatMode": "weekly",
  "endDate": "yyyy-MM-dd|null"
}
```

**Javob (200 OK):**
```json
{
  "created": 8
}
```

**Izoh:**
- `slotMinutes` — har o'quvchiga shuncha daqiqalik bron-slot.
- `repeatWeeks` — haftalik takrori (shu hafta kuni keyingi N haftaga).
- `repeatMode` — "daily" (har kun, StartDate..EndDate) yoki "weekly" (haftalik).
- `created` — yaratilgan slotlar soni.

**Xatolar:**
- `400 Bad Request` — Sana yoki vaqt noto'g'ri.
- `400 Bad Request` — Support o'qituvchi emas.

---

### 14.3 Slotni o'chirish

```
DELETE /teacher/support/slots/{id}
```

**Parametrlar:**
- `id` (URL) — slot ID'si

**Autentifikatsiya:** Majburiy

**Javob (204 No Content)**

**Izoh:**
- Faqat o'tilmagan slotlarni o'chirish mumkin.

**Xatolar:**
- `400 Bad Request` — Slot o'tilgan.
- `404 Not Found` — Slot topilmadi.

---

### 14.4 Bron qilingan darsni yopish (o'tildi)

```
POST /teacher/support/slots/{id}/complete
```

**Parametrlar:**
- `id` (URL) — slot ID'si

**Autentifikatsiya:** Majburiy

**Mazmun (Body):**
```json
{
  "topic": "string",
  "notes": "string|null"
}
```

**Javob (204 No Content)**

**Izoh:**
- Slot status "done" (o'tildi).
- `topic` va `notes` saqlanadi (o'quvchi profilidagi support feedback uchun).

**Xatolar:**
- `400 Bad Request` — Slot bron qilinmagan.
- `404 Not Found` — Slot topilmadi.

---

## XAT-HARITASI (Error Codes)

| Kod | Ma'no | Sabab |
|-----|-------|-------|
| 200 OK | Muvaffaqiyatli | So'rov bajarildi |
| 204 No Content | Muvaffaqiyatli (kontentsiz) | O'zgartirish qabul qilindi |
| 400 Bad Request | Noto'g'ri so'rov | Parametr noto'g'ri, validatsiya xatosi |
| 401 Unauthorized | Autentifikatsiya kerak | Token yo'q yoki eskirgan |
| 403 Forbidden | Ruxsat yo'q | O'qituvchida ruxsat yo'q (permissioni) |
| 404 Not Found | Topilmadi | Entity topilmadi |
| 500 Internal Server Error | Server xatosi | Tizim ichki xatosi |

---

## UMUMI ESLATMALAR

1. **Vaqt formati:** Barcha vaqtlar ISO 8601 formatida ("2024-01-15T10:30:00Z").
2. **Sana formati:** Barcha sanalar "yyyy-MM-dd" formatida.
3. **Token revokatsiya:** Akkaunt arxivlanganda token amal qilmaydi (qayta login kerak).
4. **Jurnal siyosati:** Admin "Guruhlar → Jurnal boshqaruvi"da sozlasngan qoida qo'llaniladi.
5. **Ruxsatlar:** O'qituvchi login'da `permissions` ro'yxatida ko'rsa — u bo'limdan foydalanishi mumkin.
6. **Dars savalari:** O'qituvchi faqat o'z guruhlari o'quvchilariga yozuvlar qo'shishi mumkin.

---

**Hujjat versiyasi:** 1.0  
**Oxirgi yangilash:** 2024-07-11  
**Til:** O'zbek (Lotin yozuvi)
