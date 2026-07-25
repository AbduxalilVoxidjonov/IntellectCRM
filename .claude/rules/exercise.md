---
description: O'quv dasturidagi INTERAKTIV MASHQ (topshiriq konstruktori) — 8 kategoriya, 25 tur, tahrirlovchi + jonli foydalanuvchi ko'rinishi, o'quvchi portalida ishlashi.
paths:
  - "IntellectCRM.Client/src/components/exercise/**"
  - "IntellectCRM.Client/src/pages/admin/curricula/**"
  - "IntellectCRM.Server/Controllers/CurriculumController.cs"
  - "IntellectCRM.Client/src/pages/student/Lesson.tsx"
---

# Topshiriq konstruktori (interaktiv mashqlar) qoidalari

- **QAYERDA:** o'quv dasturining OXIRGI bosqichida — Dastur → Modul → Mavzu → Dars → **Topshiriq**.
  Topshiriq turi (`LESSON_TYPES`) ga **"Mashq"** (`exercise`) qo'shilgan. Shu turdagi topshiriq
  ochilganda `CurriculumItemEditorPage` oddiy tahrirlovchi o'rniga **`ExerciseWorkspace`** ni
  ko'rsatadi.

- **YARATISH OQIMI (muhim):** darsdagi **"+ Topshiriq"** tugmasi endi eski "tur chiplari" modalini
  EMAS, **tur tanlash ekranini** (`ExercisePicker` — zip maketidagi "Topshiriq yaratish") ochadi.
  Tablar: 8 mashq kategoriyasi + **oxirgi "Boshqa"** tabi (`OTHER_CATEGORY`) — u yerda ESKI turlar
  (video / matn / audio / PDF / lug'at / oddiy test) o'z mini previewlari bilan.
  · Mashq turi tanlansa → bitta nom so'raladi (`NameModal`, tur nomi bilan oldindan to'ldirilgan) →
    `createItem(..., type="exercise", exerciseKind)` → darhol konstruktorga o'tiladi.
  · "Boshqa" turi tanlansa → eski `BulkAddModal` (tur qulflangan, faqat nomlar) → `createItemsBulk`.
  Turni keyin ham almashtirish mumkin: jadvaldagi qalam tugmasi (`ItemEditModal`) yoki konstruktordagi
  "Turni o'zgartirish" (u yerda "Boshqa" tabi ko'rsatilmaydi — mashqdan mashqqa).

- **SAQLASH:** `CourseItem.ExerciseKind` (tur, masalan `sentence-order`) + `CourseItem.ExerciseJson`
  (turga mos JSON mazmun) — migratsiya `AddCourseItemExercise`. `SaveItemContentRequest`da bu ikki
  maydon **null bo'lsa TEGILMAYDI** (boshqa turdagi topshiriqni saqlash mashqni o'chirmasin).
  `IsReady` (daraxtdagi yashil belgi) va `MetaFor` (tur yorlig'i) mashqni hisobga oladi —
  `CurriculumController.ExerciseLabel` nomlari front-end katalogi bilan bir xil.

- **TAXONOMIYA — 8 kategoriya, 25 tur** (`components/exercise/catalog.tsx`, `CATEGORIES`):
  Make sentence (so'z tartibi / audio / rasm / variant tanlash) · Bo'sh joyni to'ldirish (variant /
  yozish / audio / rasm) · So'z tanlash (oddiy / rasm / audio) · So'z topish (oddiy / rasm / audio) ·
  Reading (variant / to'g'ri-xato / bo'sh joy / qisqa javob) · Test (rasmli / rasmli variantlar /
  audio) · Writing & Speaking · Moslashtirish (oddiy / reading / audio). Tur `ExerciseKind`
  (`model.ts`) — `kindFamily()` tahrirlovchini, `kindMedia()` audio/rasm borligini, `kindTheme()`
  maketdagi rang sxemasini beradi.

- **KOMPONENTLAR** (`src/components/exercise/`, CRM ichida — admin ham, o'quvchi portali ham
  ishlatadi): `model.ts` (ma'lumot modeli + parsing yordamchilari: `___` bo'sh joylar,
  `(bir/*ikki)` variantlar, `/` bilan ajratilgan javoblar), `catalog.tsx` (turlar + mini previewlar
  + ranglar), `kit.tsx` (maketdagi chrome: qorong'i sarlavha, banner, ikki panel, telefon ramkasi,
  toast, audio/rasm yuklagich), `ExercisePicker.tsx` (tur tanlash ekrani), `editors/*` (chap panel
  tahrirlovchilari), **`players.tsx`** (o'ng paneldagi jonli ekran).

- **BITTA PLEYER — IKKI JOYDA:** `ExercisePlayer`/`ExerciseRunner` konstruktordagi "Foydalanuvchi
  ko'rinishi" previewi (`mode="preview"`, element chapdagi ro'yxatdan tanlanadi) VA o'quvchi
  portalidagi haqiqiy ishlash (`mode="solve"`, elementlar ketma-ket, oxirida natija) uchun AYNAN bir
  xil komponent. Yangi tur qo'shilsa faqat shu ikki joyga (editor + player) qo'shiladi.

- **O'QUVCHIDA:** `student/Lesson.tsx` bo'limlariga `exercise` qo'shilgan — dars kontenti ichida
  (video/matn/audio/pdf/lug'at/test dan keyin) alohida qadam sifatida chiqadi. Dars ochilishi eski
  qoidada: o'qituvchi "o'tildi" qilmaguncha yopiq (`GroupCurriculumLog`).

- **DIZAYN:** maketlar (`tpshiriqlar.zip`) 1:1 ko'chirilgan — inline stillar, 'Space Grotesk' +
  'Figtree' shriftlari (`index.html`), hover/animatsiyalar `src/styles/exercise.css` da `.dc-root`
  ichida (CRM'ning qolgan qismiga ta'sir qilmaydi). Har kategoriyaning o'z aksent rangi bor
  (`THEMES`) — gap tuzish binafsha, bo'sh joy ko'k, so'z tanlash yashil-ko'k, so'z topish sariq,
  reading to'q sariq, test ko'k, writing ko'k, speaking pushti, moslashtirish yashil.
