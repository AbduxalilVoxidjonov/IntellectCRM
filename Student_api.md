# IntellectCRM O'quvchi (Student) Mobil Ilova API

**Versiya:** 1.0  
**Base URL:** `https://crm.intellectschool.uz/api/student`  
**Autentifikatsiya:** JWT Bearer token (`Authorization: Bearer <token>`)  
**Javoblar:** JSON

---

## Autentifikatsiya (Auth)

### 1. Tizimga kirish (Login)

**Endpoint:** `POST /api/auth/login`  
**Auth:** Kerak emas (public)  
**Rate Limiting:** Yoqilgan (brute-force himoyasi)

**So'rov (Request):**
```json
{
  "email": "student@example.com",
  "password": "parol123456"
}
```

**Javob (Response) — 200 OK:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "student_id_uuid",
    "fullName": "Ali Karim",
    "role": "student",
    "email": "student@example.com",
    "avatarUrl": "/uploads/avatar.jpg",
    "permissions": null,
    "phone": "+998901234567"
  }
}
```

**Xatolar:**
- **401 Unauthorized:** Login yoki parol noto'g'ri; yoki akkaunt arxivlangan
- **Xabar:** `"Login yoki parol noto'g'ri"` | `"Akkaunt arxivlangan yoki to'xtatilgan"` | `"Sizning hisobingiz hali aktiv emas"`

**Izoh:** Token jo'natiladi — har keyin API so'rovlarida `Authorization: Bearer <token>` header'ini ishlating. Token JWT (JWT).

---

### 2. Joriy foydalanuvchi ma'lumotini o'qish

**Endpoint:** `GET /api/auth/me`  
**Auth:** Talab qilinadi (barcha roller)

**Javob (Response) — 200 OK:**
```json
{
  "id": "user_id_uuid",
  "fullName": "Ali Karim",
  "role": "student",
  "email": "student@example.com",
  "avatarUrl": "/uploads/avatar.jpg",
  "permissions": null,
  "phone": "+998901234567"
}
```

---

### 3. Akkaunt sozlamalari yangilash (Login/Parol o'zgartirish)

**Endpoint:** `PUT /api/auth/account`  
**Auth:** Talab qilinadi (barcha roller)

**So'rov (Request):**
```json
{
  "currentPassword": "eski_parol123",
  "email": "new_email@example.com",
  "newPassword": "yangi_parol123",
  "phone": "+998901234567"
}
```

**Maydonlar:**
- `currentPassword` (string, majburiyi) — hozirgi parol (tasdiqlanishi shart)
- `email` (string, ixtiyoriyi) — yangi login (kiritilsa o'zgaradi)
- `newPassword` (string, ixtiyoriyi) — yangi parol (bo'sh bo'lsa o'zgarmagni)
- `phone` (string, ixtiyoriyi) — telefon raqami (PhoneUtil.Normalize() orqali standartlashtirilib saqlanadi)

**Javob (Response) — 200 OK:**
```json
{
  "id": "user_id_uuid",
  "fullName": "Ali Karim",
  "role": "student",
  "email": "new_email@example.com",
  "avatarUrl": "/uploads/avatar.jpg",
  "permissions": null,
  "phone": "+998901234567"
}
```

**Xatolar:**
- **400 Bad Request:** `"Joriy parol noto'g'ri"` | `"Bu login allaqachon band"` | `"Yangi parol kamida 8 belgidan iborat bo'lsin"`
- **401 Unauthorized:** Token noto'g'ri

---

## Profil va Ma'lumotlar

### 4. O'quvchi profili (qisqa)

**Endpoint:** `GET /api/student/me`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun: o'quvchi ID (bo'sh bo'lsa xato)

**Javob (Response) — 200 OK:**
```json
{
  "id": "student_uuid",
  "fullName": "Ali Karim",
  "className": "7-A",
  "birthDate": "2010-05-15",
  "gender": "erkak",
  "parentFullName": "Karim Alievich",
  "parentPhone": "+998-90-123-45-67",
  "enrollmentDate": "2020-09-01",
  "photoUrl": "/uploads/photo.jpg",
  "parentPhotoUrl": "/uploads/parent.jpg"
}
```

---

### 5. O'quvchining TO'LIQ shaxsiy daftari (Notebook)

**Endpoint:** `GET /api/student/notebook`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**  
Kompleks DTO — profil + shaxsiy ma'lumot + fanlar bo'yicha baholar + davomat + reyting + intizomi + uy vazifalari + oylik trend:

```json
{
  "profile": { ... },
  "personalInfo": { ... },
  "grades": { ... },
  "attendance": { ... },
  "ratings": { ... },
  "disciplines": { ... },
  "assignments": { ... },
  "monthly": { ... }
}
```

**Izoh:** Admin "O'quvchilar" bo'limidagi detal sahifasi bilan bir xil ma'lumot.

---

### 6. Markaz meta-ma'lumotlari (Reference data)

**Endpoint:** `GET /api/student/meta`  
**Auth:** Talab qilinadi (barcha roller)  
**Query parametrlari:** Yo'q

**Javob (Response) — 200 OK:**
```json
{
  "quarters": [
    { "quarter": 1, "startDate": "2024-01-01", "endDate": "2024-03-31", "gradesOpen": true },
    { "quarter": 2, "startDate": "2024-04-01", "endDate": "2024-06-30", "gradesOpen": true }
  ],
  "currentQuarter": 1,
  "currentWeek": 10,
  "lessonTimes": [
    { "period": 1, "startTime": "09:00", "endTime": "09:45" },
    { "period": 2, "startTime": "09:55", "endTime": "10:40" }
  ],
  "absenceReasons": [
    { "id": "reason_uuid", "name": "Kasal", "short": "K", "isLate": false },
    { "id": "late_id", "name": "Kech qoldi", "short": "L", "isLate": true }
  ]
}
```

---

### 7. Markaz nomi (Brending)

**Endpoint:** `GET /api/student/school`  
**Auth:** Talab qilinadi  
**Query parametrlari:** Yo'q

**Javob (Response) — 200 OK:**
```json
{
  "name": "Intellect Kokand",
  "telegramChannel": "@intellect_kokand",
  "logoUrl": "/uploads/logo.png"
}
```

---

## Bildirishnomalar (Notifications)

### 8. Ilova bildirishnomaları (push) - tarix

**Endpoint:** `GET /api/student/notifications`  
**Auth:** Talab qilinadi (student, parent, admin)

**Javob (Response) — 200 OK:**
```json
{
  "unreadCount": 3,
  "items": [
    {
      "id": "notif_uuid",
      "title": "Yangi baho",
      "body": "Matematika: 5 ball",
      "type": "grade",
      "createdAt": "2024-07-11T14:30:00Z",
      "isRead": false,
      "isConfirmed": false
    },
    {
      "id": "notif2_uuid",
      "title": "Davomat xabari",
      "body": "Bugun davomatga qayd qilindiz",
      "type": "attendance",
      "createdAt": "2024-07-10T09:15:00Z",
      "isRead": true,
      "isConfirmed": true
    }
  ]
}
```

**Izoh:** Eng yangi 100 ta bildirishnoma qaytariladi (eng yangi birinchi).

---

### 9. Barcha bildirishnomalarni o'qilgan deb belgilash

**Endpoint:** `POST /api/student/notifications/read`  
**Auth:** Talab qilinadi (student, parent, admin)

**So'rov (Request):** Tanasi yo'q (body hammasi o'qiladi deb markerlashadi)

**Javob (Response) — 204 No Content**

---

### 10. Bitta bildirishnomani tasdiqlash

**Endpoint:** `POST /api/student/notifications/{id}/confirm`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Path parametrlar:**
- `id` (string, majburiyi) — bildirishnoma ID

**Javob (Response) — 204 No Content**

**Izoh:** Admin "O'quvchilar" sahifasida tasdiqlash holati ko'radi.

---

### 11. Push qurilma tokeni ro'yxatdan o'tkazish

**Endpoint:** `POST /api/student/notifications/register`  
**Auth:** Talab qilinadi (student)  
**Request Body:**
```json
{
  "token": "firebase_push_token_long_string",
  "platform": "android",
  "deviceName": "Samsung Galaxy S21",
  "appId": "com.intellect.student"
}
```

**Maydonlar:**
- `token` (string, majburiyi) — FCM/APNs token
- `platform` (string, ixtiyoriyi) — "android", "ios", "web" (default: "android")
- `deviceName` (string, ixtiyoriyi) — qurilma nomi
- `appId` (string, ixtiyoriyi) — ilovaning paket ID'si

**Javob (Response) — 200 OK:**
```json
{
  "ok": true
}
```

---

### 12. Push qurilma tokenini o'chirish (Logout)

**Endpoint:** `DELETE /api/student/notifications/register`  
**Auth:** Talab qilinadi (student)  
**Query parametrlari:**
- `token` (string, majburiyi) — o'chirilacak FCM token

**Javob (Response) — 200 OK:**
```json
{
  "ok": true
}
```

---

## Baholar va Jurnal

### 13. O'quvchi baholarini o'qish

**Endpoint:** `GET /api/student/grades`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "studentId": "student_uuid",
  "className": "7-A",
  "subjects": [
    {
      "subjectId": "subj_uuid",
      "subjectName": "Matematika",
      "grades": [5, 4, 5, 5, 4],
      "average": 4.6,
      "homeworkDone": 8,
      "homeworkMissed": 1,
      "absenceCount": 0,
      "lateCount": 1
    },
    {
      "subjectId": "eng_uuid",
      "subjectName": "Ingliz tili",
      "grades": [4, 4, 5],
      "average": 4.3,
      "homeworkDone": 5,
      "homeworkMissed": 0,
      "absenceCount": 2,
      "lateCount": 0
    }
  ],
  "overallAverage": 4.45
}
```

---

### 14. O'quvchi reytingi (guruh + markaz)

**Endpoint:** `GET /api/student/rating`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "meStudentId": "student_uuid",
  "classRows": [
    {
      "rank": 1,
      "studentId": "s1_uuid",
      "fullName": "Ali Karim",
      "className": "7-A",
      "average": 4.8,
      "attendance": "95%",
      "ball": 156
    },
    {
      "rank": 2,
      "studentId": "s2_uuid",
      "fullName": "Fatima Aziz",
      "className": "7-A",
      "average": 4.6,
      "attendance": "92%",
      "ball": 145
    }
  ],
  "schoolRows": [
    {
      "rank": 1,
      "studentId": "top1_uuid",
      "fullName": "Zainab Shodi",
      "className": "9-A",
      "average": 4.9,
      "attendance": "98%",
      "ball": 198
    }
  ],
  "meSchoolRank": 7,
  "totalStudents": 156
}
```

**Izoh:** 
- `classRows` — o'z guruhi barcha o'quvchilari (to'liq)
- `schoolRows` — markaz TOP-15 (o'rtacha baho bo'yicha kamayish)
- Reyting **YIG'ILGAN BALL** bo'yicha hisoblanadi (o'rtacha baho emas; teng bo'lsa o'rtacha baho hal qiladi)

---

### 15. O'quvchi davomati

**Endpoint:** `GET /api/student/attendance`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `quarter` (integer, ixtiyoriyi) — chorak raqami (default: joriy chorak)
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "summary": {
    "presentCount": 85,
    "absentCount": 3,
    "lateCount": 2,
    "notArrivedCount": 0,
    "totalLessons": 90
  },
  "absenceRecords": [
    {
      "date": "2024-07-10",
      "period": 3,
      "quarter": 1,
      "subjectId": "math_uuid",
      "subjectName": "Matematika",
      "reasonId": "reason_uuid",
      "reasonName": "Kasal",
      "isLate": false,
      "isSick": true
    },
    {
      "date": "2024-07-09",
      "period": 1,
      "quarter": 1,
      "subjectId": "eng_uuid",
      "subjectName": "Ingliz tili",
      "reasonId": "late_id",
      "reasonName": "Kech qoldi",
      "isLate": true,
      "isSick": false
    }
  ]
}
```

---

## Bosh Sahifa (Dashboard)

### 16. Bosh sahifaning yagona so'rovi (Dashboard)

**Endpoint:** `GET /api/student/dashboard`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "profile": {
    "id": "student_uuid",
    "fullName": "Ali Karim",
    "className": "7-A",
    "birthDate": "2010-05-15",
    "gender": "erkak",
    "parentFullName": "Karim Alievich",
    "parentPhone": "+998-90-123-45-67",
    "enrollmentDate": "2020-09-01",
    "photoUrl": "/uploads/photo.jpg",
    "parentPhotoUrl": "/uploads/parent.jpg"
  },
  "meta": { ... },
  "todayLessons": [
    {
      "id": 0,
      "period": 1,
      "startTime": null,
      "endTime": null,
      "subjectId": "math_uuid",
      "subjectName": "Matematika",
      "teacherId": "teacher_uuid",
      "teacherName": "Nurbek Obidovich"
    },
    {
      "id": 0,
      "period": 2,
      "startTime": null,
      "endTime": null,
      "subjectId": "eng_uuid",
      "subjectName": "Ingliz tili",
      "teacherId": "eng_teacher_uuid",
      "teacherName": "Natalya Ivanovna"
    }
  ],
  "todayGrades": [
    {
      "date": "2024-07-11",
      "period": 1,
      "subjectId": "math_uuid",
      "subjectName": "Matematika",
      "topic": "Kvadrat tenglamalar",
      "homework": "1-10 masalalar",
      "conducted": true,
      "grade": 5,
      "reasonId": null,
      "reasonName": null,
      "isLate": false
    }
  ],
  "pendingAssignments": 2,
  "balance": -5000.00,
  "monthlyFee": 50000.00
}
```

**Izoh:** Ikki rekord tizim ichida o'qish uchun bir so'rov — Flutter/Kotlin dashboard'i uchun eng optimal.

---

## Foydalanuvchi Sozlamalari

### 17. Foydalanuvchi sozlamalarini o'qish

**Endpoint:** `GET /api/student/settings`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "language": "uz",
  "theme": "system",
  "notificationsEnabled": true
}
```

**Maydonlar:**
- `language` (string) — "uz", "ru", "en"
- `theme` (string) — "system", "light", "dark"
- `notificationsEnabled` (boolean) — push bildirishnomalar yoqilganmi

---

### 18. Sozlamalarni saqlash

**Endpoint:** `PUT /api/student/settings`  
**Auth:** Talab qilinadi (student)  
**Request Body:**
```json
{
  "language": "uz",
  "theme": "dark",
  "notificationsEnabled": true
}
```

**Javob (Response) — 200 OK:**
```json
{
  "language": "uz",
  "theme": "dark",
  "notificationsEnabled": true
}
```

---

### 19. Parol o'zgartirish

**Endpoint:** `PUT /api/student/password`  
**Auth:** Talab qilinadi (student, parent)  
**Request Body:**
```json
{
  "currentPassword": "eski_parol123",
  "newPassword": "yangi_parol123456"
}
```

**Maydonlar:**
- `currentPassword` (string, majburiyi) — joriy parol (tasdiqlanishi shart)
- `newPassword` (string, majburiyi) — yangi parol (kamida 8 belgisi)

**Javob (Response) — 200 OK:**
```json
{
  "message": "Parol almashtirildi"
}
```

**Xatolar:**
- **400 Bad Request:** `"Joriy parol noto'g'ri"` | `"Yangi parol kamida 8 belgidan iborat bo'lsin"`

**Izoh:** Token amal qila beradi (qayta kirish shart emas).

---

## Joylashuv (GPS)

### 20. O'quvchi joylashuvini yangilash

**Endpoint:** `PUT /api/student/location`  
**Auth:** Talab qilinadi (student, parent)  
**Request Body:**
```json
{
  "latitude": 40.5286,
  "longitude": 70.7754,
  "address": "Qo'qon, Shahriston ko'chasi 15"
}
```

**Maydonlar:**
- `latitude` (number, majburiyi) — -90 dan 90 oralig'ida
- `longitude` (number, majburiyi) — -180 dan 180 oralig'ida
- `address` (string, ixtiyoriyi) — manzil matni

**Javob (Response) — 200 OK:**
```json
{
  "ok": true
}
```

**Xatolar:**
- **400 Bad Request:** `"Koordinatalar noto'g'ri"`

---

### 21. O'quvchi joylashuvini o'qish

**Endpoint:** `GET /api/student/location`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "latitude": 40.5286,
  "longitude": 70.7754,
  "address": "Qo'qon, Shahriston ko'chasi 15",
  "updatedAt": "2024-07-11T14:30:00"
}
```

**Izoh:** Joylashuv hali kiritilmagan bo'lsa maydonlar null bo'ladi.

---

## Intizomiy Ball

### 22. O'quvchining intizomiy balli

**Endpoint:** `GET /api/student/discipline`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "remaining": 95,
  "plusPoints": 5,
  "minusPoints": 10,
  "items": [
    {
      "id": "dp_uuid",
      "studentId": "student_uuid",
      "reasonName": "Dars vaqtida telefondan foydalanish",
      "points": -5,
      "note": "Jurnalda qayd qilindi",
      "createdAt": "2024-07-10T09:00:00",
      "createdBy": "admin_id",
      "type": "manual"
    },
    {
      "id": "je_uuid",
      "studentId": "student_uuid",
      "reasonName": "Kasal",
      "points": 0,
      "note": "Jurnal davomati",
      "createdAt": "2024-07-09T08:30:00",
      "createdBy": "",
      "type": "attendance"
    }
  ]
}
```

**Izoh:** 
- Intizomiy ball `100` dan boshlanadi
- `plusPoints` — rag'batlar (musbat)
- `minusPoints` — jazo (manfi)
- Tarix qo'lda kiritilgan ballar + jurnal davomati sabalari yozuvlaridan iborat

---

## Topshiriqlar va Testlar

### 23. O'quvchiga berilgan topshiriqlar

**Endpoint:** `GET /api/student/assignments`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
[
  {
    "id": "assignment_uuid",
    "title": "Ingliz tili: Speaking",
    "description": "Mavzu: My Family — nutqni yozing",
    "format": "speaking",
    "maxScore": 100,
    "dueDate": "2024-07-15",
    "groupId": "group_uuid",
    "groupName": "Ingliz tili 7-A",
    "completed": false,
    "score": null,
    "submittedAt": null,
    "feedback": null,
    "referenceText": "Hello, my name is Ali. I have a family."
  },
  {
    "id": "test_uuid",
    "title": "Matematika: Test 1",
    "description": "Birinchi chorak testlashtiruvi",
    "format": "test",
    "maxScore": 50,
    "dueDate": "2024-07-14",
    "groupId": "math_group",
    "groupName": "Matematika 7-A",
    "completed": true,
    "score": 45,
    "submittedAt": "2024-07-11T11:30:00",
    "feedback": "Yaxshi natija!",
    "referenceText": null
  }
]
```

---

### 24. Topshiriq ballari (umumiy)

**Endpoint:** `GET /api/student/assignment-scores`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "totalAssignments": 15,
  "completedAssignments": 12,
  "totalScore": 540,
  "maxScore": 600,
  "percentageScore": 90.0,
  "byFormat": [
    {
      "format": "speaking",
      "completed": 3,
      "total": 4,
      "score": 280,
      "maxScore": 300
    },
    {
      "format": "test",
      "completed": 5,
      "total": 5,
      "score": 180,
      "maxScore": 200
    },
    {
      "format": "writing",
      "completed": 4,
      "total": 6,
      "score": 80,
      "maxScore": 100
    }
  ]
}
```

---

### 25. Topshiriq tafsiloti

**Endpoint:** `GET /api/student/assignments/{id}`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Path parametrlari:**
- `id` (string, majburiyi) — topshiriq ID

**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "id": "assignment_uuid",
  "title": "Ingliz tili: Speaking",
  "description": "Mavzu: My Daily Routine — 30-60 soniyali nutqni yozing",
  "format": "speaking",
  "maxScore": 100,
  "dueDate": "2024-07-15",
  "groupId": "group_uuid",
  "groupName": "Ingliz tili 7-A",
  "referenceText": "I wake up at 7 AM. I brush my teeth...",
  "completed": false,
  "score": null,
  "submittedAt": null,
  "feedback": null,
  "questions": [
    {
      "id": "q1_uuid",
      "text": "Siz qaysi vaqtda uyg'onasiz?",
      "options": ["6 da", "7 da", "8 da"],
      "correctIndex": 1
    }
  ]
}
```

**Izoh:** Test bo'lsa — to'g'ri javobsiz savollar ko'rsatiladi (o'quvchi yuborah topshirqning javobini bilmasin).

---

### 26. Topshiriqni topshirish (Submit)

**Endpoint:** `POST /api/student/assignments/{id}/submit`  
**Auth:** Talab qilinadi (student)  
**Path parametrlari:**
- `id` (string, majburiyi) — topshiriq ID

**Request Body (test uchun):**
```json
{
  "answers": [0, 1, 2, 1]
}
```

**Request Body (writing uchun):**
```json
{
  "text": "I wake up at 7 AM every morning..."
}
```

**Javob (Response) — 200 OK:**
```json
{
  "id": "assignment_uuid",
  "completed": true,
  "score": 85,
  "feedback": "Yaxshi javoblar!",
  "submittedAt": "2024-07-11T12:30:00"
}
```

**Xatolar:**
- **404 Not Found:** Topshiriq topilmadi
- **400 Bad Request:** Noto'g'ri format yoki ma'lumot

---

### 27. Speaking topshiriq yuborish (WAV audio)

**Endpoint:** `POST /api/student/assignments/{id}/speaking`  
**Auth:** Talab qilinadi (student, parent)  
**Path parametrlari:**
- `id` (string, majburiyi) — speaking topshiriq ID

**Request:** multipart/form-data
- `audio` (file, majburiyi) — WAV audio fayl (max 8 MB)

**Javob (Response) — 200 OK:**
```json
{
  "recognizedText": "Hello my name is Ali",
  "pronScore": 85.5,
  "accuracy": 92.0,
  "fluency": 88.0,
  "completeness": 95.0,
  "prosody": 80.0,
  "words": [
    {
      "word": "hello",
      "accuracy": 100.0
    },
    {
      "word": "my",
      "accuracy": 95.0
    }
  ],
  "error": null
}
```

**Xatolar:**
- **400 Bad Request:** `"Audio bo'sh"` | `"Audio juda katta (8 MB dan oshmasin)"` | `"Audio formati noto'g'ri (WAV kutilgan)"`
- **429 Too Many Requests:** `"Biroz kuting — qayta urinishdan oldin bir necha soniya o'ting"`

**Izoh:** Azure Speech Service talaffuzni baholaydi; natija avtomatik saqlanadi.

---

### 28. Speaking topshiriq natijasini o'qish

**Endpoint:** `GET /api/student/assignments/{id}/speaking`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Path parametrlari:**
- `id` (string, majburiyi) — speaking topshiriq ID

**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:** Yuqoridagi speaking result

**Javob (Response) — 204 No Content:** Natija topilmadi

---

### 29. Faylni yuklash (topshiriq javobi uchun)

**Endpoint:** `POST /api/student/uploads`  
**Auth:** Talab qilinadi (student)  
**Request:** multipart/form-data
- `file` (file, majburiyi) — rasm/PDF/video (max 20 MB)

**Javob (Response) — 200 OK:**
```json
{
  "originalName": "answer.pdf",
  "fileUrl": "/uploads/answer-uuid.pdf",
  "fileSize": 1024000,
  "contentType": "application/pdf"
}
```

**Xatolar:**
- **400 Bad Request:** Fayl formati qo'llanmaydi yoki o'z katta

---

## AI Tekshiruv

### 30. AI tekshiruv holati (Gemini + Azure)

**Endpoint:** `GET /api/student/ai-check/status`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "geminiReady": true,
  "azureReady": true,
  "isPremium": false,
  "isBlocked": false,
  "dailyLimit": 3,
  "usedToday": 1,
  "remaining": 2
}
```

**Izoh:** 
- `geminiReady`/`azureReady` — admin kalitlarini kiritsami (yoki yo'q)
- `isPremium` — o'quvchi cheksiz foydalana oladimi
- `isBlocked` — admin tekshiruvni cheklagan bo'lsa true
- `remaining` — bugun qolgan urinishlar soni

---

### 31. AI tekshiruv tarixi

**Endpoint:** `GET /api/student/ai-check/history`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
[
  {
    "id": "check_uuid",
    "type": "writing",
    "prompt": "Yozma: O'qish foydasi haqida",
    "score": 78.5,
    "date": "2024-07-11",
    "createdAt": "2024-07-11T14:30:00",
    "hasAudio": false
  },
  {
    "id": "speaking_uuid",
    "type": "speaking",
    "prompt": "Nutq: Mening turmushim",
    "score": 85.0,
    "date": "2024-07-10",
    "createdAt": "2024-07-10T10:15:00",
    "hasAudio": true
  }
]
```

**Izoh:** Eng yangi birinchi.

---

### 32. Bitta AI tekshiruv yozuvi (to'liq)

**Endpoint:** `GET /api/student/ai-check/history/{id}`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Path parametrlari:**
- `id` (string, majburiyi) — AI check ID

**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "id": "check_uuid",
  "type": "writing",
  "prompt": "Yozma: O'qish foydasi haqida",
  "inputText": "O'qish juda foydali. U bizning ongimizni kengaytiradi...",
  "recognizedText": null,
  "audioUrl": null,
  "score": 78.5,
  "date": "2024-07-11",
  "createdAt": "2024-07-11T14:30:00",
  "analysis": {
    "overall": 78,
    "grammar": 75,
    "vocabulary": 82,
    "coherence": 80,
    "task": 76,
    "mechanics": 72,
    "pronunciation": 0,
    "fluency": 0,
    "corrections": [
      {
        "original": "O'qish juda foydali",
        "suggestion": "O'qish juda foydalidir",
        "explanation": "To'g'ri grammatika"
      }
    ],
    "vocab": [
      {
        "word": "foydali",
        "suggestion": "beh-tar",
        "note": "Sinonimlar"
      }
    ],
    "ielts": null
  },
  "speech": null,
  "taskType": ""
}
```

---

### 33. Yozma tekshiruvi (Writing)

**Endpoint:** `POST /api/student/ai-check/writing`  
**Auth:** Talab qilinadi (student)  
**Request Body:**
```json
{
  "prompt": "Yozma: O'qish foydasi haqida 250 so'zli esse",
  "text": "O'qish juda foydali. U bizning ongimizni kengaytiradi...",
  "taskType": "ielts_task2"
}
```

**Maydonlar:**
- `prompt` (string, majburiyi) — vazifa izohи
- `text` (string, majburiyi) — yoziladigan matn (10-8000 belgi)
- `taskType` (string, ixtiyoriyi) — "ielts_task1", "ielts_task2", yoki bo'sh (oddiy tekshiruv)

**Javob (Response) — 200 OK:** Yuqoridagi AI check DTO

**Xatolar:**
- **400 Bad Request:** `"Matn juda qisqa (kamia 10 belgi)"` | `"AI tekshiruv hali sozlanmagan"`
- **429 Too Many Requests:** `"Kunlik limit tugadi (1/3)"`

---

### 34. Nutq tekshiruvi (Speaking)

**Endpoint:** `POST /api/student/ai-check/speaking`  
**Auth:** Talab qilinadi (student)  
**Request:** multipart/form-data
- `audio` (file, majburiyi) — WAV audio
- `prompt` (string, ixtiyoriyi) — topshiriq matni
- `referenceText` (string, ixtiyoriyi) — talab qilingan matn (talaffuzni aniq baholash uchun)

**Javob (Response) — 200 OK:**
```json
{
  "id": "check_uuid",
  "type": "speaking",
  "prompt": "Mavzu: Mening kunlik rejasim",
  "inputText": "I wake up at 7 AM",
  "recognizedText": "I wake up at seven in the morning",
  "audioUrl": "/uploads/aicheck-uuid.wav",
  "score": 87.0,
  "date": "2024-07-11",
  "createdAt": "2024-07-11T12:30:00",
  "analysis": {
    "overall": 87,
    "words": [
      {
        "word": "wake",
        "accuracy": 100.0
      },
      {
        "word": "up",
        "accuracy": 95.0
      }
    ]
  },
  "speech": {
    "recognizedText": "I wake up at seven",
    "pronScore": 87.0,
    "accuracy": 92.0,
    "fluency": 88.0,
    "completeness": 90.0,
    "prosody": 85.0,
    "words": [
      { "word": "wake", "accuracy": 100.0 },
      { "word": "up", "accuracy": 95.0 }
    ]
  },
  "taskType": ""
}
```

**Oqim:**
1. Azure Speech Service talaffuzni baholaydi (har so'z aniqligi)
2. Gemini Azure natijasini tahlil qiladi va maslahat beradi

**Xatolar:**
- **400 Bad Request:** `"Audio formati noto'g'ri"` | `"Speaking baholash hali sozlanmagan"`

---

## To'lovlar va Moliya

### 35. O'quvchi to'lov tarixи (Ledger)

**Endpoint:** `GET /api/student/finance`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "studentId": "student_uuid",
  "fullName": "Ali Karim",
  "balance": -50000.00,
  "transactions": [
    {
      "id": "trans_uuid",
      "date": "2024-07-01",
      "type": "charge",
      "month": "2024-07",
      "amount": 50000.00,
      "description": "O'quv to'lovi (Iyul oyi)",
      "note": ""
    },
    {
      "id": "pay_uuid",
      "date": "2024-07-05",
      "type": "payment",
      "amount": 20000.00,
      "description": "Payme orqali to'lov",
      "note": "Transaction ID: 123456"
    }
  ],
  "summary": {
    "totalCharged": 100000.00,
    "totalPaid": 50000.00,
    "balance": -50000.00
  }
}
```

**Izoh:**
- Manfiy balans = qarzdorlik
- Musbat balans = qoldiq (o'quvchi to'lab berilgan)
- Oylik hisob har oy avval zarar hisoblanadi (MonthlyCharge)

---

## Guruh Chati

### 36. Guruh chati (xabarlar)

**Endpoint:** `GET /api/student/chat`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `since` (string, ixtiyoriyi) — ISO 8601 sana (shudan keyin xabarlarni olish)
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
[
  {
    "id": "msg_uuid",
    "senderName": "Nurbek O. (o'qituvchi)",
    "senderRole": "teacher",
    "text": "Keyingi dars 15-qatorni o'rganing",
    "createdAt": "2024-07-11T14:30:00"
  },
  {
    "id": "msg2_uuid",
    "senderName": "Fatima A.",
    "senderRole": "student",
    "text": "Xo'p, albatta",
    "createdAt": "2024-07-11T15:00:00"
  }
]
```

---

### 37. Guruh chati — xabar yuborish

**Endpoint:** `POST /api/student/chat`  
**Auth:** Talab qilinadi (student)  
**Request Body:**
```json
{
  "text": "O'qituvchi xodim, qanday qilayapti?"
}
```

**Javob (Response) — 200 OK:**
```json
{
  "id": "new_msg_uuid",
  "senderName": "Ali Karim",
  "senderRole": "student",
  "text": "O'qituvchi xodim, qanday qilayapti?",
  "createdAt": "2024-07-11T15:30:00"
}
```

**Xatolar:**
- **400 Bad Request:** `"Xabar bo'sh"` | `"Guruh biriktirilmagan"`

---

## Telegram Bot

### 38. Telegram bot holati

**Endpoint:** `GET /api/student/telegram`  
**Auth:** Talab qilinadi (student, parent)

**Javob (Response) — 200 OK:**
```json
{
  "configured": true,
  "botUsername": "intellect_kokand_bot",
  "botName": "Intellect Kokand Bot",
  "deepLink": "https://t.me/intellect_kokand_bot",
  "registered": false
}
```

**Izoh:**
- `configured` — bot admin'dan sozlanganmi
- `registered` — o'quvchi botga ro'yxatdan o'tganmi
- Hali yo'q bo'lsa — deepLink orqali botga yo'naltirish

---

## O'quv Dasturi (Curriculum)

### 39. O'quvchining darslar progresi

**Endpoint:** `GET /api/student/curriculum`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
[
  {
    "courseId": "course_uuid",
    "courseName": "Ingliz tili (Elementary)",
    "groupId": "group_uuid",
    "groupName": "Ingliz tili 7-A",
    "topics": [
      {
        "topicId": "topic1_uuid",
        "topicName": "Greeting",
        "completedItems": 5,
        "totalItems": 8,
        "percentComplete": 62.5
      },
      {
        "topicId": "topic2_uuid",
        "topicName": "Family",
        "completedItems": 3,
        "totalItems": 6,
        "percentComplete": 50.0
      }
    ],
    "totalItems": 50,
    "completedItems": 20,
    "percentComplete": 40.0,
    "estimatedCompletion": "2024-10-15"
  }
]
```

---

### 40. Bitta dars kontenti (o'qish)

**Endpoint:** `GET /api/student/curriculum/item/{id}`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Path parametrlari:**
- `id` (string, majburiyi) — dars ID

**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "id": "item_uuid",
  "topicId": "topic_uuid",
  "text": "Hello and Goodbye",
  "note": "Greeting and farewell expressions",
  "order": 1,
  "type": "video",
  "videoUrl": "/media/lessons/video1.mp4",
  "audioUrl": null,
  "textContent": "When we meet someone, we say...",
  "pdfUrl": "/media/lessons/vocabulary.pdf",
  "pdfName": "Vocabulary List",
  "meta": "Part 1 of Greeting module",
  "vocab": [
    {
      "word": "hello",
      "translation": "Assalomu alaikum",
      "example": "Hello, how are you?",
      "transcription": "həˈloʊ"
    },
    {
      "word": "goodbye",
      "translation": "Xayr",
      "example": "Goodbye, see you later!",
      "transcription": "ɡʊdˈbaɪ"
    }
  ],
  "questions": [
    {
      "id": "q1_uuid",
      "text": "What do we say when meeting?",
      "options": ["Hello", "Goodbye", "Thank you"],
      "correctIndex": 0
    }
  ]
}
```

**Xatolar:**
- **403 Forbidden:** `"Bu dars hali ochilmagan — o'qituvchi o'tgach ochiladi"` (o'qituvchi jurnalda "o'tildi" belgilagucha)

**Izoh:** O'qituvchi darsni o'tgach (LessonNote.Conducted = true) o'quvchi ko'ra oladi.

---

### 41. Dars progresini yangilash (o'tildi/o'tilmadi)

**Endpoint:** `POST /api/student/curriculum/progress`  
**Auth:** Talab qilinadi (student)  
**Request Body:**
```json
{
  "itemId": "item_uuid",
  "done": true
}
```

**Javob (Response) — 200 OK:**
```json
{
  "ok": true
}
```

---

### 42. Kursning o'tilgan bandlari (Progress)

**Endpoint:** `GET /api/student/curriculum/{courseId}/progress`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Path parametrlari:**
- `courseId` (string, majburiyi) — kurs ID

**Javob (Response) — 200 OK:**
```json
[
  "item1_uuid",
  "item2_uuid",
  "item5_uuid"
]
```

---

## Fanlara bo'yicha Dastur Progresi

### 43. Barcha fanlar progresi

**Endpoint:** `GET /api/student/subjects-progress`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `quarter` (integer, ixtiyoriyi) — chorak (default: joriy)
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "quarter": 1,
  "totalLessons": 90,
  "conductedLessons": 72,
  "percentComplete": 80.0,
  "subjects": [
    {
      "subjectId": "math_uuid",
      "subjectName": "Matematika",
      "totalLessons": 30,
      "conductedLessons": 25,
      "percentComplete": 83.3
    },
    {
      "subjectId": "eng_uuid",
      "subjectName": "Ingliz tili",
      "totalLessons": 25,
      "conductedLessons": 18,
      "percentComplete": 72.0
    }
  ]
}
```

---

### 44. Bitta fan progresi (darslar ro'yxati)

**Endpoint:** `GET /api/student/subjects-progress/{subjectId}`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Path parametrlari:**
- `subjectId` (string, majburiyi) — fan ID

**Query parametrlari:**
- `quarter` (integer, ixtiyoriyi) — chorak
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "subjectId": "math_uuid",
  "subjectName": "Matematika",
  "quarter": 1,
  "totalLessons": 30,
  "conductedLessons": 25,
  "percentComplete": 83.3,
  "lessons": [
    {
      "date": "2024-07-01",
      "period": 1,
      "topic": "Kvadrat tenglamalar",
      "conducted": true,
      "homework": "1-10 masalalar"
    },
    {
      "date": "2024-07-02",
      "period": 2,
      "topic": "Faktor olish",
      "conducted": false,
      "homework": null
    }
  ]
}
```

---

## Baholash Mezonlari (Grading Criteria)

### 45. O'quvchining baholash statistikasi

**Endpoint:** `GET /api/student/grading`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID
- `month` (string, ixtiyoriyi) — oy (YYYY-MM format, default: joriy)

**Javob (Response) — 200 OK:**
```json
[
  {
    "groupId": "group_uuid",
    "groupName": "Ingliz tili 7-A",
    "months": ["2024-06", "2024-07"],
    "selectedMonth": "2024-07",
    "dates": ["2024-07-01", "2024-07-02", "2024-07-03"],
    "criteria": [
      {
        "criterionId": "c1_uuid",
        "name": "Participation",
        "done": 2,
        "total": 3
      },
      {
        "criterionId": "c2_uuid",
        "name": "Homework",
        "done": 3,
        "total": 3
      }
    ],
    "lessons": [
      {
        "date": "2024-07-01",
        "criterionIds": ["c1_uuid"]
      },
      {
        "date": "2024-07-02",
        "criterionIds": ["c1_uuid", "c2_uuid"]
      },
      {
        "date": "2024-07-03",
        "criterionIds": ["c2_uuid"]
      }
    ],
    "monthBall": 5,
    "totalBall": 18
  }
]
```

---

## Support/Qo'shni Darslar

### 46. Support o'qituvchilar va bo'sh slotlar

**Endpoint:** `GET /api/student/support`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 200 OK:**
```json
{
  "availableTeachers": [
    {
      "teacherId": "teacher_uuid",
      "fullName": "Natalya Ivanovna",
      "photoUrl": "/uploads/teacher.jpg",
      "subjects": "Ingliz tili, Rus tili",
      "openSlots": [
        {
          "id": "slot_uuid",
          "date": "2024-07-12",
          "startTime": "17:00",
          "endTime": "17:45"
        },
        {
          "id": "slot2_uuid",
          "date": "2024-07-13",
          "startTime": "15:30",
          "endTime": "16:15"
        }
      ]
    }
  ],
  "myBookings": [
    {
      "id": "booking_uuid",
      "teacherId": "teacher_uuid",
      "teacherName": "Natalya Ivanovna",
      "date": "2024-07-12",
      "startTime": "17:00",
      "endTime": "17:45",
      "status": "booked",
      "topic": "Grammar practice",
      "notes": null
    }
  ]
}
```

---

### 47. Bo'sh slotni bron qilish

**Endpoint:** `POST /api/student/support/slots/{id}/book`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Path parametrlari:**
- `id` (string, majburiyi) — slot ID

**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 204 No Content**

**Xatolar:**
- **400 Bad Request:** `"Bu vaqt allaqachon band qilingan"`
- **404 Not Found:** Slot topilmadi

**Izoh:** Atomik operatsiya — race condition'da faqat bitta o'quvchi bron qilib oladi.

---

### 48. Bronni bekor qilish

**Endpoint:** `POST /api/student/support/slots/{id}/cancel`  
**Auth:** Talab qilinadi (student, parent, admin)  
**Path parametrlari:**
- `id` (string, majburiyi) — slot ID

**Query parametrlari:**
- `studentId` (string, ixtiyoriyi) — admin uchun o'quvchi ID

**Javob (Response) — 204 No Content**

**Xatolar:**
- **400 Bad Request:** `"O'tilgan darsni bekor qilib bo'lmaydi"`
- **404 Not Found:** Slot topilmadi yoki student'ning emas

---

## Taklif va Shikoyat

### 49. Taklif/Shikoyat yuborish

**Endpoint:** `POST /api/student/feedback`  
**Auth:** Talab qilinadi (student, parent)  
**Request:** multipart/form-data
- `type` (string, majburiyi) — "suggestion" yoki "complaint"
- `text` (string, majburiyi) — matn (bo'sh bo'lmaydi)
- `image` (file, ixtiyoriyi) — rasm (max 20 MB)

**Javob (Response) — 204 No Content**

**Xatolar:**
- **400 Bad Request:** `"Matn bo'sh"` | Fayl formati qo'llanmaydi

**Izoh:** Admin "Taklif va shikoyatlar" bo'limida ko'radi.

---

## Xatolar va Holati Kodlari

### Umumiy HTTP Javob Kodlari

| Kod | Ma'nosi | Misol |
|-----|---------|-------|
| **200 OK** | Muvaffaqiyatli | GET, PUT bilan data qaytdi |
| **204 No Content** | Muvaffaqiyatli, lekin matn yo'q | POST create, DELETE |
| **400 Bad Request** | Noto'g'ri so'rov | Majburiy maydon yo'q, format noto'g'ri |
| **401 Unauthorized** | Token yo'q yoki noto'g'ri | Login noto'g'ri, token validsiz |
| **403 Forbidden** | Ruxsat yo'q | Admin'siz access, dars hali ochilmagan |
| **404 Not Found** | Resurs topilmadi | O'quvchi/topshiriq ID yo'q |
| **429 Too Many Requests** | Limit oshdi | Kunlik limit, rate-limit |
| **500 Internal Server Error** | Server xatosi | Istalmagan xato (log ko'ring) |

### Error Response Formatı

```json
{
  "message": "Qisqa xato izohи",
  "locked": true
}
```

---

## Autentifikatsiya Detallar

### JWT Token Ishlatiش

Har keyin API so'roviga header'da:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Token 24 soat amal qiladi (standart). Token yaroqsiz bo'lsa — qayta login qiling.

### Rollarga Asoslangan Kirish (RBAC)

| Endpoint | student | parent | admin | superadmin | Izoh |
|----------|---------|--------|-------|-----------|------|
| `GET /api/student/me` | ✓ | ✓ | ✓ | — | O'z profilini ko'rish |
| `PUT /api/student/password` | ✓ | ✓ | — | — | Faqat o'ziniki |
| `POST /api/student/chat` | ✓ | — | — | — | Faqat student guruhga yoza oladi |
| `POST /api/student/assignments/{id}/submit` | ✓ | — | — | — | Faqat student topshira oladi |
| `PUT /api/student/settings` | ✓ | — | — | — | Shaxsiy sozlamalar |
| `GET /api/student/...?studentId=X` | — | ✓ | ✓ | — | Admin va parent `studentId` bilan farzandig'iga kiradi |

---

## Muhim Izohlar

### O'quvchi, Parent va Admin Farqi

- **student** — o'z hisobiga kiradi, `userId` orqali o'z ma'lumotini ko'radi
- **parent** — o'z hisobiga kiradi, login = telefon raqami, farzandiniki ko'radi (ot/ona/asosiy telefon)
- **admin** — istalgan o'quvchining ma'lumotini `?studentId=...` orqali ko'radi (lekin mutatsiyalar uchun `studentId` talab qilinadi)

### Sana Formati

- ISO 8601 — `"2024-07-11T14:30:00"` (UTC)
- Kun — `"2024-07-11"` (YYYY-MM-DD)
- Oy — `"2024-07"` (YYYY-MM)

### Balans va To'lovlar

- Manfiy = qarzdorlik
- Musbat = qoldiq
- Oylik hisob (MonthlyCharge) har oy avval tushadi
- To'lov qaytarish (refund) admin orqali bo'ladi

### Reyting Hisob-Kitobи

**Yig'ilgan Ball (Ball)** = jurnal baholari yig'indisi + bahalanish mezonlariga berilgan ballari yig'indisi

- Formul: `Σ(jurnal yozuvlarida grade) + Σ(CriterionGrade.Done)`
- O'rtacha Baho = yig'ilgan ball / jami darslar (o'rtacha baho emas)
- Saralash: Ball (kamayish) → Teng bo'lsa o'rtacha baho

### Dars Progresи

- O'qituvchi jurnalda `LessonNote.Conducted = true` belgilasa dars o'til hisoblanadi
- O'quvchi dars kontentini (curriculum item) faqat o'tilgach ko'ra oladi
- Progress: (o'tilgan darslar / rejadagi darslar) × 100%

---

## Misol: Complete Auth Flow

```bash
# 1. Login
POST /api/auth/login
Body: { "email": "student@example.com", "password": "parol123456" }
Response: { "token": "jwt_token", "user": {...} }

# 2. Push tokeni ro'yxatdan o'tkazish (Android ilova startup)
POST /api/student/notifications/register
Header: Authorization: Bearer jwt_token
Body: { "token": "fcm_token_123", "platform": "android", "deviceName": "Samsung" }
Response: { "ok": true }

# 3. Dashboard ma'lumotlarini olish
GET /api/student/dashboard
Header: Authorization: Bearer jwt_token
Response: { "profile": {...}, "todayLessons": [...], "balance": -50000 }

# 4. Jurnal ko'rish
GET /api/student/grades
Header: Authorization: Bearer jwt_token
Response: { "subjects": [...], "overallAverage": 4.45 }

# 5. Topshiriqni topshirish
POST /api/student/assignments/{id}/submit
Header: Authorization: Bearer jwt_token
Body: { "answers": [0, 1, 2] }
Response: { "completed": true, "score": 85 }

# 6. Token yaroqsiz bo'lsa
GET /api/student/me
Header: Authorization: Bearer expired_token
Response: 401 Unauthorized { "message": "Unauthorized" }

# 7. Qayta login
POST /api/auth/login
Body: { "email": "student@example.com", "password": "parol123456" }
Response: { "token": "new_jwt_token", "user": {...} }
```

---

**API dokumenti yakunlandi.**  
**Versiya:** 1.0  
**Oxirgi yangilanish:** 2026-07-11
