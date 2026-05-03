"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState
} from "react";
import { AnimatePresence, motion } from "framer-motion";

export type ToastKind = "info" | "success" | "warn" | "error";

type Toast = {
  id: number;
  text: string;
  kind: ToastKind;
  emoji?: string;
};

type Ctx = {
  toast: (text: string, opts?: { kind?: ToastKind; emoji?: string; ttl?: number }) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback<Ctx["toast"]>((text, opts) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, text, kind: opts?.kind || "info", emoji: opts?.emoji }]);
    const ttl = opts?.ttl ?? 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ttl);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={
                "glass pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm " +
                (t.kind === "success"
                  ? "border-emerald-400/40 text-emerald-100"
                  : t.kind === "warn"
                    ? "border-amber-400/40 text-amber-100"
                    : t.kind === "error"
                      ? "border-rose-400/40 text-rose-100"
                      : "text-white/90")
              }
            >
              {t.emoji && <span className="text-lg">{t.emoji}</span>}
              <span className="leading-relaxed">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Graceful no-op when used outside provider
    return { toast: () => {} };
  }
  return ctx;
}
