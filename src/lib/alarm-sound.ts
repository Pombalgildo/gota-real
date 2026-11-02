'use client'

/**
 * Motor de alertas sonoros fortes da Gota REAL.
 *
 * - Sons 100% sintetizados com a Web Audio API (nenhum ficheiro para
 *   descarregar — funciona offline e no APK)
 * - Cada tipo de aviso tem um padrão reconhecível ao longe:
 *     order    → bip-bip-BIP agudo (pedido novo na central/vendas)
 *     assign   → sirene crescente (entrega atribuída ao motoboy)
 *     message  → ding-dong (mensagem do cliente / resposta recebida)
 *     status   → dois tons (estado do pedido mudou para o cliente)
 *     cancel   → tom descendente (entrega/pedido cancelado)
 *     receipt  → sino insistente (cliente tem de confirmar a recepção)
 *     dispute  → alarme grave urgente (cliente diz que NÃO recebeu!)
 * - O som toca em LOOP e só pára com stopAlarm() — ou seja, quando o
 *   utilizador VÊ o aviso ou interage com ele (requisito do cliente)
 * - Vibração contínua no Android (navigator.vibrate)
 * - Os navegadores bloqueiam áudio sem interacção prévia: o contexto
 *   é desbloqueado no primeiro toque/clique em qualquer lado da app
 */

export type AlarmKind = 'order' | 'assign' | 'message' | 'status' | 'cancel' | 'receipt' | 'dispute'

interface Note {
  /** frequência em Hz */
  f: number
  /** duração em segundos */
  d: number
  /** atraso desde o início do ciclo, em segundos */
  at?: number
  /** varredura até esta frequência (sirene) */
  sweepTo?: number
  /** tipo de onda (square = mais estridente) */
  wave?: OscillatorType
  /** volume desta nota (0–1) */
  g?: number
}

interface Pattern {
  /** duração do ciclo completo (ms) — repete até parar */
  period: number
  notes: Note[]
  /** vibração do ciclo (ms ligado/ms desligado…) */
  vibrate?: number[]
}

const PATTERNS: Record<AlarmKind, Pattern> = {
  // pedido novo: três bips agudos, urgentes
  order: {
    period: 1400,
    notes: [
      { f: 880, d: 0.14, g: 1 },
      { f: 880, d: 0.14, at: 0.2, g: 1 },
      { f: 1318, d: 0.22, at: 0.4, g: 1 },
    ],
    vibrate: [250, 120, 250, 120, 400],
  },
  // entrega atribuída: sirene que sobe — impossível ignorar
  assign: {
    period: 1600,
    notes: [
      { f: 440, sweepTo: 1046, d: 0.55, wave: 'sawtooth', g: 0.95 },
      { f: 1046, sweepTo: 440, d: 0.55, at: 0.6, wave: 'sawtooth', g: 0.95 },
    ],
    vibrate: [500, 150, 500],
  },
  // mensagem: ding-dong
  message: {
    period: 1900,
    notes: [
      { f: 987, d: 0.28, g: 0.95 },
      { f: 740, d: 0.38, at: 0.34, g: 0.95 },
    ],
    vibrate: [180, 100, 300],
  },
  // estado do pedido (cliente): dois tons claros
  status: {
    period: 2100,
    notes: [
      { f: 659, d: 0.2, g: 0.9 },
      { f: 880, d: 0.3, at: 0.26, g: 0.9 },
    ],
    vibrate: [200, 120, 200],
  },
  // cancelado: tom a descer
  cancel: {
    period: 1500,
    notes: [
      { f: 554, d: 0.22, wave: 'square', g: 0.9 },
      { f: 415, d: 0.34, at: 0.28, wave: 'square', g: 0.9 },
    ],
    vibrate: [300, 150, 300],
  },
  // confirmação de recepção: sino insistente (anti-burla — o cliente
  // tem de responder RECEBI ou NÃO RECEBI; toca até responder)
  receipt: {
    period: 1700,
    notes: [
      { f: 1174, d: 0.16, wave: 'triangle', g: 1 },
      { f: 1568, d: 0.16, at: 0.22, wave: 'triangle', g: 1 },
      { f: 1174, d: 0.16, at: 0.44, wave: 'triangle', g: 1 },
      { f: 1568, d: 0.22, at: 0.66, wave: 'triangle', g: 1 },
    ],
    vibrate: [200, 100, 200, 100, 350],
  },
  // RECLAMAÇÃO de não recepção: alarme grave e urgente na central —
  // a administração precisa de agir (possível burla na entrega)
  dispute: {
    period: 1300,
    notes: [
      { f: 220, sweepTo: 660, d: 0.42, wave: 'sawtooth', g: 1 },
      { f: 660, sweepTo: 220, d: 0.42, at: 0.48, wave: 'sawtooth', g: 1 },
    ],
    vibrate: [600, 120, 600],
  },
}

// prioridade quando há vários alarmes: a reclamação de não recepção
// (possível burla) manda sobre tudo; depois a sirene do motoboy e o
// pedido novo; a confirmação de recepção do cliente também é urgente
const PRIORITY: Record<AlarmKind, number> = {
  dispute: 6,
  assign: 5,
  order: 4,
  receipt: 3,
  cancel: 3,
  message: 2,
  status: 1,
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let unlocked = false
let loopTimer: ReturnType<typeof setInterval> | null = null
let vibrateTimer: ReturnType<typeof setInterval> | null = null
let currentKind: AlarmKind | null = null
let enabled = true

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 1
      master.connect(ctx.destination)
    }
    return ctx
  } catch {
    return null
  }
}

/** Desbloqueia o áudio — chamado no primeiro toque/clique da app. */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return
  const c = ensureCtx()
  if (!c) return
  if (c.state === 'suspended') {
    c.resume().catch(() => undefined)
  }
  // num contexto novo e activo com um gesto do utilizador, o som passa
  // a ser permitido; tocar uma nota muda (silenciosa) confirma o unlock
  if (!unlocked && c.state === 'running') {
    unlocked = true
  }
}

/** O áudio já pode tocar sem bloqueio do navegador? */
export function isAudioUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  if (unlocked && ctx && ctx.state === 'running') return true
  return Boolean(ctx && ctx.state === 'running')
}

function playNote(note: Note, when: number): void {
  const c = ctx
  if (!c || !master) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = note.wave ?? 'square'
  const start = when + (note.at ?? 0)
  const end = start + note.d
  osc.frequency.setValueAtTime(note.f, start)
  if (note.sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, note.sweepTo), end)
  }
  // envelope: ataque rápido + corte suave — forte sem estalar
  const vol = (note.g ?? 1) * 0.42
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(vol * 0.65, start + note.d * 0.6)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(gain)
  gain.connect(master)
  osc.start(start)
  osc.stop(end + 0.05)
}

function playCycle(kind: AlarmKind): void {
  const c = ensureCtx()
  if (!c || !enabled) return
  if (c.state === 'suspended') {
    c.resume().catch(() => undefined)
  }
  const pattern = PATTERNS[kind]
  const now = c.currentTime + 0.03
  for (const note of pattern.notes) {
    playNote(note, now)
  }
}

function vibrateCycle(kind: AlarmKind): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  try {
    navigator.vibrate(PATTERNS[kind].vibrate ?? [300, 200, 300])
  } catch {
    // alguns navegadores lançam se não houver gesto — ignora
  }
}

/**
 * Começa o alarme em LOOP. Se já estiver a tocar um som de prioridade
 * igual ou maior, mantém; se o novo for mais urgente, troca.
 * Com `force` (o aviso de maior prioridade mudou) troca sempre.
 */
export function startAlarm(kind: AlarmKind, force = false): void {
  if (!enabled) return
  if (currentKind === kind) return
  if (!force && currentKind && PRIORITY[currentKind] >= PRIORITY[kind]) return
  stopAlarm()
  currentKind = kind
  playCycle(kind)
  vibrateCycle(kind)
  loopTimer = setInterval(() => {
    if (!currentKind) return
    playCycle(currentKind)
  }, PATTERNS[kind].period)
  vibrateTimer = setInterval(() => {
    if (!currentKind) return
    vibrateCycle(currentKind)
  }, PATTERNS[kind].period)
}

/** Pára o alarme e a vibração (chamado quando o aviso é visualizado). */
export function stopAlarm(): void {
  if (loopTimer) {
    clearInterval(loopTimer)
    loopTimer = null
  }
  if (vibrateTimer) {
    clearInterval(vibrateTimer)
    vibrateTimer = null
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(0)
    } catch {
      // ignora
    }
  }
  currentKind = null
}

/** Está algum alarme a tocar? */
export function isAlarmPlaying(): boolean {
  return currentKind !== null
}

/** Liga/desliga os sons (o utilizador controla nas definições). */
export function setAlarmEnabled(value: boolean): void {
  enabled = value
  if (!value) stopAlarm()
}

export function isAlarmEnabled(): boolean {
  return enabled
}

/** Toca um ciclo único do padrão — para o botão “testar som”. */
export function playTestSound(kind: AlarmKind = 'order'): void {
  ensureCtx()
  playCycle(kind)
  vibrateCycle(kind)
}

/** Registo global do desbloqueio de áudio no primeiro gesto do utilizador. */
export function installAudioUnlock(): void {
  if (typeof window === 'undefined') return
  const handler = () => {
    unlockAudio()
  }
  window.addEventListener('pointerdown', handler, { passive: true })
  window.addEventListener('touchstart', handler, { passive: true })
  window.addEventListener('keydown', handler)
  // também ao ficar visível de novo (voltar à app em segundo plano)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockAudio()
  })
}

/** Prioridade do alarme (para escolher qual toca quando há vários). */
export function alarmPriority(kind: AlarmKind): number {
  return PRIORITY[kind]
}
