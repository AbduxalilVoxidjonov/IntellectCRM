# O'qituvchi (Teacher) ilovasi — API

O'qituvchi ilovasi server bilan `TeacherPortalController` (`/api/teacher/*`) orqali ishlaydi.
Barcha endpointlar **`teacher`** rolini talab qiladi. Javoblar **JSON**.

**Base URL:** `https://crm.intellectschool.uz`
Har bir so'rovda: `Authorization: Bearer <token>` sarlavhasi.

> **DIQQAT — model yangilandi.** IntellectCRM bitta o'quv markazi uchun (multi-tenant/maktab kodi YO'Q).
> Jurnal endi **oylik** (chorak emas) va **guruh** asosida: o'qituvchi GURUHga kiradi → o'sha guruh
> o'quvchilariga oylik baho/davomat qo'yadi + **o'quv dasturi (sillabus)** o'tilishini belgilaydi.
> Eski chorak (`quarter`) endpointlari "Legacy" sifatida saqlangan, lekin ilova ulardan FOYDALANMAYDI.

---

## 1. Ulanish (auth)

Login **faqat login + parol** bilan (markaz bitta — kod/tenant shart emas).

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "<login>", "password": "<parol>" }
```
**Javob:** `{ "token": "eyJ...", "user": { id, fullName, role:"teacher", email, avatarUrl, permissions, modules } }`
- `email` — bu **login** (username, masalan `karimovadilnoza`), pochta emas. Login/parolni admin beradi
  (o'qituvchi qo'shilganda avtomatik). Keyingi so'rovlar: `Authorization: Bearer <token>`.
- `permissions` — o'qituvchiga ochilgan bo'limlar (pastga qarang).
- `401` — login/parol xato yoki akkaunt **arxivlangan**.

### Joriy foydalanuvchi / akkaunt
```http
GET /api/auth/me                 →  { id, fullName, role, email, avatarUrl, permissions, modules }
PUT /api/auth/account            →  { currentPassword, email?, newPassword? }   (parol/login almashtirish)
```

---

## 2. Ruxsatlar (permissions)

Admin bo'limlarni o'qituvchiga ochadi. Kalitlar: **`journal`** · **`assignments`** · **`schedule`** ·
**`messages`** · **`salary`**. Ruxsat yo'q bo'lsa tegishli endpoint **`403`** qaytaradi.

- **`journal`** — guruh oylik jurnali (baho/davomat).
- **`schedule`** — o'quv dasturi (sillabus) o'tilishi + prognoz (jadval olib tashlangan; bu kalit endi sillabus uchun).
- **`assignments`** · **`messages`** · **`salary`** — topshiriq · chat · o'z oyligi.

Jurnal/sillabus endpointlari o'qituvchi **shu guruh egasi** (`Group.TeacherId == men`) ekanini tekshiradi —
aks holda `403`. `me` (profil) javobidagi `permissions` ro'yxatiga qarab UI'da bo'limlarni ko'rsating/yashiring.

---

## 3. Endpoint'lar (qisqa jadval)

### Profil / umumiy
| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/teacher/me` | Profil (FISH, login, guruhlari, ruxsatlar, rasm, maosh) |
| GET | `/api/teacher/meta` | Markaz meta (davomat sabablari + joriy davr) |
| GET | `/api/teacher/school` | Markaz nomi (brending) |
| GET | `/api/teacher/classes` | Dars beradigan guruhlari (har birida kurs/fan) |
| GET | `/api/teacher/salary?from=&to=` | O'z oyligi tarixi *(perm: salary)* |
| GET | `/api/teacher/progress` | O'tilgan darslar progresi (umumiy + guruh kesimi) |

### Guruh — OYLIK jurnal *(perm: journal + o'z guruhi)* — ASOSIY
| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/teacher/journal/group?classId=&month=` | Guruh oylik jurnali (o'quvchilar × dars sanalari) |
| PUT | `/api/teacher/journal` | Bitta katakni belgilash (baho/davomat/uy vazifa/xulq) |
| DELETE | `/api/teacher/journal?classId=&subjectId=&quarter=1&studentId=&date=&period=1` | Katakni tozalash |
| POST | `/api/teacher/journal/bulk-attendance` | Bitta sana — hamma o'quvchiga birdan davomat |

### Guruh — O'quv dasturi (sillabus) o'tilishi *(perm: schedule + o'z guruhi)*
| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/teacher/curriculum/group/{groupId}` | Sillabus daraxti + o'tilgan bandlar + tugash prognozi |
| POST | `/api/teacher/curriculum/group/{groupId}/cover` | Bandni o'tilgan/o'tilmagan qilish `{ itemId, covered }` |
| POST | `/api/teacher/curriculum/group/{groupId}/revision` | Takrorlash darsi +/− `{ delta }` |

### Baholash (UI: "Feedback") *(o'z guruhi/fanidan)*
| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/teacher/evaluation/types` | Baholash turlari (admin belgilaydi) |
| GET | `/api/teacher/evaluation/board?classId=&subjectId=&month=` | Baholash jadvali (o'quvchi×tur, oylik) |
| POST | `/api/teacher/evaluation/grade` | Bitta o'quvchiga bitta tur bo'yicha 1-5 |

### Sinf rahbarligi (homeroom)
| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/teacher/homeroom` | Rahbar guruhi o'quvchilari (+ pickup belgisi) |
| GET | `/api/teacher/pickups` | Bugungi pickup so'rovlari (ota-ona "olishga keldim") |
| POST | `/api/teacher/pickups/{id}/accept` | "Qabul qildim" → ota-onaga ruxsat push |
| POST | `/api/teacher/homeroom/handover` | "Topshirdim" (farzandni topshirish) → ota-onaga push |

### Topshiriqlar *(perm: assignments)*
| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/teacher/assignments` | O'z topshiriqlari |
| POST | `/api/teacher/assignments` | Yangi topshiriq |
| PUT · DELETE | `/api/teacher/assignments/{id}` | Tahrirlash / o'chirish |
| GET | `/api/teacher/assignments/{id}/results` | Natijalar (kim bajardi/ball) |
| PUT | `/api/teacher/assignments/{id}/submissions/{studentId}` | Bajarish holati + ball |
| GET | `/api/teacher/assignment-types` | Topshiriq turlari (dropdown) |
| POST | `/api/teacher/uploads` | Material fayl yuklash (multipart, ~20MB) |

### Chat *(perm: messages)*
| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/teacher/chat/classes` | Chat ochiq guruhlar |
| GET | `/api/teacher/chat/last-messages` | Har guruh oxirgi xabari (ro'yxat preview) |
| GET | `/api/teacher/chat/{className}?since=` | Guruh xabarlari |
| POST | `/api/teacher/chat/{className}` | Xabar yuborish |

### LMS (Ta'lim) — faqat ko'rish
| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/teacher/lms/subjects?classId=` | O'z guruhlari LMS fanlari |
| GET | `/api/teacher/lms/subjects/{subjectId}/topics` | Mavzular (to'liq kontent) |
| GET | `/api/teacher/lms/subjects/{subjectId}/progress` | O'quvchilar progress matritsasi |

### Boshqa
| Metod | Yo'l | Tavsif |
|---|---|---|
| POST | `/api/teacher/feedback` | Taklif/shikoyat (multipart, rasm bilan) → admin |
| POST | `/api/teacher/notifications/register` | Push qurilmani ro'yxatga olish |
| DELETE | `/api/teacher/notifications/register?token=...` | Qurilmani o'chirish (logout) |
| GET | `/api/teacher/push-config` | FCM konfiguratsiyasi (firebase appId va h.k.) |

### Legacy (ilova ishlatmaydi — chorak modeli)
`GET /journal/students` · `GET /journal/columns` · `GET /journal` · `GET·PUT /journal/notes` ·
`GET /journal/topics-template` · `POST /journal/topics-import`. Bular eski chorak-jurnal uchun edi;
oylik guruh-jurnali (`/journal/group`) ularning o'rnini bosadi.

---

## 4. Profil (`GET /api/teacher/me`)
```json
{
  "id": "t-1", "fullName": "Karimova Dilnoza", "email": "karimovadilnoza",
  "homeroomClass": "9-A",
  "subjects": [ { "id": "subj-1", "name": "Matematika" } ],
  "permissions": ["journal","assignments","schedule","messages","salary"],
  "photoUrl": "/uploads/abc.jpg"
}
```
- `homeroomClass` bo'sh bo'lsa — sinf rahbari emas (homeroom bo'limini yashiring).

---

## 5. Guruhlar (`GET /api/teacher/classes`)

O'qituvchi dars beradigan guruhlar (`Group.TeacherId == men`). UI'da bu ro'yxat **bosh sahifa**da
ko'rsatiladi; guruh bosilsa → oylik jurnal + sillabus ekraniga kiriladi.
```json
[ { "classId":"c-1", "className":"TEST-G", "grade":0, "isHomeroom":false,
    "subjects":[ { "id":"subj-1", "name":"Ingliz tili" } ] } ]
```
- `classId` — guruh IDsi (jurnal/sillabus chaqiruvlarida `classId`/`groupId` sifatida ishlatiladi).
- `subjects` — guruh kursi (bir guruh = bitta kurs).

---

## 6. Guruh OYLIK jurnali *(perm: journal + o'z guruhi)*

`GET /api/teacher/journal/group?classId=<guruh>&month=<yyyy-MM?>` → guruhning bitta oylik jurnali.
`month` berilmasa — joriy oy. Faqat guruh EGASI kirishi mumkin (aks holda `403`).
```json
{
  "group": { "id":"c-1", "name":"TEST-G", "courseId":"subj-1", "courseName":"Ingliz tili",
             "teacherName":"Karimova Dilnoza", "days":[0,2,4],
             "startTime":"15:00", "endTime":"16:30", "room":"201" },
  "months": ["2026-04","2026-05","2026-06"],
  "month": "2026-06",
  "columns": [ { "date":"2026-06-01", "period":1 }, { "date":"2026-06-03", "period":1 } ],
  "students": [ { "studentId":"s-1", "fullName":"Aliyev Ali", "status":"active", "balance":-100000 } ],
  "entries": [ { "studentId":"s-1", "date":"2026-06-01", "period":1, "grade":5,
                 "reasonId":null, "homework":1, "behavior":0, "mastery":null } ],
  "conductedDates": ["2026-06-01"]
}
```
- **Ustunlar AVTOMATIK** — guruh `days` (hafta kunlari) bo'yicha shu oydagi dars sanalari.
- `students` — faqat FAOL/sinov a'zolar jurnalga kiradi; `status`: `trial`/`active`/`frozen`
  (muzlatilganlar UI'da grid ostida read-only ko'rsatiladi). `balance` < 0 = qarz.
- `entries` — qiymat qo'yilgan kataklar. `homework`: 0=belgisiz·1=qildi·2=qilmadi.
  `behavior`: 0=belgisiz·1=yaxshi·2=yomon. `mastery` — ixtiyoriy o'zlashtirish.
- `conductedDates` — "dars o'tildi" belgilangan sanalar (yashil ✓ uchun).

### Bitta katakni belgilash — `PUT /api/teacher/journal`
```json
{ "classId":"c-1", "subjectId":"subj-1", "quarter":1, "studentId":"s-1",
  "date":"2026-06-01", "period":1, "grade":5, "reasonId":null,
  "homework":1, "behavior":0, "mastery":null }
```
- `subjectId` = guruh **kursi** (`group.courseId`). `quarter` va `period` — **opaque `1`**
  (oylik modelda ishlatilmaydi, lekin yuborilishi shart).
- Kelajak sanaga baho/davomat → `400`. Baho qo'yilsa o'quvchiga push boradi.

### Katakni tozalash — `DELETE /api/teacher/journal`
`?classId=&subjectId=<courseId>&quarter=1&studentId=&date=&period=1`

### Ommaviy davomat — `POST /api/teacher/journal/bulk-attendance`
Bitta sana uchun barcha (faol/sinov) o'quvchiga birdan:
```json
{ "classId":"c-1", "date":"2026-06-01", "absent":false, "reasonId":null }
```
- `absent=false` → "hammasi keldi" (sabablar tozalanadi, dars o'tildi).
- `absent=true` → "hammasi kelmadi" (`reasonId` berilsa shu sabab; berilmasa standart "Sababsiz" avto-yaratiladi).

---

## 7. O'quv dasturi (sillabus) o'tilishi *(perm: schedule + o'z guruhi)*

O'qituvchi guruh ichida **qaysi mavzular o'tilgani**ni belgilaydi va tugash sanasi prognozini ko'radi.
Sillabusni admin tuzadi (kurs → daraja → mavzu → band); o'qituvchi faqat o'tilgan/takrorlashni belgilaydi.

`GET /api/teacher/curriculum/group/{groupId}` →
```json
{
  "groupId":"c-1", "courseId":"subj-1", "courseName":"Ingliz tili",
  "totalItems":40, "coveredCount":12, "revisionLessons":2, "totalLessons":14,
  "remainingItems":28, "estLessonsLeft":31, "lessonsPerWeek":3, "estFinishDate":"2026-09-14",
  "levels":[ { "id":"l-1", "name":"Beginner", "note":"", "order":0,
    "topics":[ { "id":"tp-1", "title":"Unit 1", "note":"", "order":0,
      "items":[ { "id":"i-1", "text":"To be", "note":"", "order":0,
                  "covered":true, "coveredDate":"2026-06-01" } ] } ] } ]
}
```
- Prognoz: `pace = coveredCount / totalLessons`; `estLessonsLeft = ceil(remainingItems / pace)`;
  `estFinishDate` — guruh `days` bo'yicha bugundan oldinga yurib hisoblanadi.
- `coveredDate` — band BIRINCHI marta o'tilgan sana (o'qituvchi belgilagan kun).

`POST /api/teacher/curriculum/group/{groupId}/cover` `{ "itemId":"i-1", "covered":true }`
→ bandni o'tilgan (sana=bugun) yoki o'tilmagan qiladi. Idempotent.

`POST /api/teacher/curriculum/group/{groupId}/revision` `{ "delta":1 }`
→ takrorlash darsi qo'shadi (`delta>0`) yoki oxirgisini olib tashlaydi (`delta<0`).

---

## 8. Baholash / "Feedback" *(o'z guruhi/fanidan)*

O'qituvchi admin belgilagan **baholash turlari** (yozma, og'zaki...) bo'yicha o'quvchiga **oylik** 1-5 qo'yadi.

- `GET /api/teacher/evaluation/types` → `[{ id, name, description }]`.
- `GET /api/teacher/evaluation/board?classId=&subjectId=&month=` → jadval (o'quvchi × tur, oy):
  ```json
  { "months":["2026-06","2026-05"], "month":"2026-06",
    "types":[ { "id":"type-1", "name":"Yozma", "description":"" } ],
    "rows":[ { "studentId":"s-1", "fullName":"Aliyev Ali", "className":"TEST-G",
               "grades":{ "type-1":5 }, "avgGrade":5.0 } ],
    "subjectId":"subj-1" }
  ```
  - O'qituvchi shu guruhda o'qitmasa `403`. `month` berilmasa — eng so'nggi oy.
- `POST /api/teacher/evaluation/grade`:
  ```json
  { "studentId":"s-1", "typeId":"type-1", "month":"2026-06", "score":5,
    "subjectId":"subj-1", "classId":"c-1" }
  ```
  - `subjectId` va `classId` majburiy (egalik). `score` bo'sh / 1-5 dan tashqari → bahoni tozalaydi.

---

## 9. Sinf rahbarligi (homeroom)

`GET /api/teacher/homeroom` → `{ className, students: [ { studentId, fullName, hasPendingPickup, status, requestedAt } ] }`
(faqat rahbar guruhi; `hasPendingPickup=true` → ota-ona kelgan).

`GET /api/teacher/pickups` → bugungi pickup so'rovlari:
`[ { id, studentId, studentName, className, status, createdAt, acceptedAt, acceptedByName } ]`.

`POST /api/teacher/pickups/{id}/accept` → so'rovni tasdiqlaydi (status `accepted`) + **ota-onaga push**.

`POST /api/teacher/homeroom/handover` `{ "studentId":"..." }` → farzandni topshirish + ota-onaga push.

---

## 10. Maosh (`GET /api/teacher/salary?from=&to=`) *(perm: salary)*

O'qituvchining **o'z** oyligi tarixi/jamlamasi (`SalaryLedger`). Rejim: **qat'iy** summa yoki guruhlaridan
shu oyda yig'ilgan to'lovning **foizi**. `from`/`to` — ISO sana oralig'i (ixtiyoriy). Faqat o'ziniki.

---

## 11. Topshiriqlar *(perm: assignments)*

- `GET /api/teacher/assignments` → o'z topshiriqlari.
- `POST /api/teacher/assignments`:
  ```json
  { "subjectId":"subj-1", "title":"Nazorat ishi", "description":"...", "format":"test",
    "classIds":["c-1","c-2"], "startDate":"2026-06-05", "dueDate":"2026-06-10",
    "lateAccept":true, "latePenaltyPct":20, "maxScore":100, "autoGrade":true,
    "materials":[ ... ], "questions":[ ... ] }
  ```
  `format`: `test` / `file` / `text`. `questions` — test bo'lsa.
- `PUT /api/teacher/assignments/{id}` — tahrirlash; `DELETE /api/teacher/assignments/{id}` — o'chirish.
- `GET /api/teacher/assignments/{id}/results` → kim bajardi/bajarmadi + ball (faqat o'z topshirig'i).
- `PUT /api/teacher/assignments/{id}/submissions/{studentId}` `{ "completed":true, "score":85 }`.
- `GET /api/teacher/assignment-types` → dropdown uchun turlar.
- `POST /api/teacher/uploads` (multipart `file`, ~20MB) → `{ name, url:"/uploads/...", size, contentType }`.

---

## 12. Chat *(perm: messages)*
- `GET /api/teacher/chat/classes` → o'qituvchi yoza oladigan guruhlar.
- `GET /api/teacher/chat/last-messages` → `{ "TEST-G": "oxirgi xabar matni", ... }`.
- `GET /api/teacher/chat/{className}?since=<iso?>` → xabarlar.
- `POST /api/teacher/chat/{className}` `{ "text":"..." }` → xabar yuborish.

---

## 13. LMS (Ta'lim) — faqat ko'rish

O'qituvchi LMS kontentini yaratmaydi (admin qiladi); faqat o'z guruhlari materialini va progresini ko'radi.
- `GET /api/teacher/lms/subjects?classId=` → fanlar (ixtiyoriy bitta guruhga filtr).
- `GET /api/teacher/lms/subjects/{subjectId}/topics` → mavzular (hammasi ochiq), tugatgan o'quvchi soni bilan.
- `GET /api/teacher/lms/subjects/{subjectId}/progress` → matritsa: kim qaysi mavzuni tugatgan.

---

## 14. Taklif / shikoyat (`POST /api/teacher/feedback`)

O'qituvchi → admin. **Multipart/form-data:** `type=suggestion|complaint`, `text=<matn>`, `image=<fayl?>`.
- `text` bo'sh → `400`. Javob `204`.

---

## 15. Push bildirishnoma (FCM)
```http
POST /api/teacher/notifications/register
{ "token":"<fcm-token>", "platform":"android", "deviceName":"Samsung A52", "appId":"<firebase-app-id>" }
```
- Javob `{ "ok": true }`. Logout: `DELETE /api/teacher/notifications/register?token=<fcm-token>`.
- `GET /api/teacher/push-config` → firebase konfiguratsiyasi (ilovaga kerakli appId va h.k.).

---

## curl misol
```bash
B=https://crm.intellectschool.uz
TOKEN=$(curl -s -X POST $B/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"LOGIN","password":"PAROL"}' | jq -r .token)

curl -s $B/api/teacher/me      -H "Authorization: Bearer $TOKEN"
curl -s $B/api/teacher/classes -H "Authorization: Bearer $TOKEN"
curl -s "$B/api/teacher/journal/group?classId=c-1&month=2026-06"      -H "Authorization: Bearer $TOKEN"
curl -s "$B/api/teacher/curriculum/group/c-1"                          -H "Authorization: Bearer $TOKEN"
```

---

## Xatolar
| Kod | Sabab |
|---|---|
| `401` | Token yo'q/noto'g'ri yoki login/parol xato; akkaunt arxivlangan. |
| `403` | Ruxsat (perm) yo'q, yoki guruh egasi emas (`Group.TeacherId != men`). |
| `400` | Noto'g'ri ma'lumot (masalan kelajak sanaga baho, bo'sh matn). |
| `404` | O'qituvchi/guruh topilmadi. |
