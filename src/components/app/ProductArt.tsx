'use client'

import { cn } from '@/lib/utils'

/**
 * Ilustrações SVG dos produtos, desenhadas com a identidade Gota REAL
 * (azuis do logo + detalhes dourados da coroa).
 */

function CrownTiny({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(0.42)`}>
      <path
        d="M2 10l4 4 6-8 6 8 4-4 1 10H1l1-10z"
        fill="#D9A62E"
        stroke="#B8871F"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="1.8" fill="#0E63B8" />
    </g>
  )
}

/** Bidão 5L (produto principal) */
function BidonArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="bidonB" x1="60" y1="28" x2="60" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6FC8F2" />
          <stop offset="1" stopColor="#0E63B8" />
        </linearGradient>
      </defs>
      {/* asa */}
      <path d="M76 40c10 2 14 10 12 18" stroke="#0A3D7C" strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* corpo */}
      <rect x="30" y="34" width="52" height="72" rx="14" fill="url(#bidonB)" stroke="#0A3D7C" strokeWidth="2.5" />
      {/* tampa */}
      <rect x="42" y="22" width="28" height="14" rx="5" fill="#0A3D7C" />
      <rect x="46" y="16" width="20" height="8" rx="3.5" fill="#D9A62E" stroke="#B8871F" strokeWidth="1.4" />
      {/* brilho */}
      <rect x="38" y="44" width="9" height="52" rx="4.5" fill="#fff" opacity="0.45" />
      {/* rótulo */}
      <rect x="40" y="62" width="32" height="22" rx="5" fill="#fff" opacity="0.92" />
      <CrownTiny x={46} y={63} />
      <text x="74" y="78" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="900" fill="#0A3D7C">5L</text>
      <path d="M50 84q3-3 5 0t5 0t5 0" stroke="#0E63B8" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Garrafão 10L / 20L */
function GarrafaoArt({ className, big }: { className?: string; big?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`garB${big ? '2' : '1'}`} x1="60" y1="20" x2="60" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7ECDF4" />
          <stop offset="1" stopColor="#0B4FA0" />
        </linearGradient>
      </defs>
      {/* pescoço */}
      <rect x="48" y="14" width="24" height="16" rx="5" fill="#0A3D7C" />
      <rect x="52" y="9" width="16" height="7" rx="3" fill="#D9A62E" stroke="#B8871F" strokeWidth="1.2" />
      {/* corpo largo */}
      <path
        d="M48 30h24c14 6 20 16 20 34v26c0 10-8 18-18 18H46c-10 0-18-8-18-18V64c0-18 6-28 20-34z"
        fill={`url(#garB${big ? '2' : '1'})`}
        stroke="#0A3D7C"
        strokeWidth="2.5"
      />
      {/* água interna */}
      <path d="M34 62h52v26c0 8-6 14-14 14H48c-8 0-14-6-14-14V62z" fill="#5BB6EA" opacity="0.8" />
      <rect x="40" y="42" width="10" height="52" rx="5" fill="#fff" opacity="0.4" />
      {/* rótulo */}
      <rect x="40" y="66" width="40" height="20" rx="5" fill="#fff" opacity="0.95" />
      <CrownTiny x={47} y={67} />
      <text x="76" y="81" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="900" fill="#0A3D7C">
        {big ? '20L' : '10L'}
      </text>
    </svg>
  )
}

/** Garrafa 1.5L / 500ml */
function GarrafaArt({ className, small }: { className?: string; small?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`garrB${small ? '2' : '1'}`} x1="60" y1="10" x2="60" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8FD8F7" />
          <stop offset="1" stopColor="#0E63B8" />
        </linearGradient>
      </defs>
      {/* tampa */}
      <rect x="50" y="8" width="20" height="10" rx="3.5" fill="#D9A62E" stroke="#B8871F" strokeWidth="1.2" />
      {/* pescoço + corpo */}
      <path
        d="M52 18h16v10c8 4 14 12 14 24v38c0 10-8 18-18 18H56c-10 0-18-8-18-18V52c0-12 6-20 14-24V18z"
        fill={`url(#garrB${small ? '2' : '1'})`}
        stroke="#0A3D7C"
        strokeWidth="2.4"
      />
      <rect x="46" y="52" width="8" height="40" rx="4" fill="#fff" opacity="0.45" />
      {/* rótulo */}
      <rect x="44" y="62" width="32" height="20" rx="4.5" fill="#fff" opacity="0.95" />
      <CrownTiny x={49} y={63} />
      <text x="72" y="77" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="900" fill="#0A3D7C">
        {small ? '0,5L' : '1,5L'}
      </text>
    </svg>
  )
}

/** Pack 6 garrafas */
function PackArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="packB" x1="60" y1="30" x2="60" y2="106" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6FC8F2" />
          <stop offset="1" stopColor="#0B4FA0" />
        </linearGradient>
      </defs>
      {/* embalagem */}
      <path d="M28 44h64v58c0 6-5 10-10 10H38c-5 0-10-4-10-10V44z" fill="url(#packB)" stroke="#0A3D7C" strokeWidth="2.5" />
      <path d="M28 44l8-12h48l8 12" fill="#0A3D7C" stroke="#0A3D7C" strokeWidth="2" />
      {/* garrafas visíveis */}
      {[38, 54, 70, 86].map((x, i) => (
        <g key={i}>
          <rect x={x - 5} y="34" width="10" height="6" rx="2" fill="#D9A62E" />
          <rect x={x - 7} y="40" width="14" height="40" rx="6" fill="#8FD8F7" stroke="#0A3D7C" strokeWidth="1.6" />
        </g>
      ))}
      {/* rótulo da embalagem */}
      <rect x="40" y="72" width="40" height="22" rx="5" fill="#fff" opacity="0.95" />
      <CrownTiny x={47} y={74} />
      <text x="76" y="88" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="900" fill="#0A3D7C">6x1,5L</text>
    </svg>
  )
}

/** Acessórios genéricos */
function AcessorioArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="accB" x1="60" y1="20" x2="60" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F3D27A" />
          <stop offset="1" stopColor="#C9962B" />
        </linearGradient>
      </defs>
      {/* garrafão estilizado com bomba */}
      <path d="M44 34h32c9 5 12 12 12 24v26c0 8-6 14-14 14H46c-8 0-14-6-14-14V58c0-12 3-19 12-24z" fill="#BDE3F5" stroke="#0A3D7C" strokeWidth="2.4" />
      <path d="M36 66h48v16c0 8-6 14-14 14H50c-8 0-14-6-14-14V66z" fill="#5BB6EA" opacity="0.85" />
      {/* bomba */}
      <rect x="56" y="10" width="8" height="34" rx="3" fill="url(#accB)" stroke="#B8871F" strokeWidth="1.6" />
      <path d="M64 16h14v6H64z" fill="#D9A62E" stroke="#B8871F" strokeWidth="1.4" />
      <path d="M52 30h8v6h-8z" fill="#0A3D7C" />
      <CrownTiny x={40} y={40} />
    </svg>
  )
}

export function ProductArt({
  kind,
  volumeL,
  className,
}: {
  kind: string
  volumeL?: number
  className?: string
}) {
  const cls = cn('w-full h-full', className)
  switch (kind) {
    case 'bidon':
      return <BidonArt className={cls} />
    case 'garrafao':
      return <GarrafaoArt className={cls} big={(volumeL ?? 0) >= 20} />
    case 'garrafa':
      return <GarrafaArt className={cls} small={(volumeL ?? 0) <= 0.6} />
    case 'pack':
      return <PackArt className={cls} />
    default:
      return <AcessorioArt className={cls} />
  }
}
