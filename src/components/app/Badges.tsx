'use client'

import { cn } from '@/lib/utils'
import { ORDER_STATUS_LABEL } from '@/lib/types'
import { Minus, Plus } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmado: 'bg-sky-100 text-sky-800 border-sky-200',
  em_transito: 'bg-blue-100 text-blue-800 border-blue-200',
  entregue: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelado: 'bg-red-100 text-red-700 border-red-200',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold',
        STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700 border-slate-200',
        className
      )}
    >
      {status === 'em_transito' && <span className="live-dot" />}
      {ORDER_STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function PaymentBadge({ method, className }: { method: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold',
        method === 'TPA'
          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200',
        className
      )}
    >
      {method === 'TPA' ? '💳 TPA (cartão)' : '💵 Dinheiro'}
    </span>
  )
}

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  size = 'md',
  className,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const btn = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-10 w-10'
  const icon = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-5.5 w-5.5' : 'h-5 w-5'
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <button
        type="button"
        aria-label="Diminuir quantidade"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={cn(
          btn,
          'flex items-center justify-center rounded-full border border-input bg-white text-navy shadow-sm transition-all hover:bg-secondary active:scale-95 disabled:opacity-40 disabled:hover:bg-white'
        )}
      >
        <Minus className={icon} />
      </button>
      <span
        className={cn(
          'min-w-8 text-center font-black tabular-nums text-navy',
          size === 'sm' ? 'text-sm' : 'text-lg'
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={cn(
          btn,
          'flex items-center justify-center rounded-full bg-primary text-white shadow-sm transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40'
        )}
      >
        <Plus className={icon} />
      </button>
    </div>
  )
}
