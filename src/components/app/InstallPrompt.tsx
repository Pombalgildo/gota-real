'use client'

/* ============================================================
   INSTALAR A APP (PWA)
   - Android / Chrome: usa o evento nativo `beforeinstallprompt`
     e abre o diálogo oficial do sistema ao tocar em "Instalar"
   - iPhone / iPad (Safari): mostra as instruções
     "Partilhar → Adicionar ao Ecrã Principal"
   - Quando já está instalada (modo standalone), não aparece
   - O aviso pode ser dispensado; volta a aparecer após 7 dias
   ============================================================ */

import { useCallback, useEffect, useState } from 'react'
import { BrandLogo } from '@/components/app/Brand'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  CheckCircle2,
  Download,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'gota-install-dismissed-at'
const DISMISS_DAYS = 7
let swRegistered = false

/** true se o utilizador dispensou o aviso há menos de DISMISS_DAYS dias */
function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (!at) return false
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    // já está a correr como app instalada? (ecrã inteiro / standalone)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) {
      setInstalled(true)
    } else {
      // iPhone / iPad? (o Safari não tem diálogo de instalação automática)
      const ua = window.navigator.userAgent
      const ios =
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      setIsIos(ios)
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault() // impede o mini-banner do Chrome; mostramos o nosso
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  /** abre o diálogo nativo de instalação (Android / Chrome / Edge) */
  const install = useCallback(async () => {
    if (!deferred) return 'indisponivel' as const
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setDeferred(null)
    return choice.outcome
  }, [deferred])

  return { canInstall: deferred !== null, install, installed, isIos }
}

/* ============================================================
   BANNER FIXO — aparece por cima do rodapé
   ============================================================ */
export function InstallPrompt({ placement = 'floating' }: { placement?: 'above-nav' | 'floating' }) {
  const { canInstall, install, installed, isIos } = usePwaInstall()
  const [dismissed, setDismissed] = useState(true) // só decide depois de montar

  useEffect(() => {
    setDismissed(recentlyDismissed())
  }, [])

  // registo do service worker (uma única vez) — acelera a app
  // e é pré-requisito de instalação em versões mais antigas do Chrome
  useEffect(() => {
    if (swRegistered) return
    swRegistered = true
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* silencioso — a app funciona mesmo sem SW */
      })
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* sem localStorage, apenas esconde */
    }
    setDismissed(true)
  }

  if (installed || dismissed) return null
  // Android sem suporte (ex.: Firefox) → não há diálogo possível, não mostrar
  if (!canInstall && !isIos) return null

  return (
    <div
      className={cn(
        'fixed z-50 px-3',
        placement === 'above-nav' ? 'inset-x-0 bottom-20' : 'inset-x-0 bottom-4'
      )}
      role="dialog"
      aria-label="Instalar a aplicação"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-border bg-white/97 p-3 shadow-2xl ring-1 ring-black/5 backdrop-blur-md">
        <BrandLogo size={38} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black leading-tight text-navy">
            Instalar a app Gota REAL
          </p>
          {isIos ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] leading-snug text-muted-foreground">
              <Share className="h-3 w-3 shrink-0 text-primary" />
              toque em <b className="font-bold text-foreground">Partilhar</b>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <PlusSquare className="h-3 w-3 shrink-0 text-primary" />
              <b className="font-bold text-foreground">Adicionar ao Ecrã Principal</b>
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              acesso com 1 toque, como app verdadeira — sem barra de navegador
            </p>
          )}
        </div>
        {canInstall && (
          <button
            onClick={() => void install()}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-black text-white shadow-md transition-all hover:bg-primary/90 active:scale-95"
          >
            <Download className="h-4 w-4" />
            Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Fechar aviso de instalação"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   CARTÃO PERMANENTE — fica no Perfil, disponível sempre
   ============================================================ */
export function InstallAppCard() {
  const { canInstall, install, installed, isIos } = usePwaInstall()
  const [result, setResult] = useState<'accepted' | 'dismissed' | 'indisponivel' | null>(null)

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-1.5 text-sm font-black text-navy">
        <Smartphone className="h-4 w-4 text-primary" /> Instalar a app no telemóvel
      </h3>

      {installed ? (
        <p className="mt-2 flex items-center gap-2 text-xs leading-snug text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Já está a usar a app instalada — perfeito! 💧
        </p>
      ) : isIos ? (
        <div className="mt-2 space-y-1.5 text-xs leading-snug text-foreground">
          <p>No iPhone/iPad (Safari):</p>
          <ol className="space-y-1">
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-[11px] font-black text-primary">1</span>
              toque em <Share className="h-3.5 w-3.5 text-primary" /> <b>Partilhar</b> (quadrado com seta)
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-[11px] font-black text-primary">2</span>
              escolha <PlusSquare className="h-3.5 w-3.5 text-primary" /> <b>Adicionar ao Ecrã Principal</b>
            </li>
          </ol>
        </div>
      ) : canInstall ? (
        <div className="mt-2">
          <p className="text-xs leading-snug text-muted-foreground">
            Instale a Gota REAL no seu ecrã — abre como app, sem barra de navegador.
          </p>
          <button
            onClick={async () => setResult(await install())}
            className="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black text-white shadow-md transition-all hover:bg-primary/90 active:scale-95"
          >
            <Download className="h-4 w-4" />
            {result === 'dismissed' ? 'Tentar novamente' : 'Instalar agora'}
          </button>
          {result === 'accepted' && (
            <p className="mt-1.5 text-[11px] font-bold text-emerald-700">
              Instalada! Procure a Gota REAL no seu ecrã ✅
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-snug text-muted-foreground">
          Abra <b className="text-foreground">gota-real.vercel.app</b> no navegador do telemóvel
          (Chrome, no Android) para instalar a app no ecrã principal.
        </p>
      )}
    </div>
  )
}
