'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { resizeImageToDataUrl } from '@/lib/image'
import { useToast } from '@/hooks/use-toast'
import { Camera, Loader2, Trash2 } from 'lucide-react'

/**
 * AVATAR DE PERFIL — mostra a FOTO REAL (data URL base64) do
 * administrador, motoboy ou cliente, sempre AUTOENQUADRADA
 * (object-cover centrada, nunca sai do círculo/quadrado).
 * Sem foto: mostra a inicial do nome ou um ícone da função.
 */
export function Avatar({
  photo,
  name,
  className,
  icon,
  alt,
}: {
  photo?: string | null
  name: string
  className?: string
  icon?: React.ReactNode
  alt?: string
}) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl gota-gradient text-white shadow-md',
        className
      )}
      aria-hidden={false}
    >
      {photo ? (
        <img
          src={photo}
          alt={alt ?? `Foto de ${name}`}
          className="h-full w-full object-cover object-center"
        />
      ) : icon ? (
        icon
      ) : (
        <span className="text-lg font-black leading-none">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}

/**
 * SELECIONADOR DE FOTO DE PERFIL — usado ao criar/editar perfis
 * (administrador, motoboy, cliente). Abre a câmara ou a galeria do
 * telemóvel/PC, comprime no próprio dispositivo e devolve um data URL.
 */
export function PhotoPicker({
  value,
  onChange,
  label = 'Foto de perfil',
  hint = 'Opcional — toque na câmara para escolher ou tirar uma foto.',
  name = '',
}: {
  value: string | null
  onChange: (photo: string | null) => void
  label?: string
  hint?: string
  name?: string
}) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await resizeImageToDataUrl(file, 480, 0.85)
      onChange(dataUrl)
    } catch (err) {
      toast({
        title: 'Foto não aceite',
        description: err instanceof Error ? err.message : 'Escolha outra imagem.',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-navy">{label}</p>
      <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-input bg-white p-3">
        <Avatar
          photo={value}
          name={name || '?'}
          className="h-16 w-16 rounded-2xl text-xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-black text-white shadow-md transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {value ? 'TROCAR FOTO' : 'ADICIONAR FOTO'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 text-xs font-black text-red-600 transition-all hover:bg-red-100 active:scale-95"
              >
                <Trash2 className="h-4 w-4" /> REMOVER
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{hint}</p>
        </div>
      </div>
      {/* input invisível: abre câmara no telemóvel (capture) ou galeria no PC */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
