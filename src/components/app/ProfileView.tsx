'use client'

import { useRef, useState } from 'react'
import { useAppStore, formatDateTime } from '@/store/app-store'
import { LocationPicker, type PickedLocation } from '@/components/app/LocationPicker'
import { LogoutButton } from '@/components/app/LoginDialog'
import { InstallAppCard } from '@/components/app/InstallPrompt'
import { AlertsSettingsCard } from '@/components/app/AlertCenter'
import { DropCrownIcon } from '@/components/app/Brand'
import { Avatar } from '@/components/app/Avatar'
import { updateCustomer } from '@/lib/api'
import { resizeImageToDataUrl } from '@/lib/image'
import { useToast } from '@/hooks/use-toast'
import { useCustomerOrders, useStoreConfig } from '@/components/app/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Bike,
  Building2,
  Camera,
  ChevronDown,
  Clock,
  CreditCard,
  Droplets,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react'

export function ProfileView() {
  const { customer, setCustomer } = useAppStore()
  const { toast } = useToast()
  const { orders } = useCustomerOrders(customer?.id)
  const { store } = useStoreConfig()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(customer?.name ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [saving, setSaving] = useState(false)

  const [locOpen, setLocOpen] = useState(false)
  const [location, setLocation] = useState<PickedLocation | null>(null)
  const [locSaving, setLocSaving] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

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

  /** envia a FOTO DE PERFIL escolhida pelo cliente (comprime no dispositivo) */
  async function uploadPhoto(file: File | undefined) {
    if (!file || !customer) return
    setPhotoSaving(true)
    try {
      const dataUrl = await resizeImageToDataUrl(file, 480, 0.85)
      const { customer: updated } = await updateCustomer(customer.id, { photo: dataUrl })
      setCustomer(updated)
      toast({ title: 'Foto de perfil actualizada ✅' })
    } catch (err) {
      toast({
        title: 'Foto não guardada',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setPhotoSaving(false)
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
          {/* avatar com botão de câmara — toca para trocar a foto */}
          <div className="relative shrink-0">
            <Avatar
              photo={customer.photo ?? null}
              name={customer.name}
              className="h-16 w-16 text-2xl"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoSaving}
              aria-label="Alterar a minha foto de perfil"
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full btn-gold shadow-lg transition-all hover:brightness-110 active:scale-90 disabled:opacity-60"
            >
              {photoSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                uploadPhoto(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
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
                  <Phone className="h-3 w-3 shrink-0" /> {customer.phone}
                </p>
                {customer.email && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">{customer.email}</span>
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
              className="mt-3 h-12 w-full rounded-2xl text-sm font-black"
              onClick={() => setLocOpen(true)}
            >
              <MapPin className="h-5 w-5 text-primary" /> Actualizar localização
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

      {/* dados da loja (preenchidos pela equipa na Central) */}
      {store && (
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-1.5 text-sm font-black text-navy">
            <Building2 className="h-4 w-4 text-primary" /> {store.name}
          </h3>
          {store.tagline && (
            <p className="mt-0.5 text-xs italic text-muted-foreground">{store.tagline}</p>
          )}
          <div className="mt-2.5 space-y-1.5 text-xs text-foreground">
            {store.phone && (
              <p className="flex min-w-0 items-start gap-1.5 break-words">
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {store.phone}
              </p>
            )}
            {store.whatsapp && (
              <p className="flex min-w-0 items-start gap-1.5 break-words">
                <Bike className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> WhatsApp: {store.whatsapp}
              </p>
            )}
            {store.address && (
              <p className="flex min-w-0 items-start gap-1.5 break-words">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {store.address}
              </p>
            )}
            {store.hours && (
              <p className="flex min-w-0 items-start gap-1.5 break-words">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {store.hours}
              </p>
            )}
            {store.deliveryFeeKz > 0 && (
              <p className="flex min-w-0 items-start gap-1.5 break-words">
                <Bike className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> Taxa de entrega:{' '}
                {store.deliveryFeeKz.toLocaleString('pt-AO')} Kz
              </p>
            )}
            {store.minOrderKz > 0 && (
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Pedido mínimo:{' '}
                {store.minOrderKz.toLocaleString('pt-AO')} Kz
              </p>
            )}
          </div>
          {store.note && (
            <p className="mt-2 rounded-xl bg-secondary/70 p-2.5 text-[11px] leading-snug text-secondary-foreground">
              {store.note}
            </p>
          )}
        </div>
      )}

      {/* ---------- QUEM SOMOS: os detalhes do serviço vivem aqui ---------- */}
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setAboutOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2"
          aria-expanded={aboutOpen}
        >
          <h3 className="flex items-center gap-1.5 text-sm font-black text-navy">
            <DropCrownIcon size={20} /> Quem Somos
          </h3>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
              aboutOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {!aboutOpen ? (
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Conheça a Gota REAL e como funciona o nosso serviço de entrega.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xs leading-relaxed text-foreground">
              A <b>Gota REAL</b> trata e purifica água para o seu consumo diário e
              entrega onde estiver — em casa, no escritório ou em eventos. Basta
              escolher os artigos na loja, indicar a quantidade e a nossa equipa de
              motoboys leva até si, com pagamento na entrega e acompanhamento por
              GPS do pedido até à sua porta.
            </p>
            <ul className="space-y-2">
              {[
                {
                  icon: Droplets,
                  text: 'Bidões de 5L, garrafões e garrafas — do pack familiar ao grande consumo',
                },
                {
                  icon: CreditCard,
                  text: 'Pague com TPA (cartão) ou dinheiro na entrega',
                },
                {
                  icon: MapPin,
                  text: 'Cadastre-se no local exacto de entrega — nunca mais perca o motoboy',
                },
                {
                  icon: Bike,
                  text: 'Acompanhe a entrega em tempo real, do pedido à porta de casa',
                },
                {
                  icon: ShieldCheck,
                  text: 'Registo de horas: saiba quando pediu e quando recebeu',
                },
              ].map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-[13px] leading-snug text-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ---------- ALERTAS COM SOM FORTE (estado do pedido, respostas) ---------- */}
      <AlertsSettingsCard />

      {/* ---------- INSTALAR A APP NO TELEMOVEL ---------- */}
      <InstallAppCard />

      {/* segurança / sair */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-xs font-bold text-foreground">Sessão segura</p>
            <p className="text-[10px] text-muted-foreground">dados guardados no seu dispositivo</p>
          </div>
        </div>
        <LogoutButton label="Sair" />
      </div>

      <p className="flex items-center justify-center gap-1 pb-2 text-center text-[10px] text-muted-foreground">
        <User className="h-3 w-3" /> Gota REAL · Água Purificada · Luanda
      </p>
    </div>
  )
}
