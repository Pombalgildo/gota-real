'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MiniMap } from '@/components/app/MiniMap'
import { getCurrentPosition, LUANDA_CENTER } from '@/lib/geo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, MapPin, LocateFixed, Sparkles, AlertTriangle } from 'lucide-react'

export interface PickedLocation {
  lat: number
  lng: number
  accuracy?: number | null
  source: 'gps' | 'simulado'
  address?: string
}

interface LocationPickerProps {
  value: PickedLocation | null
  onChange: (loc: PickedLocation | null) => void
  /** título/instruções personalizadas */
  hint?: string
  compact?: boolean
}

/**
 * Captura de localização GPS com pré-visualização.
 * Permite: GPS real do dispositivo ou localização simulada (demonstração).
 */
export function LocationPicker({ value, onChange, hint, compact }: LocationPickerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [address, setAddress] = useState(value?.address ?? '')

  async function captureGPS() {
    setError(null)
    setLoading(true)
    try {
      const pos = await getCurrentPosition()
      onChange({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        source: 'gps',
        address,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível obter a localização.')
    } finally {
      setLoading(false)
    }
  }

  function useSimulated() {
    setError(null)
    const jitter = () => (Math.random() - 0.5) * 0.012
    onChange({
      lat: LUANDA_CENTER.lat + jitter(),
      lng: LUANDA_CENTER.lng + jitter(),
      accuracy: 35,
      source: 'simulado',
      address: address || 'Luanda (zona central)',
    })
  }

  return (
    <div className="space-y-3">
      {hint && (
        <div className="flex items-start gap-2.5 rounded-xl border border-gold/40 bg-gold/10 p-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <p className="text-xs leading-relaxed text-[#6B5410]">{hint}</p>
        </div>
      )}

      {/* pré-visualização do mapa */}
      {value ? (
        <div className="relative">
          <MiniMap
            customer={{ lat: value.lat, lng: value.lng }}
            compact={compact}
            className={compact ? 'max-h-44' : undefined}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
              <LocateFixed className="h-3 w-3" />
              {value.source === 'gps' ? 'GPS capturado' : 'Local simulado (demo)'}
            </span>
            {value.accuracy != null && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
                precisão ± {Math.round(value.accuracy)} m
              </span>
            )}
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-mono text-secondary-foreground">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center rounded-2xl border-2 border-dashed border-input bg-secondary/40">
          <div className="text-center text-muted-foreground">
            <MapPin className="mx-auto h-7 w-7 opacity-50" />
            <p className="mt-1.5 text-xs font-medium">Ainda sem localização definida</p>
          </div>
        </div>
      )}

      {/* endereço descritivo */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground" htmlFor="loc-address">
          Ponto de referência / endereço (opcional)
        </label>
        <Input
          id="loc-address"
          placeholder="Ex.: Rua da Missão, casa azul com portão branco, Rangel"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            if (value) onChange({ ...value, address: e.target.value })
          }}
          className="bg-white"
        />
      </div>

      {/* acções — id usado pelo registo para as trazer para a zona
          visível (acima da barra fixa) quando o passo de localização abre */}
      <div id="loc-capture-buttons" className={cn('grid gap-2 scroll-mt-24', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
        <Button
          type="button"
          onClick={captureGPS}
          disabled={loading}
          className="h-11 font-bold"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LocateFixed className="h-4 w-4" />
          )}
          {loading ? 'A obter GPS…' : value ? 'Recapturar GPS' : 'Capturar GPS do dispositivo'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={useSimulated}
          className="h-11 border-dashed font-semibold"
        >
          <Sparkles className="h-4 w-4 text-gold" />
          Usar localização simulada (Luanda)
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div className="text-xs leading-relaxed text-red-700">
            {error}
            <button
              type="button"
              onClick={useSimulated}
              className="ml-1 font-bold underline underline-offset-2"
            >
              Usar localização simulada
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
