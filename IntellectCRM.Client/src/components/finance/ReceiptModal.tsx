import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Loader } from '@/components/ui/Loader'
import { getReceipt } from '@/api/services/finance'
import { receiptHtml, receiptCss, printReceipt, type ReceiptData } from '@/lib/receipt'
import { parseCheckSettings, type CheckSettings } from '@/config/checkSettings'

interface Props {
  /** Chek chiqariladigan to'lov (tranzaksiya) id'si; null = yopiq */
  txId: string | null
  /** Ochilganda avtomatik print dialogini ochish (to'lov kiritilgandan keyin) */
  autoPrint?: boolean
  onClose: () => void
}

/** To'lov cheki (termal kvitansiya) — ko'rib chiqish + bosib chiqarish. */
export function ReceiptModal({ txId, autoPrint, onClose }: Props) {
  const [data, setData] = useState<ReceiptData | null>(null)
  const [settings, setSettings] = useState<CheckSettings | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!txId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal yopilganda tozalash
      setData(null)
      setSettings(null)
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- modal ochilganda yuklash
    setLoading(true)
    getReceipt(txId)
      .then((r) => {
        const { settingsJson, ...rest } = r
        setData(rest)
        const s = parseCheckSettings(settingsJson)
        setSettings(s)
        if (autoPrint) printReceipt(rest, s)
      })
      .finally(() => setLoading(false))
  }, [txId, autoPrint])

  const print = () => {
    if (data && settings) printReceipt(data, settings)
  }

  return (
    <Modal
      open={!!txId}
      onClose={onClose}
      size="sm"
      title="To'lov cheki"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Yopish
          </Button>
          <Button onClick={print} disabled={!data}>
            <Printer className="h-4 w-4" /> Chop etish
          </Button>
        </>
      }
    >
      {loading || !data || !settings ? (
        <Loader label="Yuklanmoqda..." />
      ) : (
        <div className="flex justify-center rounded-lg bg-slate-100 py-4">
          <style>{receiptCss}</style>
          <div
            className="receipt shadow-md"
            dangerouslySetInnerHTML={{ __html: receiptHtml(data, settings) }}
          />
        </div>
      )}
    </Modal>
  )
}
