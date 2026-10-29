'use client'

import { cn } from '@/lib/utils'

/** Logo oficial (versão quadrada, fundo escuro) */
export function BrandLogo({
  size = 44,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <img
      src="/gota-real-logo-square.png"
      alt="Logo Gota REAL"
      width={size}
      height={size}
      className={cn('rounded-xl object-cover ring-2 ring-white/40 shadow-lg', className)}
      style={{ width: size, height: size }}
    />
  )
}

/** Símbolo SVG: gota de água com coroa dourada (mini identidade) */
export function DropCrownIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* coroa */}
      <path
        d="M16 8l3.5 4L24 6l4.5 6L32 8l1.5 8h-19L16 8z"
        fill="#D9A62E"
        stroke="#B8871F"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="12.5" r="1.6" fill="#0E63B8" />
      {/* gota */}
      <path
        d="M24 15c7 7.5 11 12.4 11 17.4C35 38.9 30.2 43 24 43s-11-4.1-11-10.6C13 27.4 17 22.5 24 15z"
        fill="url(#dropGrad)"
        stroke="#0A3D7C"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <ellipse cx="20" cy="32" rx="3" ry="4.6" fill="#FFFFFF" opacity="0.55" transform="rotate(-18 20 32)" />
      <defs>
        <linearGradient id="dropGrad" x1="24" y1="15" x2="24" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5BC2F5" />
          <stop offset="1" stopColor="#0E63B8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Wordmark tipográfico: Gota (cursiva) + REAL + subtítulo */
export function BrandWordmark({
  className,
  light = false,
  size = 'md',
}: {
  className?: string
  light?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: { script: 'text-2xl', real: 'text-sm tracking-[0.3em]', sub: 'text-[8px]' },
    md: { script: 'text-4xl', real: 'text-lg tracking-[0.32em]', sub: 'text-[9px]' },
    lg: { script: 'text-6xl', real: 'text-3xl tracking-[0.35em]', sub: 'text-xs' },
  }[size]

  return (
    <div className={cn('flex flex-col items-center leading-none select-none', className)}>
      <span
        className={cn('font-script', sizes.script, light ? 'text-[#8FD4F8]' : 'text-primary')}
      >
        Gota
      </span>
      <span
        className={cn(
          'font-black uppercase',
          sizes.real,
          light ? 'text-white' : 'text-navy'
        )}
        style={{ textShadow: light ? '0 2px 8px rgba(0,0,0,0.35)' : undefined }}
      >
        REAL
      </span>
      <span
        className={cn(
          'uppercase tracking-[0.42em] font-semibold mt-1',
          sizes.sub,
          light ? 'text-[#BDE3F5]' : 'text-gold'
        )}
      >
        Água Purificada
      </span>
    </div>
  )
}
