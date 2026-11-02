// Tipos partilhados entre o front-end e a API

export type UserRole =
  | 'ADMIN'
  | 'ATENDENTE'
  | 'EDITOR'
  | 'MOTOBOY'
  | 'MOTORISTA'
  | 'CLIENTE'

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  ATENDENTE: 'Atendente',
  EDITOR: 'Editor',
  MOTOBOY: 'Motoboy',
  MOTORISTA: 'Motorista',
  CLIENTE: 'Cliente',
}

/** Descrição curta de cada perfil de trabalhador (usada na criação de perfis). */
export const ROLE_DESCRIPTION: Record<string, string> = {
  ADMIN: 'acesso total · ajustes e perfis',
  ATENDENTE: 'recebe e gere os pedidos e mensagens',
  EDITOR: 'gere a loja: fotos, preços e stock',
  MOTOBOY: 'entregas de mota com GPS',
  MOTORISTA: 'entregas de carro ligeiro com GPS',
}

/** Perfis que entram no painel da Central. */
export const CENTRAL_ROLES: string[] = ['ADMIN', 'ATENDENTE', 'EDITOR']
/** Perfis de entrega (mota ou carro). */
export const DELIVERY_ROLES: string[] = ['MOTOBOY', 'MOTORISTA']
/** Perfis que gerem pedidos (Central → Pedidos/Mensagens). */
export const ORDER_MANAGER_ROLES: string[] = ['ADMIN', 'ATENDENTE']
/** Perfis que gerem o catálogo da loja. */
export const CATALOG_ROLES: string[] = ['ADMIN', 'EDITOR']
/** Todos os perfis de trabalhador. */
export const WORKER_ROLES: string[] = ['ADMIN', 'ATENDENTE', 'EDITOR', 'MOTOBOY', 'MOTORISTA']

// ---------- Utilizador (login por perfil) ----------
export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole | string
  active: boolean
  // foto de perfil (data URL base64)
  photo?: string | null
  banned: boolean
  banReason?: string | null
  customerId?: string | null
  courierId?: string | null
  createdAt: string
  updatedAt: string
  customer?: {
    id: string
    name: string
    phone: string
    banned: boolean
    photo?: string | null
    _count?: { orders: number }
  } | null
  courier?: {
    id: string
    name: string
    vehicle: string
    plate: string
    available: boolean
  } | null
}

// ---------- Dados da loja ----------
export interface StoreConfig {
  id: string
  name: string
  tagline: string
  phone: string
  whatsapp: string
  address: string
  hours: string
  deliveryFeeKz: number
  minOrderKz: number
  note: string
  /** Localização GPS da base da empresa (de onde sai a mercadoria) */
  latitude?: number | null
  longitude?: number | null
  locationAccuracy?: number | null
  locationSource?: string | null
  locationUpdatedAt?: string | null
  updatedAt: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string | null
  address: string
  latitude?: number | null
  longitude?: number | null
  locationSource: 'exata' | 'auto' | 'atualizada' | string
  locationNote?: string | null
  // foto de perfil (data URL base64)
  photo?: string | null
  banned?: boolean
  banReason?: string | null
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: string
  name: string
  description: string
  category: 'agua' | 'acessorio' | string
  kind: 'bidon' | 'garrafao' | 'garrafa' | 'pack' | 'acessorio' | string
  volumeL: number
  priceKz: number
  unitLabel: string
  stock: number
  active: boolean
  sortOrder: number
  // foto real do artigo (data URL base64) enviada pelo administrador
  image?: string | null
  createdAt: string
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  productName: string
  unitLabel: string
  unitPriceKz: number
  quantity: number
  volumeL: number
}

export interface Courier {
  id: string
  name: string
  phone: string
  vehicle: string
  plate: string
  latitude?: number | null
  longitude?: number | null
  available: boolean
  orders?: { id: string; status: string }[]
}

export type OrderStatus =
  | 'pendente'
  | 'confirmado'
  | 'em_transito'
  | 'entregue'
  | 'cancelado'

/** Confirmação de recepção do cliente (anti-burla). */
export type ReceiptStatus = 'pendente' | 'confirmado' | 'disputado'

export const RECEIPT_STATUS_LABEL: Record<string, string> = {
  pendente: 'Recepção pendente',
  confirmado: 'Recepção confirmada',
  disputado: 'Não recebido (reclamação)',
}

export type PaymentMethod = 'TPA' | 'CASH'

export interface Order {
  id: string
  number: number
  customerId: string
  items: OrderItem[]
  totalKz: number
  totalLiters: number
  paymentMethod: PaymentMethod | string
  status: OrderStatus | string
  notes?: string | null
  address: string
  latitude?: number | null
  longitude?: number | null
  courierId?: string | null
  courier?: Courier | null
  customer?: {
    id: string
    name: string
    phone: string
    email?: string | null
    address: string
    latitude?: number | null
    longitude?: number | null
    locationSource: string
  } | null
  requestedAt: string
  confirmedAt?: string | null
  dispatchedAt?: string | null
  deliveredAt?: string | null
  cancelledAt?: string | null
  // confirmação de recepção pelo cliente (anti-burla)
  receiptStatus?: ReceiptStatus | string | null
  receiptConfirmedAt?: string | null
  receiptDisputedAt?: string | null
  disputeReason?: string | null
  disputeResolution?: string | null
  disputeResolvedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface Feedback {
  id: string
  customerId?: string | null
  customer?: { id: string; name: string; phone: string } | null
  type: 'sugestao' | 'reclamacao' | string
  subject: string
  message: string
  status: 'aberto' | 'respondido' | string
  response?: string | null
  respondedAt?: string | null
  createdAt: string
}

export interface CartItem {
  product: Product
  quantity: number
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pendente: 'Solicitado',
  confirmado: 'Confirmado',
  em_transito: 'Em trânsito',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export const PAYMENT_LABEL: Record<string, string> = {
  TPA: 'TPA (cartão)',
  CASH: 'Dinheiro (cash)',
}
