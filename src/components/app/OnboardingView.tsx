'use client'

import { useState } from 'react'
import { BrandLogo, BrandWordmark, DropCrownIcon } from '@/components/app/Brand'
import { LocationPicker, type PickedLocation } from '@/components/app/LocationPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/app-store'
import { registerCustomer, loginCustomer } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Bike,
  CreditCard,
  Droplets,
  Loader2,
  LogIn,
  MapPin,
  ShieldCheck,
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
  const [location, setLocation] = useState<PickedLocation | null>(null)
  const [locationMode, setLocationMode] = useState<'exata' | 'auto'>('exata')
  const [submitting, setSubmitting] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginPhone, setLoginPhone] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  async function handleRegister() {
    if (!name.trim() || !phone.trim()) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha o nome e o número de telefone.',
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
        description: 'A sua conta Gota REAL foi criada com sucesso.',
      })
    } catch (err) {
      toast({
        title: 'Erro no cadastro',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogin() {
    if (!loginPhone.trim()) return
    setLoginLoading(true)
    try {
      const { customer } = await loginCustomer(loginPhone.trim())
      setCustomer(customer)
      setLoginOpen(false)
      toast({
        title: `Olá de novo, ${customer.name.split(' ')[0]}! 💧`,
        description: 'A sua conta foi carregada.',
      })
    } catch {
      toast({
        title: 'Conta não encontrada',
        description: 'Verifique o número ou crie uma nova conta.',
        variant: 'destructive',
      })
    } finally {
      setLoginLoading(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden gota-gradient">
      {/* decorações */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#37b6f5]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#d9a62e]/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-8 opacity-30 animate-gota-float">
        <DropCrownIcon size={54} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
        {/* topo com logo */}
        <div className="flex flex-col items-center pt-6">
          <BrandLogo size={92} className="ring-4 ring-white/50" />
          <BrandWordmark light size="md" className="mt-5" />
        </div>

        {/* conteúdo por passo */}
        <div className="mt-8 flex-1">
          {step === 'boas-vindas' && (
            <div className="space-y-5">
              <div className="glass-card rounded-2xl p-5 text-white">
                <h1 className="text-xl font-black leading-snug">
                  Água purificada entregue onde estiver. 👑
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#cfe7f8]">
                  Peça os seus bidões de 5 litros (ou outros formatos), pague por{' '}
                  <b>TPA</b> ou <b>dinheiro</b> e acompanhe o motoboy por GPS em tempo real.
                </p>
              </div>

              <ul className="space-y-2.5">
                {[
                  { icon: Droplets, text: 'Bidões de 5L, garrafões e garrafas — do pack familiar ao grande consumo' },
                  { icon: CreditCard, text: 'Pague com TPA (cartão) ou dinheiro na entrega' },
                  { icon: MapPin, text: 'Cadastre-se no local exacto de entrega — nunca mais perca o motoboy' },
                  { icon: Bike, text: 'Acompanhe a entrega em tempo real, do pedido à porta de casa' },
                  { icon: ShieldCheck, text: 'Registo de horas: saiba quando pediu e quando recebeu' },
                ].map(({ icon: Icon, text }, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl bg-white/95 p-3 shadow-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-[13px] leading-snug text-foreground">{text}</p>
                  </li>
                ))}
              </ul>
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

        {/* navegação inferior */}
        <div className="sticky bottom-0 mt-6 space-y-3 pb-2">
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
                Já tenho conta (entrar com telefone)
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

      {/* dialog de login */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-navy">Entrar na minha conta</DialogTitle>
            <DialogDescription>
              Introduza o número de telefone usado no cadastro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="login-phone">Telefone</Label>
            <Input
              id="login-phone"
              placeholder="Ex.: 923 456 789"
              value={loginPhone}
              onChange={(e) => setLoginPhone(e.target.value)}
              inputMode="tel"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleLogin}
              disabled={loginLoading || !loginPhone.trim()}
              className="w-full font-bold"
            >
              {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Entrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
