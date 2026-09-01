import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastMsg {
  id: number
  text: string
}

const ToastCtx = createContext<(text: string) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const nextId = useRef(0)

  const show = useCallback((text: string) => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((m) => m.id !== id)), 3500)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="rounded-xl bg-ink px-4 py-2.5 text-sm text-paper shadow-lg dark:bg-paper dark:text-ink"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
