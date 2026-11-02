'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { haversineKm, formatDistance, etaMinutes, type GeoPoint } from '@/lib/geo'

interface MiniMapProps {
  customer: GeoPoint | null
  courier?: GeoPoint | null
  /** Base da empresa — ponto de onde sai a mercadoria */
  origin?: GeoPoint | null
  originLabel?: string
  live?: boolean
  courierLabel?: string
  /** rótulo do destino (cliente) — “Você” na app do cliente, nome na app do motoboy */
  customerLabel?: string
  className?: string
  compact?: boolean
}

interface ScreenPoint {
  sx: number
  sy: number
}

/**
 * Mapa GPS estilizado (auto-contido, sem tiles externos) que mostra
 * a base da empresa (origem), o motoboy em tempo real e o cliente
 * (destino), com trajecto e distância/ETA.
 */
export function MiniMap({
  customer,
  courier,
  origin,
  originLabel = 'Gota REAL',
  live = false,
  courierLabel = 'Motoboy',
  customerLabel = 'Você',
  className,
  compact = false,
}: MiniMapProps) {
  const W = 400
  const H = compact ? 210 : 260
  const PAD = 62

  const layout = useMemo(() => {
    if (!customer) return null

    // pontos presentes: cliente (sempre), origem e motoboy (opcionais)
    const pts: Array<{ key: 'customer' | 'origin' | 'courier'; p: GeoPoint }> = [
      { key: 'customer', p: customer },
    ]
    if (origin) pts.push({ key: 'origin', p: origin })
    if (courier) pts.push({ key: 'courier', p: courier })

    // projeção local simples (graus -> km), centrada no cliente
    const kmPerDegLat = 110.574
    const kmPerDegLng = 111.32 * Math.cos((customer.lat * Math.PI) / 180)
    const km = pts.map(({ key, p }) => ({
      key,
      x: (p.lng - customer.lng) * kmPerDegLng,
      y: (p.lat - customer.lat) * kmPerDegLat,
    }))

    // limites e escala para caberem todos os marcadores com folga
    const xs = km.map((k) => k.x)
    const ys = km.map((k) => k.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const spanX = Math.max(maxX - minX, 0.35)
    const spanY = Math.max(maxY - minY, 0.35)
    const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY)
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2

    const project = (x: number, y: number): ScreenPoint => ({
      sx: W / 2 + (x - midX) * scale,
      sy: H / 2 - (y - midY) * scale,
    })

    const find = (key: string) => km.find((k) => k.key === key)
    const customerKm = find('customer')!
    const originKm = find('origin')
    const courierKm = find('courier')

    return {
      customer: project(customerKm.x, customerKm.y),
      origin: originKm ? project(originKm.x, originKm.y) : null,
      courier: courierKm ? project(courierKm.x, courierKm.y) : null,
    }
  }, [customer, courier, origin])

  // distância que interessa ao cliente: motoboy→cliente; sem motoboy,
  // a distância total da rota (empresa→cliente)
  const distanceKm =
    customer && courier
      ? haversineKm(customer, courier)
      : customer && origin
        ? haversineKm(customer, origin)
        : null

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/20 shadow-lg',
        className
      )}
      role="img"
      aria-label={`Mapa de rastreio GPS. ${
        origin ? `A mercadoria sai da base ${originLabel}. ` : ''
      }${distanceKm != null ? `Distância: ${formatDistance(distanceKm)}.` : ''}`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0B2F5E" />
            <stop offset="55%" stopColor="#0A3D7C" />
            <stop offset="100%" stopColor="#0E569E" />
          </linearGradient>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#1E6FC0" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#072a55" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* fundo */}
        <rect width={W} height={H} fill="url(#mapBg)" />
        <rect width={W} height={H} fill="url(#mapGlow)" />

        {/* grelha */}
        <g stroke="#BDE3F5" strokeOpacity="0.09" strokeWidth="1">
          {Array.from({ length: Math.floor(H / 28) }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 28 + 14} x2={W} y2={i * 28 + 14} />
          ))}
          {Array.from({ length: Math.floor(W / 28) }, (_, i) => (
            <line key={`v${i}`} x1={i * 28 + 14} y1="0" x2={i * 28 + 14} y2={H} />
          ))}
        </g>

        {/* "ruas" decorativas */}
        <g stroke="#BDE3F5" strokeOpacity="0.16" strokeWidth="5" strokeLinecap="round">
          <path d={`M0 ${H * 0.28} Q ${W * 0.35} ${H * 0.2}, ${W * 0.68} ${H * 0.34} T ${W} ${H * 0.3}`} fill="none" />
          <path d={`M0 ${H * 0.74} Q ${W * 0.3} ${H * 0.86}, ${W * 0.62} ${H * 0.72} T ${W} ${H * 0.78}`} fill="none" />
          <path d={`M${W * 0.22} 0 Q ${W * 0.3} ${H * 0.5}, ${W * 0.18} ${H}`} fill="none" />
          <path d={`M${W * 0.78} 0 Q ${W * 0.7} ${H * 0.45}, ${W * 0.82} ${H}`} fill="none" />
        </g>
        <g stroke="#D9A62E" strokeOpacity="0.25" strokeWidth="2.4" strokeDasharray="2 10" strokeLinecap="round">
          <path d={`M${W * 0.5} 0 L ${W * 0.52} ${H}`} fill="none" />
        </g>

        {/* bairro/blocos decorativos */}
        <g fill="#BDE3F5" fillOpacity="0.07">
          <rect x="52" y="44" width="46" height="30" rx="6" />
          <rect x="310" y="60" width="52" height="34" rx="6" />
          <rect x="76" y={H - 84} width="54" height="32" rx="6" />
          <rect x="298" y={H - 72} width="44" height="26" rx="6" />
        </g>

        {layout && (
          <>
            {/* trajectos: empresa → motoboy → cliente (ou empresa → cliente) */}
            {layout.origin && layout.courier && (
              <>
                <line
                  x1={layout.origin.sx}
                  y1={layout.origin.sy}
                  x2={layout.courier.sx}
                  y2={layout.courier.sy}
                  stroke="#7EC8E3"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeDasharray="1 9"
                  opacity="0.55"
                />
                <line
                  x1={layout.courier.sx}
                  y1={layout.courier.sy}
                  x2={layout.customer.sx}
                  y2={layout.customer.sy}
                  stroke="#7EC8E3"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="route-dash"
                  opacity="0.9"
                />
              </>
            )}
            {layout.origin && !layout.courier && (
              <line
                x1={layout.origin.sx}
                y1={layout.origin.sy}
                x2={layout.customer.sx}
                y2={layout.customer.sy}
                stroke="#7EC8E3"
                strokeWidth="3"
                strokeLinecap="round"
                className="route-dash"
                opacity="0.9"
              />
            )}
            {!layout.origin && layout.courier && (
              <line
                x1={layout.customer.sx}
                y1={layout.customer.sy}
                x2={layout.courier.sx}
                y2={layout.courier.sy}
                stroke="#7EC8E3"
                strokeWidth="3"
                strokeLinecap="round"
                className="route-dash"
                opacity="0.9"
              />
            )}

            {/* marcador da base da empresa (origem da mercadoria) */}
            {layout.origin && (
              <g
                style={{
                  transform: `translate(${layout.origin.sx}px, ${layout.origin.sy}px)`,
                  transition: 'transform 0.8s ease',
                }}
              >
                <circle r="22" fill="#0E569E" opacity="0.25" />
                <circle r="14" fill="#FFFFFF" stroke="#0A3D7C" strokeWidth="3" />
                {/* ícone garrafa/coroa da empresa */}
                <g transform="translate(-7,-8) scale(0.58)">
                  <path
                    d="M2 22 L4 6 L8 11 L12 3 L16 11 L20 6 L22 22 Z"
                    fill="#0A3D7C"
                    stroke="#0A3D7C"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <rect x="2" y="22" width="20" height="3.4" rx="1.4" fill="#D9A62E" />
                </g>
                <text
                  y="-24"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#FFFFFF"
                  style={{ paintOrder: 'stroke', stroke: '#072a55', strokeWidth: 3 }}
                >
                  {originLabel}
                </text>
              </g>
            )}

            {/* marcador do motoboy */}
            {layout.courier && (
              <g
                style={{
                  transform: `translate(${layout.courier.sx}px, ${layout.courier.sy}px)`,
                  transition: 'transform 1.2s linear',
                }}
              >
                {live && (
                  <>
                    <circle r="26" fill="#22C55E" opacity="0.22" className="animate-gps-ping" />
                    <circle r="16" fill="#22C55E" opacity="0.3" />
                  </>
                )}
                <circle r="14" fill="#FFFFFF" stroke="#D9A62E" strokeWidth="3" />
                {/* ícone mota */}
                <g transform="translate(-8,-7.5) scale(0.66)">
                  <circle cx="7" cy="20" r="6" fill="#0A3D7C" />
                  <circle cx="25" cy="20" r="6" fill="#0A3D7C" />
                  <path d="M7 20h8l4-9h6l3 9h-6" stroke="#0A3D7C" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                  <rect x="14" y="8" width="7" height="5" rx="2" fill="#D9A62E" />
                </g>
                <text
                  y="-24"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#FFFFFF"
                  style={{ paintOrder: 'stroke', stroke: '#072a55', strokeWidth: 3 }}
                >
                  {courierLabel}
                </text>
              </g>
            )}

            {/* marcador do cliente */}
            <g
              style={{
                transform: `translate(${layout.customer.sx}px, ${layout.customer.sy}px)`,
                transition: 'transform 0.8s ease',
              }}
            >
              <circle r="20" fill="#D9A62E" opacity="0.18" />
              {/* pino casa */}
              <path
                d="M0 6 C -12 -4 -10 -18 0 -18 C 10 -18 12 -4 0 6 Z"
                fill="#D9A62E"
                stroke="#B8871F"
                strokeWidth="2"
              />
              <g transform="translate(-6,-14) scale(0.5)">
                <path d="M2 12 L12 3 L22 12 M5 10v10h14V10" stroke="#3A2A05" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <text
                y="26"
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#FFFFFF"
                style={{ paintOrder: 'stroke', stroke: '#072a55', strokeWidth: 3 }}
              >
                {customerLabel}
              </text>
            </g>
          </>
        )}

        {/* rosa dos ventos */}
        <g transform={`translate(${W - 34}, 30)`}>
          <circle r="14" fill="#072a55" opacity="0.65" />
          <path d="M0 -9 L3.4 3 L0 1 L-3.4 3 Z" fill="#D9A62E" />
          <text y="10.5" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#FFFFFF">N</text>
        </g>
      </svg>

      {/* chip de distância / ETA */}
      {distanceKm != null && (
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-navy shadow-md">
            📍 {formatDistance(distanceKm)}
          </span>
          <span className="rounded-full bg-gold/95 px-3 py-1.5 text-xs font-bold text-[#3A2A05] shadow-md">
            ⏱ cerca de {etaMinutes(distanceKm)} min
          </span>
        </div>
      )}

      {/* estado ao vivo */}
      {live && (
        <div className="absolute top-3 right-16 flex items-center gap-1.5 rounded-full bg-[#072a55]/85 px-2.5 py-1 shadow-md ring-1 ring-white/25">
          <span className="live-dot" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white">ao vivo</span>
        </div>
      )}
    </div>
  )
}
