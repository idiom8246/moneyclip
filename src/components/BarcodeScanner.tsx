import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { IconX } from './icons'

/** Full-screen camera modal scanning EAN/UPC barcodes (@zxing/browser, spec §6.1). */
export function BarcodeScanner({
  onResult,
  onClose,
}: {
  onResult: (code: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls: IScannerControls | undefined
    let cancelled = false

    BrowserMultiFormatReader.listVideoInputDevices()
      .then((devices) =>
        reader.decodeFromVideoDevice(
          devices[0]?.deviceId,
          videoRef.current ?? undefined,
          (result) => {
            if (result && !cancelled) {
              cancelled = true
              controls?.stop()
              onResult(result.getText())
            }
          },
        ),
      )
      .then((c) => {
        if (cancelled) c.stop()
        else controls = c
      })
      .catch(() => setError(true))

    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [onResult])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal>
      <div className="flex items-center justify-between p-3">
        <span className="text-sm text-white">{t('barcode.scanning')}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white"
        >
          <IconX />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        {error ? (
          <p className="text-white">{t('barcode.cameraError')}</p>
        ) : (
          <video ref={videoRef} className="max-h-[70vh] w-full rounded-2xl object-cover" muted playsInline />
        )}
      </div>
    </div>
  )
}
