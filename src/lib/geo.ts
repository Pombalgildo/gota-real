// Utilitários de geolocalização e distância (GPS)

/** Centro aproximado de Luanda para demonstração */
export const LUANDA_CENTER = { lat: -8.8368, lng: 13.2343 }

/** Base da central Gota REAL (demonstração) */
export const CENTRAL_BASE = { lat: -8.847, lng: 13.241 }

export interface GeoPoint {
  lat: number
  lng: number
}

/** Distância entre dois pontos em quilómetros (fórmula de Haversine) */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Formata a distância para exibição */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`
  }
  return `${Math.round(km)} km`
}

/** Tempo estimado de entrega de mota (km/h médios na cidade) */
export function etaMinutes(km: number): number {
  const speedKmh = 22
  return Math.max(2, Math.round((km / speedKmh) * 60))
}

/** Captura a posição GPS actual do dispositivo */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste dispositivo.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      reject(new Error(describeGeoError(err)))
    }, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000,
    })
  })
}

function describeGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Permissão de localização negada. Active a localização nas definições do navegador ou use a localização simulada.'
    case err.POSITION_UNAVAILABLE:
      return 'Localização indisponível no momento. Tente novamente ou use a localização simulada.'
    case err.TIMEOUT:
      return 'Tempo esgotado ao obter a localização. Tente novamente ou use a localização simulada.'
    default:
      return 'Não foi possível obter a sua localização.'
  }
}

/** Observa a posição GPS continuamente (para o motoboy) */
export function watchPosition(
  onPos: (p: GeolocationPosition) => void,
  onErr: (e: GeolocationPositionError) => void
): number | null {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return navigator.geolocation.watchPosition(onPos, onErr, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000,
  })
}

export function clearWatchSafe(id: number | null) {
  if (id != null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(id)
  }
}

/** Link do Google Maps para navegar até um destino */
export function googleMapsNavUrl(dest: GeoPoint): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`
}

export function googleMapsViewUrl(point: GeoPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`
}
