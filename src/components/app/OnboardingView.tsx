'use client'

import { useEffect, useState } from 'react'
import { BrandLogo, BrandWordmark } from '@/components/app/Brand'
import { LocationPicker, type PickedLocation } from '@/components/app/LocationPicker'
import { LoginDialog } from '@/components/app/LoginDialog'
import { InstallStripWelcome } from '@/components/app/InstallPrompt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/app-store'
import { registerCustomer } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import {
  Droplets,
  KeyRound,
  Loader2,
  LogIn,
  Sparkles,
} from 'lucide-react'

type Step = 'boas-vindas' | 'dados' | 'localizacao'

export function OnboardingView() {
  const { setCustomer } = useAppStore()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>('boas-vindas')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [location, setLocation] = useState<PickedLocation | null>(null)
  const [locationMode, setLocationMode] = useState<'exata' | 'auto'>('exata')
  const [submitting, setSubmitting] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  // Ao entrar no passo de localização, traz os botões de captura de GPS
  // para a zona visível (acima da barra fixa). Sem isto, os botões ficam
  // por baixo da barra e o cliente não consegue concluir o cadastro.
  useEffect(() => {
    if (step !== 'localizacao') return
    const t = setTimeout(() => {
      document
        .getElementById('loc-capture-buttons')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)
    return () => clearTimeout(t)
  }, [step])

  async function handleRegister() {
    if (!name.trim() || !phone.trim()) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha o nome e o número de telefone.',
        variant: 'destructive',
      })
      return
    }
    if (password.trim() && password.trim().length < 4) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 4 caracteres.',
        variant: 'destructive',
      })
      return
    }
    if (!location) {
      toast({
        title: 'Localização obrigatória',
        description: 'Capture a localização onde vai receber as suas entregas.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const { customer } = await registerCustomer({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        password: password.trim() || undefined,
        address: location.address ?? '',
        latitude: location.lat,
        longitude: location.lng,
        locationSource: locationMode === 'exata' ? 'exata' : location.source === 'simulado' ? 'auto' : 'auto',
        locationNote:
          locationMode === 'exata'
            ? 'Local exacto de entrega confirmado no cadastro'
            : 'Localização automática provisória — actualize quando possível',
      })
      setCustomer(customer)
      toast({
        title: `Bem-vindo(a), ${customer.name.split(' ')[0]}! 💧`,
        description: password.trim()
          ? 'A sua conta foi criada. Entre depois com o telefone e a sua senha.'
          : 'A sua conta foi criada. A senha inicial é o seu número de telefone.',
      })
    } catch (err) {
      const isNetwork =
        err instanceof TypeError ||
        /fetch|network|networkerror|failed to/i.test(err instanceof Error ? err.message : '')
      toast({
        title: 'Erro no cadastro',
        description: isNetwork
          ? 'Sem ligação ao servidor. Verifique a internet e toque em “Concluir cadastro” novamente.'
          : err instanceof Error
            ? err.message
            : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-dvh gota-gradient">
      {/* decorações — numa camada própria com clip, para não criarem um
          scroll-container que desactive o "sticky" dos botões de fundo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#37b6f5]/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#d9a62e]/15 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8 pb-10">
        {/* topo com logo (fundo branco, texto centrado por baixo) */}
        <div className="flex flex-col items-center pt-6">
          <BrandLogo size={92} className="ring-4 ring-white/60" />
          <BrandWordmark light size="md" className="mt-5" />
        </div>

        {/* conteúdo por passo */}
        <div className="mt-8 flex-1">
          {step === 'boas-vindas' && (
            <div className="space-y-5">
              <div className="glass-card rounded-2xl p-6 text-white">
                <h1 className="text-[21px] font-black leading-snug sm:text-2xl">
                  Água purificada entregue onde estiver. 👑
                </h1>
                <p className="mt-2.5 text-sm leading-relaxed text-[#cfe7f8]">
                  Peça os seus bidões de 5 litros (ou outros formatos), pague por{' '}
                  <b>TPA</b> ou <b>dinheiro</b> e acompanhe a entrega por GPS em tempo real.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white ring-1 ring-white/20">
                    💧 Purificada
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white ring-1 ring-white/20">
                    🛵 Entrega rápida
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white ring-1 ring-white/20">
                    📍 Luanda
                  </span>
                </div>

                {/* aviso de instalação integrado no cartão: aparece já na
                    primeira dobra, sem se sobrepor a nada em nenhum ecrã */}
                <InstallStripWelcome />
              </div>

              {/* detalhes do serviço ficam no "Quem Somos", no perfil do cliente */}
            </div>
          )}

          {step === 'dados' && (
            <div className="space-y-4 rounded-2xl bg-white p-5 shadow-xl">
              <div>
                <h2 className="text-lg font-black text-navy">Os seus dados</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Usamos o telefone para confirmar as suas entregas.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-name">Nome completo *</Label>
                <Input
                  id="ob-name"
                  placeholder="Ex.: Ana Paula Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-phone">Telefone (WhatsApp) *</Label>
                <Input
                  id="ob-phone"
                  placeholder="Ex.: 923 456 789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-email">E-mail (opcional)</Label>
                <Input
                  id="ob-email"
                  placeholder="Ex.: ana@email.ao"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-password" className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-primary" /> Senha de entrada (opcional)
                </Label>
                <Input
                  id="ob-password"
                  type="password"
                  placeholder="Mínimo 4 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Para entrar depois na app. Se deixar vazio, a senha inicial é o seu telefone.
                </p>
              </div>
            </div>
          )}

          {step === 'localizacao' && (
            <div className="space-y-4 rounded-2xl bg-white p-5 shadow-xl">
              <div>
                <h2 className="text-lg font-black text-navy">Onde vai receber?</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Faça o cadastro <b>no local exacto</b> onde vai passar a receber as entregas —
                  ou guarde a localização automática do momento como provisória.
                </p>
              </div>

              <LocationPicker
                compact
                value={location}
                onChange={setLocation}
                hint="Importante: a posição do GPS é usada pelo motoboy para o encontrar. Quanto mais exacta, mais rápida a entrega."
              />

              {/* modo de confirmação */}
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setLocationMode('exata')}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${
                    locationMode === 'exata'
                      ? 'border-primary bg-secondary/70 shadow-sm'
                      : 'border-border bg-white hover:border-input'
                  }`}
                >
                  <p className="text-sm font-bold text-navy">
                    ✅ É aqui que quero receber (fixar local exacto)
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Recomendado — a localização fica guardada como ponto permanente de entrega.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationMode('auto')}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${
                    locationMode === 'auto'
                      ? 'border-gold bg-gold/10 shadow-sm'
                      : 'border-border bg-white hover:border-input'
                  }`}
                >
                  <p className="text-sm font-bold text-navy">
                    ⏳ Guardar como provisória (local automático)
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    A plataforma usa a localização detectada agora, de forma provisória. Poderá
                    actualizar depois no seu perfil.
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* navegação inferior — barra opaca (fundo azul + blur):
            o conteúdo do formulário passa por BAIXO dela de forma visível.
            Antes era transparente e os botões de localização ficavam
            “tapados” sem o cliente perceber — impossibilitando o cadastro. */}
        <div className="sticky bottom-0 z-20 -mx-5 mt-6 bg-[#072a55]/92 px-5 pb-2 pt-3 shadow-[0_-10px_28px_rgba(7,42,85,0.45)] backdrop-blur-md safe-bottom">
          {step === 'boas-vindas' && (
            <>
              <Button
                onClick={() => setStep('dados')}
                className="btn-gold h-14 w-full rounded-2xl text-base"
              >
                <Sparkles className="h-5 w-5" />
                CRIAR A MINHA CONTA
              </Button>
              <Button
                variant="ghost"
                onClick={() => setLoginOpen(true)}
                className="h-12 w-full rounded-2xl text-sm font-bold text-white/90 hover:bg-white/10 hover:text-white"
              >
                <LogIn className="h-5 w-5" />
                Já tenho conta — Entrar
              </Button>
            </>
          )}

          {step === 'dados' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('boas-vindas')}
                className="h-12 flex-1 rounded-2xl border-white/40 bg-white/90 font-semibold"
              >
                Voltar
              </Button>
              <Button
                onClick={() => setStep('localizacao')}
                disabled={!name.trim() || !phone.trim()}
                className="h-12 flex-[2] rounded-2xl text-base font-bold"
              >
                Continuar para a localização
              </Button>
            </div>
          )}

          {step === 'localizacao' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('dados')}
                className="h-12 flex-1 rounded-2xl border-white/40 bg-white/90 font-semibold"
              >
                Voltar
              </Button>
              <Button
                onClick={handleRegister}
                disabled={submitting || !location}
                className="btn-gold h-12 flex-[2] rounded-2xl text-base"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Droplets className="h-5 w-5" />
                )}
                Concluir cadastro
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* dialog de login — entrada única e discreta para clientes e equipa */}
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  )
}
