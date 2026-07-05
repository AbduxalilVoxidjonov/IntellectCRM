# IntellectCRM — O'quvchi (Student) API hujjati

**Versiya:** 1.0  
**Sana:** 2026-07-05  
**Til:** O'zbek (lotin alifbosi)

---

## 1. Asosiy ma'lumot

### BaseURL

```
https://crm.intellectschool.uz
```

**Muhim:** Faqat HTTPS (HTTP yo'q). Hammasi HTTPS orqali keladigan data JSON formatida.

### JSON Format

- **Camel Case** — hammasida: `userId`, `createdAt`, `monthlyFee` va h.z.
- **Sanalar** — ISO 8601 (miqdori: `2026-07-05T14:30:00` yoki `2026-07-05`)
- **Raqamlar** — o'nliklar (desimal): `12.50`, raqamli massivlar `[1, 2, 3]`

### Authentication (JWT)

Muvaffaqiyatli login'dan keyin **access token** olasiz. Barcha so'rovlarda header orqali yuboring:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Tokenni o'z akkaunt saqlashda (qo'lda refresh shart emas) → ilova restartdan keyingi qayta kirish kerakligini tasdiqlab qo'yish mumkin.

---

## 2. Auth endpointlari

### 2.1 Login

**Endpoint:** `POST /api/auth/login`

**Vaziifasi:** O'quvchi (yoki ota-ona) email va parolni kiritib, JWT token va foydalanuvchi ma'lumotini oladi.

**So'rov (Request):**

```json
{
  "email": "student@example.com",
  "password": "password123"
}
```

| Maydon | Turi | Tavsif |
|-------|------|--------|
| email | string | Login sifatida ishlatiladigan email (unique) |
| password | string | Parol |

**Javob (Response): 200 OK**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_abc123",
    "fullName": "Alisher Isoqov",
    "role": "student",
    "email": "student@example.com",
    "avatarUrl": "/uploads/avatar.jpg",
    "phone": "+998-90-123-45-67"
  }
}
```

| Maydon | Turi | Tavsif |
|-------|------|--------|
| token | string | JWT access token (hammasida joylashtiriladi: `Authorization: Bearer <token>`) |
| user.id | string | Foydalanuvchi ID |
| user.fullName | string | To'liq ismi |
| user.role | string | Rol: `student`, `parent`, `teacher`, `admin`, `superadmin` |
| user.email | string | Email |
| user.avatarUrl | string? | Avatar rasm URL (bo'lsa) |
| user.phone | string? | Telefon |

**Xatolar:**

- **400/401 Unauthorized:** "Login yoki parol noto'g'ri"
- **401 Unauthorized:** "Akkaunt arxivlangan yoki to'xtatilgan"
- **401 Unauthorized:** "Sizning hisobingiz hali aktiv emas. Administratorga murojaat qiling." (LoginBlocked=true)

---

### 2.2 Me (Joriy foydalanuvchi ma'lumotlari)

**Endpoint:** `GET /api/auth/me`

**Auth:** Kerak (JWT token header'da)

**Vaziifasi:** Joriy tizimda kirgan foydalanuvchining ma'lumotlarini qaytaradi.

**So'rov:** Bo'sh

**Javob: 200 OK**

```json
{
  "id": "usr_abc123",
  "fullName": "Alisher Isoqov",
  "role": "student",
  "email": "student@example.com",
  "avatarUrl": "/uploads/avatar.jpg",
  "phone": "+998-90-123-45-67"
}
```

**Xatolar:**

- **401 Unauthorized:** Token yo'q yoki invalid

---

### 2.3 Parolni o'zgartirish

**Endpoint:** `PUT /api/auth/account`

**Auth:** Kerak (JWT token)

**Vaziifasi:** O'quvchi o'z email va/yoki parolini almashtiradi. Joriy parol orqali tasdiqlanadi.

**So'rov:**

```json
{
  "email": "newemail@example.com",
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456",
  "phone": "+998-90-987-65-43"
}
```

| Maydon | Turi | Tavsif |
|-------|------|--------|
| email | string? | Yangi email (bo'sh bo'lsa o'zgartirilmaydi) |
| currentPassword | string | Joriy parol (TALAB) |
| newPassword | string? | Yangi parol (kamida 8 belgi; bo'sh bo'lsa o'zgartirilmaydi) |
| phone | string? | Telefon raqami (ixtiyoriy) |

**Javob: 200 OK**

```json
{
  "id": "usr_abc123",
  "fullName": "Alisher Isoqov",
  "role": "student",
  "email": "newemail@example.com",
  "avatarUrl": "/uploads/avatar.jpg",
  "phone": "+998-90-987-65-43"
}
```

**Xatolar:**

- **400 Bad Request:** "Joriy parol noto'g'ri"
- **400 Bad Request:** "Bu login allaqachon band"
- **400 Bad Request:** "Yangi parol kamida 8 belgidan iborat bo'lsin"

---

## 3. Student Portal API (`/api/student`)

Bu bo'lim o'quvchi ilovasi uchun asosiy endpointlar (profil, darslar, baholar, davomat, chat, topshiriqlar va h.z.).

### 3.1 Profil va Meta ma'lumotlar

#### 3.1.1 Profil (O'quvchi ma'lumotlari)

**Endpoint:** `GET /api/student/me`

**Auth:** Kerak

**Parametrlar:** 
- `?studentId=...` — faqat admin uchun; student o'z profilini ko'radi

**Vaziifasi:** O'quvchining profil ma'lumotlarini qaytaradi (FISH, guruhi, ota-ona, sana, hujjatlar).

**Javob: 200 OK**

```json
{
  "id": "std_xyz789",
  "fullName": "Alisher Isoqov",
  "className": "10-A",
  "birthDate": "2008-05-15",
  "gender": "Male",
  "parentFullName": "Otabek Isoqov",
  "parentPhone": "+998-90-123-45-67",
  "enrollmentDate": "2024-09-01",
  "birthCertificateUrl": "/uploads/birth_cert.pdf",
  "parentPassportUrl": "/uploads/passport.jpg"
}
```

---

#### 3.1.2 Center (Markaz nomi)

**Endpoint:** `GET /api/student/school`

**Auth:** Kerak

**Vaziifasi:** O'quv markazi nomini, logo va Telegram kanalini qaytaradi (ilova brendingi uchun).

**Javob: 200 OK**

```json
{
  "name": "Intellect School",
  "telegramChannel": "@intellectschool",
  "logoUrl": "/uploads/logo.png"
}
```

---

#### 3.1.3 Meta (Dars vaqtlari, davomatsizlik sabablari, choraklar)

**Endpoint:** `GET /api/student/meta`

**Auth:** Kerak

**Vaziifasi:** O'quv markazi meta: dars vaqtlari, davomatsizlik sabablari, chorak oralig'i, boshqa sozlamalar.

**Javob: 200 OK**

```json
{
  "lessonTimes": [
    {
      "period": 1,
      "startTime": "09:00",
      "endTime": "09:45"
    },
    {
      "period": 2,
      "startTime": "10:00",
      "endTime": "10:45"
    }
  ],
  "absenceReasons": [
    {
      "id": "reason_1",
      "name": "Kasal",
      "short": "K",
      "isLate": false
    },
    {
      "id": "reason_2",
      "name": "Kech qoldi",
      "short": "Kq",
      "isLate": true
    }
  ],
  "quarters": [
    {
      "quarter": 1,
      "startDate": "2024-09-01",
      "endDate": "2024-11-30",
      "gradesOpen": true
    }
  ]
}
```

---

#### 3.1.4 Notebook (Shaxsiy daftar — TO'LIQ profil + ohali)

**Endpoint:** `GET /api/student/notebook`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchining TO'LIQ "shaxsiy daftari" — profil, baholar, davomat, intizomiy ball, topshiriqlar, balans hammasini BITTA so'rovda.

**Javob: 200 OK** (tuzilishi juda katta, asosiy qismlar):

```json
{
  "student": {
    "id": "std_xyz789",
    "fullName": "Alisher Isoqov",
    "className": "10-A",
    "birthDate": "2008-05-15"
  },
  "enrollment": "2024-09-01",
  "personalData": {
    "address": "Tashkent",
    "phone": "+998-91-234-56-78",
    "birthCertificateUrl": "/uploads/birth_cert.pdf"
  },
  "balance": 50000,
  "groups": [
    {
      "id": "grp_123",
      "groupName": "English A1",
      "courseName": "English",
      "teacherName": "Maria",
      "monthlyFee": 100000,
      "status": "active"
    }
  ],
  "gradesData": {
    "1": [
      {
        "subjectId": "subj_eng",
        "subjectName": "English",
        "grades": [4, 5, 4, 5],
        "average": 4.5
      }
    ]
  },
  "attendance": {
    "1": {
      "present": 18,
      "absent": 2,
      "lateCount": 1,
      "sickDays": 2,
      "excellentPercent": 0.89
    }
  },
  "disciplineScore": 95,
  "assignmentStats": {
    "completed": 15,
    "pending": 2,
    "totalScore": 320
  }
}
```

---

### 3.2 Dashboard (Bosh sahifa)

**Endpoint:** `GET /api/student/dashboard`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** Bosh sahifa uchun YAGONA chaqiruv — profil + meta + bugungi darslar + bugungi baholar + bajarilmagan topshiriqlar soni + balans.

**Javob: 200 OK**

```json
{
  "profile": {
    "id": "std_xyz789",
    "fullName": "Alisher Isoqov",
    "className": "10-A",
    "birthDate": "2008-05-15"
  },
  "meta": {
    "lessonTimes": [
      {"period": 1, "startTime": "09:00", "endTime": "09:45"}
    ],
    "absenceReasons": [],
    "quarters": []
  },
  "todayLessons": [
    {
      "period": 1,
      "startTime": "09:00",
      "endTime": "09:45",
      "subjectId": "subj_eng",
      "subjectName": "English",
      "teacherId": "tchr_123",
      "teacherName": "Maria"
    }
  ],
  "todayGrades": [
    {
      "date": "2026-07-05",
      "period": 1,
      "subjectId": "subj_eng",
      "subjectName": "English",
      "topic": "Past Simple",
      "homework": "Exercise 5 p.20",
      "conducted": true,
      "grade": 5,
      "reasonId": null,
      "reasonName": null,
      "isLate": false
    }
  ],
  "pendingAssignments": 2,
  "balance": 50000,
  "monthlyFee": 100000
}
```

---

### 3.3 Baholar va davomat

#### 3.3.1 Baholar (Darslar bo'yicha)

**Endpoint:** `GET /api/student/grades`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchining fanlar bo'yicha baholarni chorak bo'yicha umumlashtirib qaytaradi.

**Javob: 200 OK**

```json
{
  "report": {
    "1": [
      {
        "subjectId": "subj_eng",
        "subjectName": "English",
        "grades": [5, 4, 5, 4, 5],
        "average": 4.6
      },
      {
        "subjectId": "subj_math",
        "subjectName": "Mathematics",
        "grades": [4, 4, 5, 3],
        "average": 4.0
      }
    ]
  }
}
```

---

#### 3.3.2 Davomat (kunlik + chorak bo'yicha)

**Endpoint:** `GET /api/student/attendance`

**Auth:** Kerak

**Parametrlar:**
- `?quarter=1` — chorakni tanlash (ixtiyoriy)
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchi davomati: chorak bo'yicha umumiy ko'rsatkichlar + kunlik davomatsizlik/kech qolish ro'yxati.

**Javob: 200 OK**

```json
{
  "attendance": {
    "1": {
      "presentCount": 18,
      "absentCount": 2,
      "lateCount": 1,
      "sickDays": 2,
      "excellentPercent": 0.89
    }
  },
  "absences": [
    {
      "date": "2026-06-15",
      "period": 1,
      "quarter": 1,
      "subjectId": "subj_eng",
      "subjectName": "English",
      "reasonId": "reason_1",
      "reasonName": "Kasal",
      "isLate": false,
      "isSickness": true
    }
  ]
}
```

---

#### 3.3.3 Reyting (O'quvchi reyting)

**Endpoint:** `GET /api/student/rating`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchi reyting (o'z guruhda to'liq, o'quv markazi bo'yicha TOP 15). O'z o'rni alohida `MeStudentId` bilan, markaz o'rni `MeSchoolRank` bilan.

**Javob: 200 OK**

```json
{
  "meStudentId": "std_xyz789",
  "classRows": [
    {
      "rank": 1,
      "studentId": "std_abc",
      "fullName": "Alisher Isoqov",
      "className": "10-A",
      "average": 4.6,
      "attendance": 95.0
    },
    {
      "rank": 2,
      "studentId": "std_def",
      "fullName": "Fotima Karim",
      "className": "10-A",
      "average": 4.4,
      "attendance": 94.0
    }
  ],
  "schoolRows": [
    {
      "rank": 1,
      "studentId": "std_xyz",
      "fullName": "Javohir Abdullayev",
      "className": "10-B",
      "average": 4.8,
      "attendance": 98.0
    }
  ],
  "meSchoolRank": 5,
  "totalStudents": 234
}
```

---

### 3.4 Intizomiy ball

**Endpoint:** `GET /api/student/discipline`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchi intizomiy balli (100 dan boshlanadi), rag'bat(+)/jazo(−), tarix.

**Javob: 200 OK**

```json
{
  "currentScore": 95,
  "positivePoints": 5,
  "negativePoints": 10,
  "history": [
    {
      "id": "disc_1",
      "studentId": "std_xyz789",
      "reasonName": "Dars uchun ta'sirli boshqaruvchi",
      "points": 5,
      "note": "Yaxshi o'qish natijasiga",
      "createdAt": "2026-06-20",
      "createdBy": "admin",
      "type": "manual"
    },
    {
      "id": "entry_123",
      "studentId": "std_xyz789",
      "reasonName": "Kecha kirgan",
      "points": -2,
      "note": "Jurnal davomati",
      "createdAt": "2026-06-15",
      "createdBy": "",
      "type": "attendance"
    }
  ]
}
```

---

### 3.5 Moliya (To'lovlar va balans)

**Endpoint:** `GET /api/student/finance`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchi moliya: oylik hisoblar, to'lovlar, balans, chegirma.

**Javob: 200 OK**

```json
{
  "studentId": "std_xyz789",
  "fullName": "Alisher Isoqov",
  "balance": 50000,
  "charges": [
    {
      "id": "charge_1",
      "month": "2026-06",
      "groupId": "grp_123",
      "groupName": "English A1",
      "amount": 100000,
      "discount": 10000,
      "charged": "2026-06-01",
      "status": "paid"
    }
  ],
  "payments": [
    {
      "id": "pay_1",
      "amount": 90000,
      "date": "2026-06-02",
      "method": "cash",
      "note": "Jayatoshni to'ladi"
    }
  ]
}
```

---

### 3.6 Chatlar (Guruh chati)

**Endpoint:** `GET /api/student/chat`

**Auth:** Kerak

**Parametrlar:**
- `?since=2026-07-05T10:00:00` — bu vaqtdan keyingi xabarlar (ixtiyoriy)
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchining guruhi chati — faqat o'z guruhi uchun xabarlar.

**Javob: 200 OK**

```json
[
  {
    "id": "msg_1",
    "userId": "usr_123",
    "userName": "Alisher Isoqov",
    "text": "Bugun mashq qanday bo'ldi?",
    "timestamp": "2026-07-05T14:30:00",
    "avatarUrl": "/uploads/avatar.jpg"
  },
  {
    "id": "msg_2",
    "userId": "usr_124",
    "userName": "Fotima Karim",
    "text": "Yaxshi bo'ldi!",
    "timestamp": "2026-07-05T14:32:00",
    "avatarUrl": "/uploads/avatar2.jpg"
  }
]
```

---

#### 3.6.1 Chat xabar yuborish

**Endpoint:** `POST /api/student/chat`

**Auth:** Kerak (faqat student/parent roli)

**So'rov:**

```json
{
  "text": "Bugun dars qanday o'tdi?"
}
```

**Javob: 200 OK**

```json
{
  "id": "msg_3",
  "userId": "usr_123",
  "userName": "Alisher Isoqov",
  "text": "Bugun dars qanday o'tdi?",
  "timestamp": "2026-07-05T14:35:00",
  "avatarUrl": "/uploads/avatar.jpg"
}
```

**Xatolar:**

- **400 Bad Request:** "Xabar bo'sh"
- **400 Bad Request:** "Guruh biriktirilmagan"

---

### 3.7 Topshiriqlar

#### 3.7.1 O'z topshiriqlar ro'yxati

**Endpoint:** `GET /api/student/assignments`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchi o'z guruhiga berilgan topshiriqlar — har birida o'z holati (bajardi/ball).

**Javob: 200 OK**

```json
[
  {
    "id": "asgn_1",
    "title": "Essay Writing",
    "format": "writing",
    "dueDate": "2026-07-10",
    "maxScore": 100,
    "completed": false,
    "score": null,
    "submittedAt": null,
    "note": "Use past tense"
  },
  {
    "id": "asgn_2",
    "title": "Listening Test",
    "format": "test",
    "dueDate": "2026-07-08",
    "maxScore": 50,
    "completed": true,
    "score": 42,
    "submittedAt": "2026-07-07T10:15:00",
    "note": ""
  }
]
```

---

#### 3.7.2 Topshiriq tafsilotlari

**Endpoint:** `GET /api/student/assignments/{id}`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** Topshiriq tafsilotlari (test bo'lsa — to'g'ri javobsiz savollar, writing bo'lsa prompt, speaking bo'lsa script).

**Javob: 200 OK**

```json
{
  "id": "asgn_1",
  "title": "Essay Writing",
  "format": "writing",
  "prompt": "Describe your summer holidays",
  "dueDate": "2026-07-10",
  "maxScore": 100,
  "instructions": "Write 200-250 words in Past Simple and Present Perfect",
  "completed": false,
  "score": null,
  "fileUrl": null,
  "questions": [],
  "submittedAt": null
}
```

---

#### 3.7.3 Topshiriqni topshirish

**Endpoint:** `POST /api/student/assignments/{id}/submit`

**Auth:** Kerak (faqat student roli)

**Vaziifasi:** O'quvchi topshiriqni topshiradi (fayl yukla, yozma/test javob, yoki speaking audio).

**So'rov (multipart/form-data):**

```
{
  "score": 85,                    // test uchun faqat
  "answers": "[0, 2, 1, 3, ...]", // test uchun
  "text": "My summer holidays...", // writing uchun
  "file": <binary>                // fayl uchun
}
```

**Javob: 200 OK**

```json
{
  "completed": true,
  "score": 85,
  "message": "Topshiriq qabul qilindi"
}
```

**Xatolar:**

- **404 Not Found:** Topshiriq topilmadi
- **400 Bad Request:** "Topshiriq formati noto'g'ri"

---

#### 3.7.4 Speaking topshiriq (Audio)

**Endpoint:** `POST /api/student/assignments/{id}/speaking`

**Auth:** Kerak (student/parent)

**Vaziifasi:** O'quvchi speaking topshiriqqa audio WAV fayli yuboradi. Azure talaffuzni baholaydi, natija + avto-baho saqlanadi.

**So'rov (multipart/form-data):**

```
{
  "audio": <WAV file, max 8MB>
}
```

**Javob: 200 OK**

```json
{
  "recognizedText": "I like to play football",
  "pronScore": 78.5,
  "accuracy": 81.0,
  "fluency": 75.0,
  "completeness": 80.0,
  "prosody": 72.0,
  "words": [
    {
      "word": "like",
      "accuracy": 85.0,
      "errorType": ""
    }
  ],
  "error": null
}
```

**Xatolar:**

- **400 Bad Request:** "Audio bo'sh"
- **400 Bad Request:** "Audio juda katta (8 MB dan oshmasin)"
- **400 Bad Request:** "Audio formati noto'g'ri (WAV kutilgan)"

---

### 3.8 Bildirishnomalar (Push Notifications)

#### 3.8.1 Bildirishnomalar tarixi

**Endpoint:** `GET /api/student/notifications`

**Auth:** Kerak

**Vaziifasi:** Yuborilgan push bildirishnomalarning tarixi (eng yangi birinchi, 100 ta oxirgi). O'qilmaganlar soni.

**Javob: 200 OK**

```json
{
  "unreadCount": 3,
  "items": [
    {
      "id": "notif_1",
      "title": "Yangi baholar",
      "body": "English fanidan 5 baho qo'yildi",
      "type": "grade",
      "createdAt": "2026-07-05T14:30:00",
      "readAt": null,
      "confirmedAt": null
    },
    {
      "id": "notif_2",
      "title": "Topshiriq",
      "body": "Yangi Essay Writing topshiriq berildi",
      "type": "assignment",
      "createdAt": "2026-07-05T10:00:00",
      "readAt": "2026-07-05T10:15:00",
      "confirmedAt": "2026-07-05T10:16:00"
    }
  ]
}
```

---

#### 3.8.2 O'qilgan deb belgilash

**Endpoint:** `POST /api/student/notifications/read`

**Auth:** Kerak

**Vaziifasi:** Barcha bildirishnomalarni o'qilgan deb belgilaydi.

**So'rov:** Bo'sh

**Javob: 204 No Content**

---

#### 3.8.3 Bitta bildirishnomani tasdiqlash

**Endpoint:** `POST /api/student/notifications/{id}/confirm`

**Auth:** Kerak

**Vaziifasi:** O'quvchi bildirishnomani o'qib tasdiqlaganini belgilaydi (admin buni ko'radi).

**So'rov:** Bo'sh

**Javob: 204 No Content**

---

#### 3.8.4 Qurilma tokenini ro'yxatdan o'tkazish

**Endpoint:** `POST /api/student/notifications/register`

**Auth:** Kerak (faqat student roli)

**Vaziifasi:** Mobil qurilmaning FCM/push tokenini ro'yxatdan o'tkazadi. Token boshqa foydalanuvchiga bog'langan bo'lsa, joriy foydalanuvchiga ko'chiriladi.

**So'rov:**

```json
{
  "token": "c9dXQ6WZwfE:APA91bEIpLAX...",
  "platform": "android",
  "deviceName": "Samsung A10",
  "appId": "com.intellectcrm.student"
}
```

| Maydon | Turi | Tavsif |
|-------|------|--------|
| token | string | FCM token |
| platform | string? | Platform: `android`, `ios`, `web` (default: android) |
| deviceName | string? | Qurilma nomi (ixtiyoriy) |
| appId | string? | Ilova paketi (ixtiyoriy) |

**Javob: 200 OK**

```json
{
  "ok": true
}
```

---

#### 3.8.5 Qurilma tokenini o'chirish

**Endpoint:** `DELETE /api/student/notifications/register`

**Auth:** Kerak (faqat student roli)

**Parametrlar:**
- `?token=...` — o'chirish tokenini

**Vaziifasi:** Qurilma tokenini o'chirib, push bildirishnomalar to'xtatiladi.

**Javob: 200 OK**

```json
{
  "ok": true
}
```

---

### 3.9 Sozlamalar

#### 3.9.1 O'quvchi sozlamalarini olish

**Endpoint:** `GET /api/student/settings`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchining til, tema, bildirishnoma sozlamasini qaytaradi.

**Javob: 200 OK**

```json
{
  "language": "uz",
  "theme": "system",
  "notificationsEnabled": true
}
```

---

#### 3.9.2 Sozlamani yangilash

**Endpoint:** `PUT /api/student/settings`

**Auth:** Kerak (faqat student roli)

**So'rov:**

```json
{
  "language": "uz",
  "theme": "dark",
  "notificationsEnabled": false
}
```

**Javob: 200 OK**

```json
{
  "language": "uz",
  "theme": "dark",
  "notificationsEnabled": false
}
```

---

### 3.10 Parolni almashtirish

**Endpoint:** `PUT /api/student/password`

**Auth:** Kerak (student/parent roli)

**Vaziifasi:** O'quvchi o'z parolini almashtiradi (joriy parol bilan tasdiqlanadi).

**So'rov:**

```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

**Javob: 200 OK**

```json
{
  "message": "Parol almashtirildi"
}
```

**Xatolar:**

- **400 Bad Request:** "Joriy parol noto'g'ri"
- **400 Bad Request:** "Yangi parol kamida 8 belgidan iborat bo'lsin"

---

### 3.11 Joylashuv (GPS)

#### 3.11.1 Joylashuvni yangilash

**Endpoint:** `PUT /api/student/location`

**Auth:** Kerak (student/parent roli)

**Vaziifasi:** Uy joylashuvini (GPS koordinata) yangilash. Mobil ilovadan GPS orqali keladigan latitude/longitude.

**So'rov:**

```json
{
  "latitude": 41.2995,
  "longitude": 69.2401,
  "address": "Tashkent, Yunusobod tumani"
}
```

| Maydon | Turi | Tavsif |
|-------|------|--------|
| latitude | number | GPS latitude (-90..90) |
| longitude | number | GPS longitude (-180..180) |
| address | string? | Manzil tavsifi (ixtiyoriy) |

**Javob: 200 OK**

```json
{
  "ok": true
}
```

**Xatolar:**

- **400 Bad Request:** "Koordinatalar noto'g'ri"

---

#### 3.11.2 Joylashuvni o'qish

**Endpoint:** `GET /api/student/location`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** Saqlangan joylashuvni (xarita uchun) qaytaradi.

**Javob: 200 OK**

```json
{
  "latitude": 41.2995,
  "longitude": 69.2401,
  "address": "Tashkent, Yunusobod tumani",
  "updatedAt": "2026-07-05T14:30:00"
}
```

---

### 3.12 Support darslar (Yordam darslar)

#### 3.12.1 Support o'qituvchilar va bo'sh slotlar

**Endpoint:** `GET /api/student/support`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** Support o'qituvchilar ro'yxati (bo'sh slotlari bilan) + o'quvchining o'z bronlari.

**Javob: 200 OK**

```json
{
  "teachers": [
    {
      "id": "tchr_1",
      "fullName": "Maria Sergeyevna",
      "photoUrl": "/uploads/photo.jpg",
      "subjects": "English, IELTS",
      "openSlots": [
        {
          "id": "slot_1",
          "date": "2026-07-06",
          "startTime": "10:00",
          "endTime": "10:50"
        }
      ]
    }
  ],
  "myBookings": [
    {
      "id": "booking_1",
      "teacherId": "tchr_1",
      "teacherName": "Maria Sergeyevna",
      "date": "2026-07-06",
      "startTime": "10:00",
      "endTime": "10:50",
      "status": "booked",
      "topic": "",
      "notes": ""
    }
  ]
}
```

---

#### 3.12.2 Bo'sh slotni bron qilish

**Endpoint:** `POST /api/student/support/slots/{id}/book`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** Bo'sh support slotni bron qiladi (race-safe — ikki o'quvchi bir vaqtda bron qilsa faqat bittasi oladi).

**So'rov:** Bo'sh

**Javob: 204 No Content**

**Xatolar:**

- **404 Not Found:** Slot topilmadi
- **400 Bad Request:** "Bu vaqt allaqachon band qilingan"

---

#### 3.12.3 Bronni bekor qilish

**Endpoint:** `POST /api/student/support/slots/{id}/cancel`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'z bronini bekor qiladi (o'tilgan darsni bekor qilish mumkin emas).

**So'rov:** Bo'sh

**Javob: 204 No Content**

**Xatolar:**

- **404 Not Found:** Slot topilmadi yoki boshqa foydalanuvchining bronini o'chirish uchun ruxsat yo'q
- **400 Bad Request:** "O'tilgan darsni bekor qilib bo'lmaydi"

---

### 3.13 LMS (Learning Management System)

#### 3.13.1 LMS fanlar ro'yxati (Progress bilan)

**Endpoint:** `GET /api/student/lms/subjects`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchining guruhi uchun LMS fanlar (progress bilan — o'tilgan mavzular soni / jami).

**Javob: 200 OK**

```json
[
  {
    "id": "subj_lms_1",
    "title": "English Essentials",
    "description": "Beginner level",
    "unlockMode": "sequential",
    "batchSize": 3,
    "totalTopics": 24,
    "completedTopics": 8
  }
]
```

---

#### 3.13.2 LMS modullari va mavzulari

**Endpoint:** `GET /api/student/lms/subjects/{subjectId}/modules`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** Fanning modullari — har modul ichida mavzular, ochilish tartibi va progress bilan.

**Javob: 200 OK**

```json
[
  {
    "id": "mod_1",
    "title": "Module 1: Greetings",
    "description": "Basic greetings",
    "order": 1,
    "totalTopics": 6,
    "completedTopics": 4,
    "topics": [
      {
        "id": "topic_1",
        "moduleId": "mod_1",
        "title": "Hello",
        "description": "Say hello",
        "videoUrl": "/uploads/video.mp4",
        "textContent": "...",
        "order": 1,
        "materials": [
          {
            "id": "mat_1",
            "name": "PDF",
            "url": "/uploads/material.pdf",
            "size": 1024,
            "contentType": "application/pdf"
          }
        ],
        "unlocked": true,
        "isCompleted": true
      }
    ]
  }
]
```

---

#### 3.13.3 Bitta mavzu tafsiloti

**Endpoint:** `GET /api/student/lms/topics/{topicId}`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** Mavzuni batafsil ko'rish (video, matn, materiallar). Qulflangan bo'lsa 403 xatosi.

**Javob: 200 OK**

```json
{
  "id": "topic_1",
  "moduleId": "mod_1",
  "title": "Hello",
  "description": "Say hello",
  "videoUrl": "/uploads/video.mp4",
  "textContent": "Learning to greet...",
  "order": 1,
  "materials": [
    {
      "id": "mat_1",
      "name": "PDF",
      "url": "/uploads/material.pdf",
      "size": 1024,
      "contentType": "application/pdf"
    }
  ],
  "unlocked": true,
  "isCompleted": true
}
```

**Xatolar:**

- **403 Forbidden:** "Bu mavzu hali ochilmagan"
- **404 Not Found:** Mavzu topilmadi

---

#### 3.13.4 Mavzuni tugallagan deb belgilash

**Endpoint:** `POST /api/student/lms/topics/{topicId}/complete`

**Auth:** Kerak

**Vaziifasi:** Mavzuni tugallagan deb belgilash (sequential unlock uchun zarur).

**So'rov:** Bo'sh

**Javob: 204 No Content**

---

### 3.14 Curriculum (O'quv dasturi)

#### 3.14.1 O'quv dasturi — bandlar ro'yxati

**Endpoint:** `GET /api/student/curriculum`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchining har faol kurs bo'yicha o'quv dasturi (bandlar) — o'tilgan/qolgan foiz va tugash prognozi.

**Javob: 200 OK**

```json
[
  {
    "groupId": "grp_123",
    "groupName": "English A1",
    "courseId": "subj_eng",
    "courseName": "English",
    "completedItems": 12,
    "totalItems": 24,
    "completionPercent": 50.0,
    "estimatedCompletionDate": "2026-08-15",
    "items": [
      {
        "id": "item_1",
        "topicId": "topic_1",
        "title": "Lesson 1",
        "order": 1,
        "done": true,
        "type": "lesson"
      }
    ]
  }
]
```

---

#### 3.14.2 Dars kontenti

**Endpoint:** `GET /api/student/curriculum/item/{id}`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** Bitta dars kontenti (Duolingo uslubida): video/matn/audio/lug'at/test. Faqat ochiq bo'lsa ko'rinadi.

**Javob: 200 OK**

```json
{
  "id": "item_1",
  "topicId": "topic_1",
  "text": "Lesson 1",
  "note": "Basic",
  "order": 1,
  "type": "lesson",
  "videoUrl": "/uploads/lesson.mp4",
  "audioUrl": "/uploads/audio.mp3",
  "textContent": "...",
  "pdfUrl": "/uploads/lesson.pdf",
  "pdfName": "Lesson 1 PDF",
  "meta": "{}",
  "vocab": [
    {
      "word": "hello",
      "translation": "salom",
      "partOfSpeech": "noun",
      "example": "Hello, friend!"
    }
  ],
  "questions": [
    {
      "id": "q_1",
      "text": "What is hello in Uzbek?",
      "options": ["salom", "hayr", "rahmat"],
      "correctIndex": 0
    }
  ]
}
```

**Xatolar:**

- **403 Forbidden:** "Bu dars hali ochilmagan — o'qituvchi o'tgach ochiladi"

---

#### 3.14.3 Dars progressini yangilash

**Endpoint:** `POST /api/student/curriculum/progress`

**Auth:** Kerak (faqat student roli)

**Vaziifasi:** Dars progressini yangilash (o'tildi/o'tilmadi — upsert).

**So'rov:**

```json
{
  "itemId": "item_1",
  "done": true
}
```

**Javob: 200 OK**

```json
{
  "ok": true
}
```

**Xatolar:**

- **403 Forbidden:** O'quvchi shu kursda faol guruhda emas

---

### 3.15 AI Tekshiruv (Speaking/Writing)

#### 3.15.1 AI Tekshiruv holati

**Endpoint:** `GET /api/student/ai-check/status`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchi AI tekshiruv sozlamasi: kalitlar (Gemini/Azure) tayyorimi, limit, premium, blok.

**Javob: 200 OK**

```json
{
  "geminiReady": true,
  "azureReady": true,
  "premium": false,
  "blocked": false,
  "limit": 3,
  "usedToday": 1,
  "remaining": 2
}
```

---

#### 3.15.2 Writing (Yozma) tekshiruv

**Endpoint:** `POST /api/student/ai-check/writing`

**Auth:** Kerak (faqat student roli)

**Vaziifasi:** O'quvchi matn yozadi, Gemini tahlil qiladi (grammatika, vocabulary, coherence, hisliy soch va h.z.). IELTS task tanlansa 0-9 band; aks holda 0-100 ball.

**So'rov:**

```json
{
  "prompt": "Describe your favorite hobby",
  "text": "I like to read books because it is very interesting...",
  "taskType": "ielts_task2"
}
```

| Maydon | Turi | Tavsif |
|-------|------|--------|
| prompt | string? | Topshiriq (ixtiyoriy) |
| text | string | Yozilgan matn (kamita 10 belgi) |
| taskType | string? | IELTS task: `ielts_task1`, `ielts_task2`, yoki bo'sh (umumiy) |

**Javob: 200 OK**

```json
{
  "id": "check_1",
  "type": "writing",
  "prompt": "Describe your favorite hobby",
  "inputText": "I like to read books...",
  "recognizedText": "",
  "audioUrl": "",
  "score": 7.5,
  "date": "2026-07-05",
  "createdAt": "2026-07-05T14:30:00",
  "analysis": {
    "overall": 75,
    "level": "B1",
    "scores": {
      "grammar": 80,
      "vocabulary": 75,
      "coherence": 70,
      "task": 75,
      "mechanics": 80,
      "pronunciation": 0,
      "fluency": 0
    },
    "summary": "Good writing with minor errors",
    "strengths": ["Clear structure", "Good vocabulary"],
    "weaknesses": ["Some grammar issues"],
    "corrections": [
      {
        "original": "it is very interesting",
        "suggestion": "it is very interesting",
        "explanation": "Correct"
      }
    ],
    "vocabulary": [],
    "improved": "I like to read books because it is very interesting and helps me learn new things.",
    "recommendations": ["Practice gerunds", "Use more complex sentences"],
    "ielts": {
      "task": 7.0,
      "coherence": 7.5,
      "lexical": 7.0,
      "grammar": 8.0,
      "overall": 7.5,
      "taskType": "ielts_task2"
    }
  },
  "speech": null,
  "taskType": "ielts_task2"
}
```

**Xatolar:**

- **400 Bad Request:** "Matn juda qisqa (kamita 10 belgi)"
- **400 Bad Request:** "AI tekshiruv hali sozlanmagan"
- **429 Too Many Requests:** "Kunlik limit tugadi ({used}/{limit}). Premium uchun adminga murojaat qiling."

---

#### 3.15.3 Speaking (Nutq) tekshiruv

**Endpoint:** `POST /api/student/ai-check/speaking`

**Auth:** Kerak (faqat student roli)

**Vaziifasi:** Audio WAV yuboradi. Azure talaffuzni baholaydi (har so'z aniqligi), Gemini tahlili beradi. Natija: so'zlar yashil/qizil, talaffuz ball, maslahatlar.

**So'rov (multipart/form-data):**

```
{
  "audio": <WAV file, max 8MB>,
  "prompt": "Talk about your weekend",
  "referenceText": "I went to the park and played football"
}
```

| Maydon | Turi | Tavsif |
|-------|------|--------|
| audio | file | WAV fayli (max 8 MB) |
| prompt | string? | Topshiriq (ixtiyoriy) |
| referenceText | string? | Qo'llanma matn (ixtiyoriy, aniq per-so'z baholash uchun) |

**Javob: 200 OK**

```json
{
  "id": "check_2",
  "type": "speaking",
  "prompt": "Talk about your weekend",
  "inputText": "I went to the park and played football",
  "recognizedText": "I went to the park and played football",
  "audioUrl": "/uploads/aicheck-xyz.wav",
  "score": 76.5,
  "date": "2026-07-05",
  "createdAt": "2026-07-05T14:35:00",
  "analysis": {
    "overall": 77,
    "level": "B1",
    "scores": {
      "grammar": 75,
      "vocabulary": 76,
      "coherence": 78,
      "task": 77,
      "mechanics": 0,
      "pronunciation": 0,
      "fluency": 0
    },
    "summary": "Good pronunciation, clear speech",
    "strengths": ["Clear pronunciation"],
    "weaknesses": [],
    "corrections": [],
    "vocabulary": [],
    "improved": "",
    "recommendations": ["Practice intonation"],
    "ielts": null
  },
  "speech": {
    "recognizedText": "I went to the park and played football",
    "pronScore": 76.5,
    "accuracy": 81.0,
    "fluency": 75.0,
    "completeness": 80.0,
    "prosody": 72.0,
    "words": [
      {
        "word": "played",
        "accuracy": 85.0,
        "errorType": ""
      }
    ]
  },
  "taskType": ""
}
```

**Xatolar:**

- **400 Bad Request:** "Audio bo'sh"
- **400 Bad Request:** "Audio formati noto'g'ri (WAV kutilgan)"
- **400 Bad Request:** "Speaking baholash hali sozlanmagan"
- **429 Too Many Requests:** "Kunlik limit tugadi"

---

#### 3.15.4 AI Tekshiruv tarixi

**Endpoint:** `GET /api/student/ai-check/history`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** O'quvchi AI tekshiruv tarixi (eng yangi birinchi).

**Javob: 200 OK**

```json
[
  {
    "id": "check_1",
    "type": "writing",
    "prompt": "Describe your favorite hobby",
    "score": 75.0,
    "date": "2026-07-05",
    "createdAt": "2026-07-05T14:30:00",
    "hasAudio": false
  },
  {
    "id": "check_2",
    "type": "speaking",
    "prompt": "Talk about your weekend",
    "score": 76.5,
    "date": "2026-07-05",
    "createdAt": "2026-07-05T14:35:00",
    "hasAudio": true
  }
]
```

---

#### 3.15.5 Bitta AI tekshiruv yozuvi

**Endpoint:** `GET /api/student/ai-check/history/{id}`

**Auth:** Kerak

**Parametrlar:**
- `?studentId=...` — faqat admin uchun

**Vaziifasi:** Bitta AI tekshiruv to'liq yozuvi (tahlil, ovoz, so'zlar tahlili).

**Javob: 200 OK** (yuqoridagi 3.15.3 writing/speaking javob misollariga qarang)

---

### 3.16 Taklif va Shikoyatlar

**Endpoint:** `POST /api/student/feedback`

**Auth:** Kerak (student/parent)

**Vaziifasi:** O'quvchi/ota-ona taklif yoki shikoyat yuboradi (rasm yukla mumkin). Admin "Taklif va shikoyatlar" bo'limida ko'radi.

**So'rov (multipart/form-data):**

```
{
  "type": "complaint",
  "text": "Darsda shippasizliklar bor",
  "image": <optional file>
}
```

| Maydon | Turi | Tavsif |
|-------|------|--------|
| type | string | `complaint` (shikoyat) yoki `suggestion` (taklif) |
| text | string | Matn |
| image | file? | Rasm (ixtiyoriy) |

**Javob: 204 No Content**

---

### 3.17 Telegram ma'lumotlari

**Endpoint:** `GET /api/student/telegram`

**Auth:** Kerak (student/parent)

**Vaziifasi:** Telegram bot holati va ro'yxatlanganmi (ilova bot ni o'qitish uchun).

**Javob: 200 OK**

```json
{
  "configured": true,
  "botUsername": "intellect_school_bot",
  "botName": "Intellect School",
  "deepLink": "https://t.me/intellect_school_bot",
  "registered": false
}
```

---

### 3.18 Fayl yuklash

**Endpoint:** `POST /api/student/uploads`

**Auth:** Kerak (student roli)

**Vaziifasi:** O'quvchi rasm/PDF/video fayli yuklaydi (topshiriq javob uchun). Max ~20MB.

**So'rov (multipart/form-data):**

```
{
  "file": <binary file>
}
```

**Javob: 200 OK**

```json
{
  "fileName": "myessay.pdf",
  "fileUrl": "/uploads/myessay_xyz.pdf",
  "fileSize": 204800,
  "contentType": "application/pdf"
}
```

---

## 4. Xatolar va Status Kodlari

| Kod | Tavsif |
|-----|--------|
| 200 | Muvaffaqiyatli |
| 204 | Muvaffaqiyatli (javob yo'q) |
| 400 | So'rov noto'g'ri (validatsiya xatosi) |
| 401 | Autentifikasiya shart (token yo'q/invalid) |
| 403 | Ruxsat yo'q (token bor, lekin amalni qilishi mumkin emas) |
| 404 | Topilmadi |
| 429 | Limit tugadi (rate limiting) |
| 500 | Server xatosi |

### Xato Javob Formati

```json
{
  "message": "Tavsifli xato matnı",
  "errors": {
    "fieldName": ["Error 1", "Error 2"]
  }
}
```

---

## 5. Kotlin (Retrofit) Misollari

### Login

```kotlin
// Request
val request = LoginRequest("student@example.com", "password123")

// Response
val response = apiService.login(request)
val token = response.token
val user = response.user

// Authorization header uchun
val authHeader = "Bearer ${token}"
```

### Profil

```kotlin
val profile = apiService.getProfile(studentId = null)
println("Student: ${profile.fullName}")
println("Balance: ${profile.balance}")
```

### Darslar

```kotlin
val grades = apiService.getGrades()
// grades.report["1"] → chorak 1 baholar
```

### Chat xabar yuborish

```kotlin
val chatRequest = SendChatRequest("Bugun dars qanday?")
val message = apiService.sendChat(chatRequest)
```

### Topshiriq yuborish

```kotlin
val request = SubmitAssignmentRequest(
    score = 85,
    answers = "[0, 2, 1, 3]",
    text = null,
    file = null
)
val result = apiService.submitAssignment(assignmentId, request)
```

### Speaking (Audio yuborish)

```kotlin
val audioFile = File("/path/to/audio.wav")
val body = audioFile.asRequestBody("audio/wav".toMediaType())
val result = apiService.submitSpeaking(assignmentId, body)
```

---

## 6. Webhook va Real-time

**SignalR yo'q** — faqat REST API va push notifications (FCM).

### Push Notifications

Server tomonidan:
- Yangi baholar qo'yilganda
- Topshiriq berilganda
- Bildirishnomalar eslatmasi
- To'lov eslatmasi

Android ilovada FCM listener:

```kotlin
override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val title = remoteMessage.notification?.title
    val body = remoteMessage.notification?.body
    // UI yangilash
}
```

---

## 7. Rate Limiting

Login uchun rate limiting mavjud (brute-force zarurudan):

```
- Max 5 ta muvaffaqiyatsiz urinish 15 minut ichida
- IP bo'yicha kuzatuv
```

---

## Umumiy Eslatmalar

- **JSON camelCase** — barcha maydonlar camel case
- **ISO 8601 sanalar** — `2026-07-05T14:30:00`
- **Faqat HTTPS** — HTTP ishlamaydi
- **Token muhim** — localStorage'da (va'da qilish uchun `Secure` flag bilan)
- **Offline qo'llab-quvvatlash** — SQLite local cache + sync
- **Permissioner** — student faqat o'zining ma'lumotini o'zgartiradimi; parent farzandi nomidan
- **Immorallik kontrol** — admin `?studentId=...` bilan boshqa o'quvchini ko'radi

---

## Kontakt

**Admin:** admin@intellectschool.uz  
**Support:** support@intellectschool.uz  
**API Status:** https://crm.intellectschool.uz/health

---

*Last Updated: 2026-07-05*
