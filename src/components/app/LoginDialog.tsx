'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { apiLogin, apiLogout } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  KeyRound,
  Loader2,
  LogIn,
  ShieldCheck,
  User,
  Warehouse,
} from 'lucide-react'

// contas de demonstração — um toque preenche os dados para testar
const DEMO_ACCOUNTS = [
  {
    role: 'ADMINISTRADOR',
    icon: Warehouse,
    identifier: 'admin@gotareal.ao',
    password: 'admin123',
    hint: 'recebe pedidos, cria perfis, gere a loja',
  },
  {
    role: 'MOTOBOY',
    icon: Bike,
    identifier: 'motoboy@gotareal.ao',
    password: 'motoboy123',
    hint: 'recebe entregas com GPS e dados do cliente',
  },
  {
    role: 'CLIENTE',
    icon: User,
    identifier: 'cliente@gotareal.ao',
    password: 'cliente123',
    hint: 'pede água, paga por TPA ou cash, rastreia',
  },
] as const

export function LoginDialog({
  open,
  onOpenChange,
  prefillIdentifier,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  prefillIdentifier?: string
}) {
  const { setAuth, setCustomer, setMode, setCourierId } = useAppStore()
  const { toast } = useToast()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setIdentifier(prefillIdentifier ?? '')
      setPassword('')
    }
  }, [open, prefillIdentifier])

  async function handleLogin() {
    if (!identifier.trim() || !password) return
    setLoading(true)
    try {
      const res = await apiLogin(identifier.trim(), password)
      setAuth({ token: res.token, user: res.user })

      // encaminha conforme o perfil que entrou
      if (res.user.role === 'ADMIN') {
        setMode('central')
      } else if (res.user.role === 'MOTOBOY') {
        setMode('motoboy')
        if (res.courier) setCourierId(res.courier.id)
      } else {
        setMode('cliente')
        if (res.customer) setCustomer(res.customer)
      }

      onOpenChange(false)
      toast({
        title: `Olá, ${res.user.name.split(' ')[0]}! 👑`,
        description:
          res.user.role === 'ADMIN'
            ? 'Painel do administrador aberto.'
            : res.user.role === 'MOTOBOY'
              ? 'Painel do motoboy aberto — aguarde as entregas.'
              : 'Bem-vindo(a) de volta à loja Gota REAL.',
      })
    } catch (err) {
      toast({
        title: 'Não foi possível entrar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-navy">
            <KeyRound className="h-5 w-5 text-primary" /> Entrar com o meu perfil
          </DialogTitle>
          <DialogDescription>
            Administrador, motoboy ou cliente — cada um abre o seu próprio painel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="login-identifier">E-mail ou telefone</Label>
            <Input
              id="login-identifier"
              placeholder="Ex.: admin@gotareal.ao"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Senha</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="A sua senha de entrada"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {/* contas de demonstração — toque para preencher */}
          <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-secondary/40 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-navy">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Contas para ver como funciona
            </p>
            <div className="mt-2 space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.identifier}
                  type="button"
                  onClick={() => {
                    setIdentifier(acc.identifier)
                    setPassword(acc.password)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-white p-2.5 text-left shadow-sm transition-all hover:border-primary hover:bg-secondary/50 active:scale-[0.98]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gota-gradient text-white">
                    <acc.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-black text-navy">{acc.role}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {acc.identifier} · {acc.password}
                    </span>
                  </span>
                  <span className="text-[9px] font-bold text-primary">PREENCHER</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              Toque numa conta para preencher e depois toque em <b>Entrar</b>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleLogin}
            disabled={loading || !identifier.trim() || !password}
            className="h-11 w-full rounded-xl font-black"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            ENTRAR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Botão de terminar sessão usado nos painéis da equipa e no perfil. */
export function LogoutButton({ light = false, label = 'Sair' }: { light?: boolean; label?: string }) {
  const { auth, logout } = useAppStore()

  async function handleLogout() {
    if (auth?.token) {
      apiLogout(auth.token).catch(() => undefined)
    }
    logout()
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className={
        light
          ? 'font-bold text-white hover:bg-white/15 hover:text-white'
          : 'font-bold'
      }
    >
      <LogIn className="h-4 w-4 rotate-180" /> {label}
    </Button>
  )
}
