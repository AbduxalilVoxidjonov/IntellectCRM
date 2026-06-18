# PhoneInput Maskalash Komponenti - Qo'llanma

## Xulosa

**PhoneInput** komponenti Uzbekistan telefon raqamlarini avtomatik maskalaydi. User formatlanmagan raqam kiritadi, komponenti emas maskali qiymat bilan ko'rsatadi, backend esa sof raqamni (`998901234567`) oladi.

## Format

**Display (UI'da ko'rinadigan):** `(998) 90-123-45-67`
**Internal Value (backend'ga yuboriladi):** `998901234567`

## Ichki Tuzilish

### Utility Funksiyalari (`src/lib/utils.ts`)

```typescript
/**
 * Telefon raqamini maskalash: +(998) 90-123-45-67
 * Input: "998901234567" yoki "+998901234567" yoki "901234567"
 * Output: "(998) 90-123-45-67"
 */
export function maskPhone(raw: string): string

/**
 * Formatlanmish telefon raqamidan sof raqamlarni ol (backend'ga).
 * Input: "(998) 90-123-45-67"
 * Output: "998901234567"
 */
export function unmaskPhone(formatted: string): string
```

### PhoneInput Komponenti (`src/components/ui/PhoneInput.tsx`)

```typescript
interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'>, FieldWrap {
  /** Masklanmagan raqam: "998901234567" yoki "" */
  value: string
  /** onChange: masklanmagan raqam qaytaradi */
  onChange: (unmaskedValue: string) => void
}

export function PhoneInput({ label, required, className, value, onChange, ...rest }: PhoneInputProps)
```

## Ishlash Mexanizmi

1. **Input:** User raqam yozadi (har qanday format: "+998 90...", "90...", "998...")
2. **Filter:** Faqat raqamlar olinadi, boshqa belgiler o'chiriladi
3. **Normalizatsiya:** `998` prefix qo'shiladi (agar yo'q bo'lsa)
4. **Chegaralash:** Maksimal 12 raqamga (998 + 9 raqam)
5. **Maskalash:** `(998) 90-123-45-67` formatiga keltiriladi
6. **Display:** Maskali qiymat UI'da ko'rinadi
7. **onChange:** Masklanmagan raqam (`998901234567`) komponentga yuborish uchun qaytaradi

## Fayllar O'zgartirilgan

### 1. Utility Funksiyalar Qo'shildi
- **Fayl:** `src/lib/utils.ts`
- **Qo'shilgan:** `maskPhone()` va `unmaskPhone()` funksiyalari

### 2. Yangi PhoneInput Komponenti Yaratildi
- **Fayl:** `src/components/ui/PhoneInput.tsx` (yangi faylдор
- **Xususiyatlari:**
  - Avtomatik maskalash
  - Label va required yorlig'i
  - Placeholder: "(998) 90-123-45-67"
  - Backend'ga masklanmagan raqam qaytaradi

### 3. StudentFormModal Yangilandi
- **Fayl:** `src/pages/admin/students/StudentFormModal.tsx`
- **O'zgarishlar:**
  - Import qo'shildi: `import { PhoneInput } from '@/components/ui/PhoneInput'`
  - 3 ta `<Input>` → `<PhoneInput>` almastirildi:
    - O'quvchi o'z telefon raqami
    - Otasi raqami
    - Onasi raqami

### 4. TeacherFormModal Yangilandi
- **Fayl:** `src/pages/admin/teachers/TeacherFormModal.tsx`
- **O'zgarishlar:**
  - Import qo'shildi: `import { PhoneInput } from '@/components/ui/PhoneInput'`
  - 1 ta `<Input type="tel">` → `<PhoneInput>` almashtirildi:
    - Telefon

### 5. LeadFormModal Yangilandi
- **Fayl:** `src/pages/admin/leads/LeadFormModal.tsx`
- **O'zgarishlar:**
  - Import qo'shildi: `import { PhoneInput } from '@/components/ui/PhoneInput'`
  - 3 ta `<Input>` → `<PhoneInput>` almastirildi:
    - O'quvchi o'z telefon raqami
    - Otasi raqami
    - Onasi raqami

### 6. StaffPage Yangilandi
- **Fayl:** `src/pages/admin/staff/StaffPage.tsx`
- **O'zgarishlar:**
  - Import qo'shildi: `import { PhoneInput } from '@/components/ui/PhoneInput'`
  - Telefon input qo'shildi (avvalgi edi yo'q, faqat state'da bor edi):
    - Xodim telefon raqami

### 7. AccountSettings Yangilandi
- **Fayl:** `src/pages/admin/account/AccountSettings.tsx`
- **O'zgarishlar:**
  - Import qo'shildi: `import { PhoneInput } from '@/components/ui/PhoneInput'`
  - 1 ta `<Input type="tel">` → `<PhoneInput>` almashtirildi:
    - Admin telefon (Telegram bot uchun)

## Ishlatish Misoli

### React komponentida:

```typescript
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useState } from 'react'

function MyComponent() {
  const [phone, setPhone] = useState('')

  const handleSubmit = () => {
    // phone = "998901234567" (masklanmagan)
    console.log('Backend ga yuborish:', phone)
  }

  return (
    <form>
      <PhoneInput
        label="Telefon raqamim"
        value={phone}
        onChange={setPhone}
        required
      />
      <button onClick={handleSubmit}>Saqlash</button>
    </form>
  )
}
```

### Forma state'iga ulash:

```typescript
const [form, setForm] = useState({ phone: '', name: '' })

const update = (key, value) => setForm(f => ({ ...f, [key]: value }))

return (
  <PhoneInput
    label="Telefon"
    value={form.phone}
    onChange={(phone) => update('phone', phone)}
  />
)
```

## Backend Integratsiyasi

**Backend'ga yuboriladi:** `998901234567` (sof raqamlar)
**Validatsiya:** Backend raqamni normallashtirishi kerak (agar kerak bo'lsa)

Misol (C# / ASP.NET):
```csharp
// Raqamni normalize qilish (iloji yo'q bo'lsa — ignore)
public static string NormalizePhone(string raw)
{
  if (string.IsNullOrWhiteSpace(raw)) return "";
  string digits = new string(raw.Where(char.IsDigit).ToArray());
  if (!digits.StartsWith("998")) digits = "998" + digits;
  return digits.Length > 12 ? digits[..12] : digits;
}
```

## User Experience

### To'g'ri:
- User: `"90 123 45 67"` yozadi
- UI: `"(998) 90-123-45-67"` ko'rinadi
- Backend: `"998901234567"` oladi ✓

### To'g'ri:
- User: `"+998 901234567"` yozadi
- UI: `"(998) 90-123-45-67"` ko'rinadi
- Backend: `"998901234567"` oladi ✓

### To'g'ri:
- User: `"998901234567"` yozadi
- UI: `"(998) 90-123-45-67"` ko'rinadi
- Backend: `"998901234567"` oladi ✓

## Feature'lar

✅ Avtomatik +998 prefix qo'shish
✅ Faqat raqamlar qabul qilish (boshqa belgili chiqarish)
✅ Maksimal 12 raqamga chegaralash
✅ Tibbiy formatda maskaksh: `(998) 90-123-45-67`
✅ Placeholder ko'rsatish: `(998) 90-123-45-67`
✅ Label va required yorlig'i
✅ Backend'ga masklanmagan qiymat qaytarish
✅ TypeScript type-safe
✅ Reusable komponenti

## Testing

### Manual Test

1. Login to admin panel
2. O'quvchi yaratish/tahrirlash → Telefon yoz:
   - `"9015"` → Display: `"(998) 90-15"`
   - `"901234567"` → Display: `"(998) 90-123-45-67"`
   - `"+998 90 123 45 67"` → Display: `"(998) 90-123-45-67"`
3. Saqlash → Backend `"998901234567"` oladi ✓

### Form Integratsiyasi

Barcha quyidagi formalarida maskalash aktiv:
- O'quvchi yaratish/tahrirlash (3 telefon maydoni)
- O'qituvchi yaratish/tahrirlash (1 telefon maydoni)
- Lid yaratish/tahrirlash (3 telefon maydoni)
- Xodim yaratish/tahrirlash (1 telefon maydoni)
- Admin akkaunt sozlamalari (1 telefon maydoni)

## Mustaqil O'zgartirishlar (agar kerak bo'lsa)

Boshqa joylarda telefon input qo'shish uchun:

```typescript
// 1. Impoirt
import { PhoneInput } from '@/components/ui/PhoneInput'

// 2. State'da telefon maydoni
const [phone, setPhone] = useState('')

// 3. JSX'da
<PhoneInput
  label="Telefon"
  value={phone}
  onChange={setPhone}
  required
/>
```

## Xulosa

**PhoneInput** maskalash komponenti:
- ✅ Tez va oson (copy-paste bilan tadbiq etiladi)
- ✅ Type-safe (TypeScript)
- ✅ Reusable (barcha forma'larda ishlatiladi)
- ✅ User-friendly (maskalash avtomatik)
- ✅ Backend-compatible (masklanmagan raqam qaytaradi)
- ✅ Uzbek qo'llanma (userга to'g'ri bo'ylik)
