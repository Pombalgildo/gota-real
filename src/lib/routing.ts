// Rotas de condução reais (ruas de verdade) via OSRM — serviço público
// e gratuito, sem chave de API. Serve para:
//   • desenhar no mapa o trajecto verdadeiro do motoboy até ao cliente
//   • dar ao motoboy indicações passo-a-passo em português
// Se o OSRM falhar (rede, servidor em manutenção), devolve null e a app
// continua a funcionar com a linha recta de sempre — nunca bloqueia.

import type { GeoPoint } from '@/lib/geo'

export interface RouteStep {
  /** instrução já traduzida, ex.: “Vire à direita na Rua 21 de Janeiro” */
  instruction: string
  /** distância do trecho em quilómetros */
  distanceKm: number
  /** nome da via (quando existir) */
  name?: string
}

export interface DrivingRoute {
  /** polilinha completa da rota (do ponto actual até ao destino) */
  points: GeoPoint[]
  /** distância total em quilómetros */
  distanceKm: number
  /** duração estimada em minutos (trânsito urbano) */
  durationMin: number
  /** passos com instruções em português */
  steps: RouteStep[]
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Pede ao OSRM a melhor rota de condução entre dois pontos.
 * `signal` permite cancelar (por exemplo quando o motoboy volta a mexer-se).
 */
export async function fetchDrivingRoute(
  from: GeoPoint,
  to: GeoPoint,
  signal?: AbortSignal
): Promise<DrivingRoute | null> {
  try {
    // OSRM espera coordenadas em “longitude,latitude”
    const url =
      `${OSRM_BASE}/${from.lng.toFixed(6)},${from.lat.toFixed(6)};` +
      `${to.lng.toFixed(6)},${to.lat.toFixed(6)}` +
      `?overview=full&geometries=geojson&steps=true&alternatives=false`
    const res = await fetch(url, { signal, cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (data?.code !== 'Ok' || !Array.isArray(data.routes) || data.routes.length === 0) {
      return null
    }
    const r = data.routes[0]
    const points: GeoPoint[] = (r.geometry?.coordinates ?? []).map(
      (c: [number, number]) => ({ lng: c[0], lat: c[1] })
    )
    const steps: RouteStep[] = []
    for (const leg of r.legs ?? []) {
      for (const s of leg.steps ?? []) {
        const instruction = maneuverToPortuguese(s?.maneuver, s?.name)
        if (!instruction) continue
        steps.push({
          instruction,
          distanceKm: (s.distance ?? 0) / 1000,
          name: s.name || undefined,
        })
      }
    }
    return {
      points,
      distanceKm: (r.distance ?? 0) / 1000,
      durationMin: (r.duration ?? 0) / 60,
      steps,
    }
  } catch {
    // rede indisponível, timeout, resposta inválida… — sem rota, sem drama
    return null
  }
}

/** Traduz as manobras do OSRM para português de Angola/Portugal. */
function maneuverToPortuguese(
  m: { type?: string; modifier?: string; exit?: number } | undefined,
  name?: string
): string | null {
  if (!m?.type) return null
  const via = name ? ` na ${name}` : ''
  const para = name ? ` para a ${name}` : ''

  const dir = (mod?: string): string => {
    switch (mod) {
      case 'left':
        return 'à esquerda'
      case 'right':
        return 'à direita'
      case 'slight left':
        return 'ligeiramente à esquerda'
      case 'slight right':
        return 'ligeiramente à direita'
      case 'sharp left':
        return 'bruscamente à esquerda'
      case 'sharp right':
        return 'bruscamente à direita'
      case 'uturn':
        return 'retrocedendo (inversão de marcha)'
      default:
        return 'em frente'
    }
  }

  switch (m.type) {
    case 'depart':
      return 'Comece a viagem' + (name ? ` na ${name}` : '')
    case 'arrive':
      return 'Chegou ao destino 🎉'
    case 'turn':
      if (m.modifier === 'uturn') return 'Faça inversão de marcha' + via
      if (m.modifier === 'straight' || !m.modifier) return 'Continue em frente' + via
      return `Vire ${dir(m.modifier)}${via}`
    case 'new name':
      return 'Continue em frente' + para
    case 'continue':
      return m.modifier === 'uturn' ? 'Faça inversão de marcha' + via : 'Continue' + para
    case 'merge':
      return `Entre ${dir(m.modifier)}${para}`
    case 'on ramp':
      return `Tome o acesso ${dir(m.modifier)}${para}`
    case 'off ramp':
      return `Saia ${dir(m.modifier)}${para}`
    case 'fork':
      return `Mantenha-se ${dir(m.modifier)}${para}`
    case 'end of road':
      return `No fim da rua, vire ${dir(m.modifier)}${via}`
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return m.exit ? `Na rotunda, pegue a ${m.exit}ª saída${via}` : `Na rotunda, use a saída${via}`
    case 'exit roundabout':
    case 'exit rotary':
      return 'Saia da rotunda' + via
    default:
      return name ? `Continue na ${name}` : 'Continue em frente'
  }
}

/** Distância “ao longo da rota” já percorrida — para saber o que falta. */
export function remainingAlongRoute(route: DrivingRoute, from: GeoPoint): number {
  // o cliente pede a rota a partir da posição actual, por isso a distância
  // total da rota É a distância que falta; função mantida para clareza
  void from
  return route.distanceKm
}
