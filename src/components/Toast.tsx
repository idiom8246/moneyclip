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
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] z-50 flex flex-col items-center gap-2 px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-toast-in max-w-full rounded-full bg-ink/95 px-4 py-2.5 text-center text-sm font-medium text-paper shadow-xl shadow-ink/20 ring-1 ring-white/10 backdrop-blur dark:bg-paper/95 dark:text-ink dark:shadow-black/40"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
