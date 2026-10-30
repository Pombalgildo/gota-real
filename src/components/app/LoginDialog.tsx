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
  KeyRound,
  Loader2,
  LogIn,
} from 'lucide-react'

// As contas da equipa (central e motoboys) existem na base de dados,
// mas NÃO são divulgadas aqui — entram pela mesma entrada discreta,
// sem qualquer indício público dos painéis internos.

export function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { setAuth, setCustomer, setMode, setCourierId } = useAppStore()
  const { toast } = useToast()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setIdentifier('')
      setPassword('')
    }
  }, [open])

  async function handleLogin() {
    if (!identifier.trim() || !password) return
    setLoading(true)
    try {
      const res = await apiLogin(identifier.trim(), password)
      setAuth({ token: res.token, user: res.user })

      // encaminha conforme o perfil que entrou
      const role = res.user.role
      if (role === 'ADMIN' || role === 'ATENDENTE' || role === 'EDITOR') {
        setMode('central')
      } else if (role === 'MOTOBOY' || role === 'MOTORISTA') {
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
          role === 'ADMIN'
            ? 'Painel do administrador aberto.'
            : role === 'ATENDENTE'
              ? 'Painel da atendente aberto — receba e gere os pedidos.'
              : role === 'EDITOR'
                ? 'Painel do editor aberto — gira a loja.'
                : role === 'MOTOBOY'
                  ? 'Painel do motoboy aberto — aguarde as entregas.'
                  : role === 'MOTORISTA'
                    ? 'Painel do motorista aberto — aguarde as entregas.'
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
            <KeyRound className="h-5 w-5 text-primary" /> Entrar
          </DialogTitle>
          <DialogDescription>
            Use o telefone ou e-mail da sua conta e a sua senha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="login-identifier">E-mail ou telefone</Label>
            <Input
              id="login-identifier"
              placeholder="Ex.: 923 456 789"
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
              placeholder="A sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
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
