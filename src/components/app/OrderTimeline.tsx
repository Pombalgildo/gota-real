'use client'

import { cn } from '@/lib/utils'
import type { Order } from '@/lib/types'
import { formatTime, durationMinutes } from '@/store/app-store'
import { Check, Clock, PackageCheck, Bike, XCircle, ClipboardCheck } from 'lucide-react'

interface Step {
  key: string
  label: string
  time?: string | null
  done: boolean
  active?: boolean
  icon: React.ReactNode
}

/**
 * Linha do tempo do pedido — regista o momento em que pediu,
 * foi confirmado, saiu para entrega e recebeu (gestão de tempo).
 */
export function OrderTimeline({ order, className }: { order: Order; className?: string }) {
  const cancelled = order.status === 'cancelado'

  const steps: Step[] = [
    {
      key: 'requested',
      label: 'Pedido solicitado',
      time: order.requestedAt,
      done: true,
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
    {
      key: 'confirmed',
      label: 'Confirmado pela central',
      time: order.confirmedAt,
      done: !!order.confirmedAt,
      active: order.status === 'pendente',
      icon: <Check className="h-4 w-4" />,
    },
    {
      key: 'dispatched',
      label: 'Motoboy a caminho',
      time: order.dispatchedAt,
      done: !!order.dispatchedAt,
      active: order.status === 'confirmado',
      icon: <Bike className="h-4 w-4" />,
    },
    {
      key: 'delivered',
      label: 'Entregue',
      time: order.deliveredAt,
      done: !!order.deliveredAt,
      active: order.status === 'em_transito',
      icon: <PackageCheck className="h-4 w-4" />,
    },
  ]

  if (cancelled) {
    steps.push({
      key: 'cancelled',
      label: 'Cancelado',
      time: order.cancelledAt,
      done: true,
      icon: <XCircle className="h-4 w-4" />,
    })
  }

  return (
    <div className={cn('space-y-0', className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1
        const isCancel = step.key === 'cancelled'
        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isCancel
                    ? 'border-red-300 bg-red-100 text-red-600'
                    : step.done
                      ? 'border-primary bg-primary text-white'
                      : step.active
                        ? 'border-gold bg-gold/15 text-gold animate-pulse'
                        : 'border-slate-200 bg-slate-50 text-slate-300'
                )}
              >
                {step.icon}
              </span>
              {!isLast && (
                <span
                  className={cn(
                    'w-0.5 flex-1 min-h-6',
                    isCancel
                      ? 'bg-red-200'
                      : step.done
                        ? 'bg-primary/60'
                        : 'bg-slate-200'
                  )}
                />
              )}
            </div>
            <div className={cn('pb-4', isLast && 'pb-0')}>
              <p
                className={cn(
                  'text-sm font-semibold leading-tight',
                  step.done || step.active ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
                {step.active && !step.done && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-gold">
                    a decorrer
                  </span>
                )}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {step.time ? formatTime(step.time) : 'à espera'}
              </p>
            </div>
          </div>
        )
      })}

      {/* resumo de tempos */}
      {order.status === 'entregue' && order.confirmedAt && order.deliveredAt && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-secondary/60 p-3 text-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Processamento
            </p>
            <p className="text-sm font-bold text-navy">
              {durationMinutes(order.requestedAt, order.dispatchedAt ?? order.deliveredAt)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Tempo total
            </p>
            <p className="text-sm font-bold text-navy">
              {durationMinutes(order.requestedAt, order.deliveredAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
