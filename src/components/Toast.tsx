import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastMsg {
  id: number
  text: string
  action?: ToastAction
}

const ToastCtx = createContext<(text: string, action?: ToastAction) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const nextId = useRef(0)

  const show = useCallback((text: string, action?: ToastAction) => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, text, action }])
    setTimeout(() => setToasts((t) => t.filter((m) => m.id !== id)), 4500)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] z-50 flex flex-col items-center gap-2 px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="glass-deep animate-toast-in flex max-w-full items-center gap-3 rounded-full py-2.5 pl-4 pr-2.5 text-center text-sm font-medium text-ink dark:text-dusk-ink"
          >
            <span className="pointer-events-none">{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  setToasts((all) => all.filter((m) => m.id !== t.id))
                }}
                className="shrink-0 rounded-full bg-cobalt-soft px-3 py-1 text-xs font-semibold text-cobalt active:scale-95 dark:bg-cobalt-lift/15 dark:text-cobalt-lift"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
