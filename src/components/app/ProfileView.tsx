'use client'

import { useState } from 'react'
import { useAppStore, formatDateTime } from '@/store/app-store'
import { LocationPicker, type PickedLocation } from '@/components/app/LocationPicker'
import { updateCustomer } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useCustomerOrders } from '@/components/app/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Bike,
  Building2,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react'

export function ProfileView() {
  const { customer, setCustomer, setMode, mode } = useAppStore()
  const { toast } = useToast()
  const { orders } = useCustomerOrders(customer?.id)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(customer?.name ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [saving, setSaving] = useState(false)

  const [locOpen, setLocOpen] = useState(false)
  const [location, setLocation] = useState<PickedLocation | null>(null)
  const [locSaving, setLocSaving] = useState(false)

  if (!customer) return null

  const delivered = orders.filter((o) => o.status === 'entregue').length
  const liters = orders
    .filter((o) => o.status === 'entregue')
    .reduce((s, o) => s + o.totalLiters, 0)

  async function saveProfile() {
    setSaving(true)
    try {
      const { customer: updated } = await updateCustomer(customer!.id, {
        name: name.trim(),
        email: email.trim(),
      })
      setCustomer(updated)
      setEditing(false)
      toast({ title: 'Perfil actualizado ✅' })
    } catch (err) {
      toast({
        title: 'Erro ao guardar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function saveLocation() {
    if (!location) return
    setLocSaving(true)
    try {
      const { customer: updated } = await updateCustomer(customer!.id, {
        latitude: location.lat,
        longitude: location.lng,
        address: location.address ?? customer!.address,
        locationSource: 'atualizada',
        locationNote: 'Localização actualizada pelo cliente',
      })
      setCustomer(updated)
      setLocOpen(false)
      setLocation(null)
      toast({
        title: 'Localização de entrega actualizada 📍',
        description: 'As próximas entregas serão feitas no novo ponto.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao guardar localização',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLocSaving(false)
    }
  }

  const locSourceBadge =
    customer.locationSource === 'exata'
      ? { label: 'local exacto (cadastro)', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
      : customer.locationSource === 'atualizada'
        ? { label: 'actualizada', cls: 'border-sky-200 bg-sky-50 text-sky-700' }
        : { label: 'provisória (automática)', cls: 'border-amber-200 bg-amber-50 text-amber-700' }

  return (
    <div className="space-y-4 pb-4">
      <h2 className="text-base font-black text-navy">O meu perfil</h2>

      {/* cartão de identidade */}
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl gota-gradient text-xl font-black text-white shadow-md">
            {customer.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="space-y-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (opcional)" inputMode="email" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveProfile} disabled={saving || !name.trim()} className="font-bold">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(customer.name); setEmail(customer.email ?? '') }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="truncate text-base font-black text-navy">{customer.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </p>
                {customer.email && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" /> {customer.email}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  cliente desde {formatDateTime(customer.createdAt)}
                </p>
              </>
            )}
          </div>
          {!editing && (
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Editar perfil">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Separator className="my-3.5" />

        {/* estatísticas */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-secondary/60 py-2.5">
            <p className="text-lg font-black text-navy">{orders.length}</p>
            <p className="text-[10px] font-semibold text-muted-foreground">pedidos</p>
          </div>
          <div className="rounded-xl bg-secondary/60 py-2.5">
            <p className="text-lg font-black text-navy">{delivered}</p>
            <p className="text-[10px] font-semibold text-muted-foreground">entregues</p>
          </div>
          <div className="rounded-xl bg-secondary/60 py-2.5">
            <p className="text-lg font-black text-navy">{Math.round(liters)} L</p>
            <p className="text-[10px] font-semibold text-muted-foreground">de água bebida</p>
          </div>
        </div>
      </div>

      {/* localização de entrega */}
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-black text-navy">
            <MapPin className="h-4 w-4 text-gold" /> Local de entrega
          </h3>
          <Badge variant="outline" className={`text-[10px] ${locSourceBadge.cls}`}>
            {locSourceBadge.label}
          </Badge>
        </div>

        {!locOpen ? (
          <>
            <p className="mt-2 text-xs leading-relaxed text-foreground">
              {customer.address || 'Sem endereço descritivo.'}
            </p>
            {customer.latitude != null && (
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {customer.latitude.toFixed(5)}, {customer.longitude?.toFixed(5)}
              </p>
            )}
            {customer.locationNote && (
              <p className="mt-1.5 text-[10px] italic text-muted-foreground">{customer.locationNote}</p>
            )}
            <Button
              variant="outline"
              className="mt-3 h-10 w-full rounded-xl font-bold"
              onClick={() => setLocOpen(true)}
            >
              <MapPin className="h-4 w-4 text-primary" /> Actualizar localização
            </Button>
          </>
        ) : (
          <div className="mt-3 space-y-3">
            <LocationPicker
              value={location}
              onChange={setLocation}
              compact
              hint="Capture o GPS no novo ponto exacto de entrega. Substitui a localização anterior."
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1 font-semibold"
                onClick={() => { setLocOpen(false); setLocation(null) }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-[2] font-bold"
                disabled={!location || locSaving}
                onClick={saveLocation}
              >
                {locSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar nova localização
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* área da empresa */}
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-sm font-black text-navy">
          <Building2 className="h-4 w-4 text-primary" /> Área da empresa
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Acesso para a equipa Gota REAL (modo demonstração).
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant={mode === 'central' ? 'default' : 'outline'}
            className="h-11 flex-col gap-0.5 rounded-xl py-2"
            onClick={() => setMode('central')}
          >
            <Building2 className="h-4.5 w-4.5" />
            <span className="text-[11px] font-bold">Central</span>
          </Button>
          <Button
            variant={mode === 'motoboy' ? 'default' : 'outline'}
            className="h-11 flex-col gap-0.5 rounded-xl py-2"
            onClick={() => setMode('motoboy')}
          >
            <Bike className="h-4.5 w-4.5" />
            <span className="text-[11px] font-bold">Motoboy</span>
          </Button>
        </div>
      </div>

      {/* segurança / sair */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-xs font-bold text-foreground">Sessão segura</p>
            <p className="text-[10px] text-muted-foreground">dados guardados no seu dispositivo</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => {
            setCustomer(null)
            setMode('cliente')
          }}
        >
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>

      <p className="flex items-center justify-center gap-1 pb-2 text-center text-[10px] text-muted-foreground">
        <User className="h-3 w-3" /> Gota REAL · Água Purificada · Luanda
      </p>
    </div>
  )
}
