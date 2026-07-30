---
description: Kitoblar sotuvi — ombor (qoldiq/kirim tarixi), Telegram bot orqali buyurtma, admin tasdiqlash va analitika.
paths:
  - "IntellectCRM.Application/Services/BookSalesService.cs"
  - "IntellectCRM.Application/Services/BookShopBotService.cs"
  - "IntellectCRM.Server/Controllers/BooksController.cs"
  - "IntellectCRM.Client/src/pages/admin/books/**"
  - "IntellectCRM.Client/src/api/services/books.ts"
---

# Kitoblar sotuvi qoidalari

Migratsiya: `AddBookSales` (20260730050021). Modul markazda sotiladigan kitoblarni omborda yuritadi va
Telegram bot orqali buyurtma qabul qiladi. **Click/Payme YO'Q** — faqat naqd yoki karta raqamiga o'tkazma
+ chek rasmi.

## 1. Entitylar (Domain/Entities.cs, "KITOBLAR SOTUVI" bo'limi)

| Entity | Vazifasi |
|---|---|
| `Book` | Tovar: `Title/Author/Description/CoverUrl/CoverFileId/Price/Stock/IsActive/CreatedAt/CreatedBy` |
| `BookStockMove` | Qoldiqning HAR bir o'zgarishi: `Qty` (±), `Reason`, `OrderId?`, `Note`, `StockAfter`, `CreatedBy` |
| `BookOrder` | Botdan tushgan buyurtma (nom/narx SNAPSHOT), `Number` (#1,#2…), `Status`, `ReceiptUrl`, `DecidedAt/By` |
| `BookBotSession` | Chatning vaqtinchalik savdo holati — `ChatId` UNIKAL (bir chatda bitta faol sessiya) |

- `Book.CoverFileId` — Telegram keshlagan `file_id`. Muqova bir marta yuklangach botga qayta
  yuklanmaydi (APK/test PDF bilan bir xil usul). **Muqova o'zgarsa `CoverFileId` bo'shatilishi SHART.**
- `BookOrder.StudentId` — bot foydalanuvchisining telefoni markazdagi o'quvchi (`Phone`/`ParentPhone`)
  bilan mos kelsa teglanadi. Mos kelmasa `null` — mehmon ham kitob sotib olishi mumkin.

## 2. YAGONA QOIDA: qoldiq faqat TASDIQLAGANDA ayiriladi

`BookSalesService` (static, Application/Services) — ombor/buyurtma mantig'ining **yagona joyi**.
Controller ham, bot ham faqat shu orqali ishlaydi, aks holda "qoldiq qanday o'zgaradi" ikki xil bo'lib ketadi.

```
Bot: buyurtma yaratildi  →  Stock TEGILMAYDI  (Status=pending)
Admin: Tasdiqlash        →  Move(book, -Qty, "sale", …)  →  Stock ayiriladi
Admin: Rad etish         →  Stock TEGILMAYDI, mijozga sabab yuboriladi
```

- `Move(book, qty, reason, note, createdBy, orderId?)` — `Stock`ni o'zgartiradi va `BookStockMove`
  qaytaradi. **`SaveChanges` chaqirmaydi** — chaqiruvchi o'z tranzaksiyasida saqlaydi (tasdiqlash
  bitta SaveChanges'da ketsin).
- `ApproveAsync` / `RejectAsync` — `null` qaytarsa muvaffaqiyat, aks holda foydalanuvchiga
  ko'rsatiladigan xato matni (chaqiruvchi 400 qiladi va mijozga xabar YUBORMAYDI).
- Qoldiq yetmasa tasdiqlash rad etiladi (`"Omborda yetarli emas: qoldiq N, buyurtma M"`).
- Konstantalar: `StatusPending|Approved|Rejected`, `ReasonInitial|Restock|Sale|Correction`,
  `PayCash|PayCard`. **Xom satr yozmang** — shu konstantalardan foydalaning.
- Mijozga/adminga ketadigan matnlar ham shu yerda (`CustomerApprovedText`, `CustomerRejectedText`,
  `AdminNewOrderText`) — controller va bot bir xil matn yuborsin.
- `NotifyAdminsAsync` — yangi buyurtma haqida `TelegramRegistration`dagi admin/superadminlarga xabar.
  Xato **jim yutiladi** (`LeadNotifier` bilan bir xil siyosat) — xabarnoma buyurtmani buzmasin.

## 3. Bot oqimi (`BookShopBotService`, singleton)

`OnlineTestBotService` bilan bir xil tuzilma. Barcha callback'lar `Handles(data)` orqali
`TelegramBotService`dan yo'naltiriladi.

```
«📚 Kitob sotib olish» (yoki /kitoblar)
   → ShowCatalogAsync    — IsActive kitoblar (max 30), narx + qoldiq; tugma faqat Stock>0 bo'lsa
   → kb:{id}  OpenBookAsync   — muqova + tavsif, soni so'raladi (Step="qty")
   → kq:{n} / kqm             — soni tanlandi yoki qo'lda yoziladi (max 50)
   → kpc  ChooseCashAsync     — Step="confirm" → kconf ConfirmCashAsync
   → kpk  ChooseCardAsync     — karta rekvizitlari, Step="receipt" → rasm/PDF kutiladi
   → kcan CancelAsync         — sessiya o'chiriladi
```

- **Majburiy obuna** kitob buyurtmasiga ham tegishli (`RequireSubscriptionAsync`) — katalog ochishda
  va eski xabardagi `kb:` tugmasi bosilganda ikkalasida ham tekshiriladi.
- Chek (rasm/hujjat) `TelegramBotService.HandleFileAsync`da qabul qilinadi — avval
  `AwaitingReceiptAsync` tekshiriladi, keyin `HandleReceiptAsync` faylni `/uploads/…` ga ko'chiradi.
- `CreateOrderAsync` qoldiqni **yana bir bor** tekshiradi (boshqa mijoz oldin olgan bo'lishi mumkin).
- Karta rekvizitlari kiritilmagan bo'lsa `ChooseCardAsync` mijozga "sozlanmagan, naqdni tanlang"
  deydi — sessiya bosqichi o'zgarmaydi.
- **Kitob sotuvi HAMMAGA ochiq** — sotib olish uchun markazda o'qish shart emas. Markaz ro'yxatida
  topilmagan mijoz `GuestKeyboard` (kitob + adminga murojaat) oladi.

## 4. Botda tugma ko'rinmasa — `CenterMeta.BookSalesEnabled`

Tugma **kitoblar soniga bog'liq emas**, faqat shu bayroqqa:
`TelegramBotService.RegisteredKeyboard(books)` ← `BookSalesEnabledAsync(db)`.

> ⚠️ Migratsiya bu ustunni mavjud bazaga `defaultValue: false` bilan qo'shgan (entity'da `= true`,
> lekin u faqat YANGI qatorga tegishli). Ya'ni **eski o'rnatishda modul O'CHIQ** holda keladi —
> Sozlamalar tabidan yoqish kerak. Yoqilgandan keyin botda `/start` yuborilishi ham shart:
> Telegram reply-klaviaturani mijoz tomonida keshlaydi.

Sozlamalar `CenterMeta`da (maxfiy EMAS — mijozga baribir ko'rsatiladi, `.env` emas):
`BookSalesEnabled`, `BookCardNumber`, `BookCardHolder`, `BookPaymentNote`.

## 5. API — `BooksController` (`api/admin/books`, `[AdminPerm("books")]`)

| Metod · yo'l | Vazifasi |
|---|---|
| `GET /` | Kitoblar + sotuv/kutilayotgan statistika (N+1 emas — bitta so'rovda biriktiriladi) |
| `POST /` | Yangi kitob; `InitialStock` berilsa `"initial"` kirim yoziladi |
| `PUT /{id}` | Tahrirlash — **qoldiq bu yerda o'zgarmaydi** |
| `DELETE /{id}` | Buyurtma tarixi bor kitob O'CHIRILMAYDI (hisobot buzilmasin) — `IsActive=false` qiling |
| `POST /{id}/stock` | Qoldiq kirim/korreksiya (`qty` ±, `note`) |
| `GET /stock-moves` | Ombor tarixi; `onlyIn=true` → faqat kirim (Qty>0) |
| `GET /orders`, `GET /orders/pending-count` | Buyurtmalar + nav belgisi uchun sanoq |
| `POST /orders/{id}/approve`, `/reject` | `BookSalesService` orqali; muvaffaqiyatda mijozga xabar |
| `GET /analytics` | Tushum (naqd/karta), sotilgan soni, qoldiq, kunlik va kitob kesimi |
| `GET /orders/export`, `/stock-moves/export`, `/analytics/export` | .xlsx (analitika — 3 varaq) |
| `GET|PUT /settings` | Bot sozlamalari (yuqoridagi 4 maydon) |
| `POST /cover` | Muqova yuklash |

## 6. Frontend — `/admin/books` (nav: O'quv bo'limi → Kitoblar sotuvi)

`pages/admin/books/BookSalesPage.tsx` — 4 tab: **Buyurtmalar** (default) · **Ombor** · **Analitika** ·
**Sozlamalar**. Yozish amallari `can('books','edit')` bilan darvozalangan. API qatlami
`api/services/books.ts`, yorliqlar `bookLabels.ts` (status/to'lov/sabab matnlari — komponentda xom
satr yozilmasin).

## 7. Moliya bilan bog'liqlik — YO'Q

Kitob sotuvi **`FinanceTransaction`ga yozilmaydi** va o'quvchi balansiga tegmaydi. Tushum faqat shu
bo'limning analitikasida ko'rinadi. (Sabab: o'quv to'lovi hisobotlarini kitob savdosi buzmasin.)
Agar kelajakda kassaga ulash kerak bo'lsa — `ApproveAsync` ichida, bitta joyda qilinadi.
