// Tipos partilhados entre o front-end e a API

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
