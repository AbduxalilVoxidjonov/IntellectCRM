/**
 * To'lov cheki (termal kvitansiya) sozlamalari — frontend modeli.
 * JSON satr sifatida CenterMeta.CheckSettings'da saqlanadi (backend faqat saqlaydi/qaytaradi).
 */

/** Chekda ko'rsatiladigan maydonlar (yoq/o'chir). "Jami" doim ko'rinadi — sozlanmaydi. */
export interface CheckFieldFlags {
  receiptNo: boolean
  datetime: boolean
  student: boolean
  teacher: boolean
  responsible: boolean
  group: boolean
  method: boolean
  comment: boolean
}

export interface CheckSettings {
  /** Sarlavhada markaz logotipi */
  showLogo: boolean
  /** Sarlavhada markaz nomi */
  showName: boolean
  fields: CheckFieldFlags
  /** Pastki izoh (footer), masalan "Tashrifingiz uchun rahmat!" */
  footerText: string
  /** Pastda markaz telefoni + manzili */
  showContact: boolean
  /** QR kod ko'rsatish */
  showQr: boolean
  /** QR ichidagi matn/havola (bo'sh bo'lsa markaz telefoni) */
  qrText: string
}

export const defaultCheckSettings: CheckSettings = {
  showLogo: true,
  showName: true,
  fields: {
    receiptNo: true,
    datetime: true,
    student: true,
    teacher: true,
    responsible: true,
    group: true,
    method: true,
    comment: true,
  },
  footerText: 'Tashrifingiz uchun rahmat!',
  showContact: true,
  showQr: false,
  qrText: '',
}

/** JSON satrni xavfsiz CheckSettings'ga aylantiradi (bo'sh/buzilgan bo'lsa — standart). */
export function parseCheckSettings(json: string | null | undefined): CheckSettings {
  if (!json) return defaultCheckSettings
  try {
    const p = JSON.parse(json) as Partial<CheckSettings>
    return {
      ...defaultCheckSettings,
      ...p,
      fields: { ...defaultCheckSettings.fields, ...(p.fields ?? {}) },
    }
  } catch {
    return defaultCheckSettings
  }
}

/** Maydon yorliqlari (sozlamalar ro'yxati uchun). */
export const checkFieldLabels: { key: keyof CheckFieldFlags; label: string }[] = [
  { key: 'receiptNo', label: 'Id (chek raqami)' },
  { key: 'datetime', label: 'Vaqt' },
  { key: 'student', label: "O'quvchi" },
  { key: 'teacher', label: "O'qituvchi" },
  { key: 'responsible', label: "Mas'ul" },
  { key: 'group', label: 'Guruh' },
  { key: 'method', label: "To'lov turi" },
  { key: 'comment', label: 'Izoh' },
]
