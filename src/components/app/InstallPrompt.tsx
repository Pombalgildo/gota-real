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
const DISMISS_EVENT = 'gota-install-dismissed'
let swRegistered = false

/** evento de instalação adiado, partilhado por todas as instâncias
 *  (assim o banner e o espaçador ficam sempre de acordo) */
let sharedDeferred: BeforeInstallPromptEvent | null = null

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
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(sharedDeferred)
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
      sharedDeferred = e as BeforeInstallPromptEvent
      setDeferred(sharedDeferred)
    }
    const onInstalled = () => {
      sharedDeferred = null
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
    sharedDeferred = null
    setDeferred(null)
    return choice.outcome
  }, [deferred])

  return { canInstall: deferred !== null, install, installed, isIos }
}

/** visibilidade partilhada do aviso de instalação (banner + espaçador) */
export function useInstallVisible() {
  const { canInstall, installed, isIos } = usePwaInstall()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(recentlyDismissed())
    const onDismiss = () => setDismissed(true)
    window.addEventListener(DISMISS_EVENT, onDismiss)
    return () => window.removeEventListener(DISMISS_EVENT, onDismiss)
  }, [])

  return !installed && !dismissed && (canInstall || isIos)
}

/** fecha o aviso de instalação (usado pelo banner e pela faixa das boas-vindas) */
export function dismissInstallPrompt() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* sem localStorage, apenas esconde */
  }
  // avisa todas as instâncias (banner, espaçador, faixa) para encolherem
  window.dispatchEvent(new Event(DISMISS_EVENT))
}

/* ============================================================
   BANNER DE INSTALAÇÃO
   - 'above-nav': fixo por cima do menu inferior (cliente com sessão)
   - 'floating' : fixo no fundo do ecrã (painéis da equipa)
   - 'inline'   : dentro do fluxo da página (boas-vindas) — nunca
                  tapa nada, porque empurra o conteúdo em vez de
                  se sobrepor
   ============================================================ */
export function InstallPrompt({
  placement = 'floating',
}: {
  placement?: 'above-nav' | 'floating' | 'inline'
}) {
  const { canInstall, install, isIos } = usePwaInstall()
  const visible = useInstallVisible()

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
    dismissInstallPrompt()
  }

  if (!visible) return null

  return (
    <div
      className={cn(
        placement === 'inline'
          ? 'w-full'
          : 'fixed z-50 px-3',
        placement === 'above-nav' && 'inset-x-0 bottom-20',
        placement === 'floating' && 'inset-x-0 bottom-4'
      )}
      role="dialog"
      aria-label="Instalar a aplicação"
    >
      <div
        className={cn(
          'mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-border bg-white/97 p-3 shadow-2xl ring-1 ring-black/5 backdrop-blur-md',
          placement === 'inline' && 'my-1'
        )}
      >
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
   ESPAÇADOR — reserva a altura do banner dentro do fluxo da
   página, para que o conteúdo fixo do fundo nunca fique tapado.
   Aparece e desaparece em sincronia com o banner (mesmo aviso
   de fecho) e não ocupa espaço quando o banner não está visível.
   ============================================================ */
export function InstallPromptSpacer({ className = 'h-24' }: { className?: string }) {
  const visible = useInstallVisible()
  if (!visible) return null
  return <div aria-hidden className={className} />
}

/* ============================================================
   FAIXA COMPACTA — vive DENTRO do cartão de boas-vindas
   (fundo azul). Aparece na primeira dobra e, por fazer parte do
   fluxo da página, nunca tapa nem é tapada por nenhum botão,
   em nenhum tamanho de ecrã.
   ============================================================ */
export function InstallStripWelcome() {
  const { canInstall, install, isIos } = usePwaInstall()
  const visible = useInstallVisible()
  if (!visible) return null

  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/12 p-2.5 ring-1 ring-white/20">
      <BrandLogo size={32} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-black leading-tight text-white">
          Instalar a app Gota REAL
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-[#cfe7f8]">
          {isIos ? (
            <>
              <b className="font-bold text-white">Partilhar</b> →{' '}
              <b className="font-bold text-white">Adicionar ao Ecrã Principal</b>
            </>
          ) : (
            '1 toque no ecrã, sem barra de navegador'
          )}
        </p>
      </div>
      {canInstall && (
        <button
          onClick={() => void install()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-gold px-3.5 text-[11px] font-black text-[#3A2A05] shadow-md transition-all hover:brightness-105 active:scale-95"
        >
          <Download className="h-3.5 w-3.5" />
          Instalar
        </button>
      )}
      <button
        onClick={dismissInstallPrompt}
        aria-label="Fechar aviso de instalação"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/15 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
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
