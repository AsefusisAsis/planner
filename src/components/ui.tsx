import {
  type ReactNode,
  type ButtonHTMLAttributes,
  useEffect,
} from 'react'
import { X } from 'lucide-react'

// ---------- Button ----------
type Variant = 'primary' | 'ghost' | 'danger' | 'subtle'
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}
export function Button({ variant = 'primary', className = '', ...rest }: BtnProps) {
  const base =
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const styles: Record<Variant, string> = {
    primary: 'text-white',
    ghost: 'hover:bg-[var(--bg-3)]',
    subtle: 'bg-[var(--bg-3)] hover:opacity-80',
    danger: 'text-white',
  }
  const inline =
    variant === 'primary'
      ? { background: 'var(--accent)' }
      : variant === 'danger'
        ? { background: 'var(--danger)' }
        : undefined
  return <button className={`${base} ${styles[variant]} ${className}`} style={inline} {...rest} />
}

// ---------- IconButton ----------
export function IconButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text)] transition-colors ${className}`}
      {...rest}
    />
  )
}

// ---------- Card ----------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {children}
    </div>
  )
}

// ---------- Page header ----------
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--text-2)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ---------- Empty state ----------
export function Empty({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-[var(--text-3)]">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  )
}

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border p-5 sm:rounded-2xl"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton onClick={onClose} aria-label="close">
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------- Field ----------
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-2)]">{label}</span>
      {children}
    </label>
  )
}
