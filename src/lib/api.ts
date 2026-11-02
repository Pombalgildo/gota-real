import type {
  Customer,
  Courier,
  Feedback,
  Order,
  Product,
  StoreConfig,
  User,
} from '@/lib/types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? 'Erro de comunicação com o servidor.')
  }
  return data as T
}

// ---------- Autenticação (login por perfil) ----------
export function apiLogin(identifier: string, password: string) {
  return request<{
    token: string
    user: User
    customer?: Customer | null
    courier?: Courier | null
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  })
}

export function apiLogout(token: string) {
  return request<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ---------- Perfis (gestão do administrador) ----------
export function fetchUsers(token: string) {
  return request<{ users: User[] }>('/api/users', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function createUser(
  token: string,
  body: {
    name: string
    email: string
    phone?: string
    password: string
    role: 'ADMIN' | 'ATENDENTE' | 'EDITOR' | 'MOTOBOY' | 'MOTORISTA'
    vehicle?: string
    plate?: string
    photo?: string | null
  }
) {
  return request<{ user: User }>('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export function updateUser(
  token: string,
  id: string,
  body: Partial<{
    name: string
    email: string
    phone: string
    password: string
    role: string
    active: boolean
    banned: boolean
    banReason: string
    vehicle: string
    plate: string
    photo: string | null
  }>
) {
  return request<{ user: User }>(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export function deleteUser(token: string, id: string) {
  return request<{ ok: boolean }>(`/api/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ---------- Dados da loja ----------
export function fetchStore() {
  return request<{ store: StoreConfig }>('/api/store')
}

export function updateStore(
  token: string,
  body: Partial<{
    name: string
    tagline: string
    phone: string
    whatsapp: string
    address: string
    hours: string
    deliveryFeeKz: number
    minOrderKz: number
    note: string
    /** Localização GPS da base da empresa */
    latitude: number | null
    longitude: number | null
    locationAccuracy: number | null
    locationSource: string
    /** true = remover a localização da base */
    clearLocation: boolean
  }>
) {
  return request<{ store: StoreConfig }>('/api/store', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

// ---------- Clientes ----------
export function registerCustomer(body: {
  name: string
  phone: string
  email?: string
  password?: string
  address?: string
  latitude?: number | null
  longitude?: number | null
  locationSource?: string
  locationNote?: string | null
}) {
  return request<{ customer: Customer; updatedExisting?: boolean }>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function loginCustomer(phone: string) {
  return request<{ customer: Customer }>(`/api/customers?phone=${encodeURIComponent(phone)}`)
}

export function fetchCustomer(id: string) {
  return request<{ customer: Customer; ordersCount: number }>(`/api/customers/${id}`)
}

export function updateCustomer(
  id: string,
  body: Partial<{
    name: string
    email: string
    address: string
    latitude: number | null
    longitude: number | null
    locationSource: string
    locationNote: string | null
    photo: string | null
  }>
) {
  return request<{ customer: Customer }>(`/api/customers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

// ---------- Produtos ----------
export function fetchProducts() {
  return request<{ products: Product[] }>('/api/products')
}

export function createProduct(token: string, body: Partial<Product>) {
  return request<{ product: Product }>('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export function updateProduct(token: string, id: string, body: Partial<Product>) {
  return request<{ product: Product }>(`/api/products/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export function deactivateProduct(token: string, id: string) {
  return request<{ product: Product }>(`/api/products/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ---------- Pedidos ----------
export function createOrder(body: {
  customerId: string
  items: { productId: string; quantity: number }[]
  paymentMethod: 'TPA' | 'CASH'
  notes?: string
  latitude?: number | null
  longitude?: number | null
  address?: string
}) {
  return request<{ order: Order }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchCustomerOrders(customerId: string) {
  return request<{ orders: Order[] }>(`/api/orders?customerId=${customerId}`)
}

export function fetchAllOrders(token?: string | null) {
  return request<{ orders: Order[] }>('/api/orders?all=1', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

export function fetchOrder(id: string) {
  return request<{ order: Order }>(`/api/orders/${id}`)
}

export function orderAction(
  token: string,
  id: string,
  action: 'confirm' | 'assign' | 'dispatch' | 'deliver' | 'cancel',
  courierId?: string
) {
  return request<{ order: Order }>(`/api/orders/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, courierId }),
  })
}

// ---------- Confirmação de recepção (anti-burla) ----------
/** O cliente confirma que recebeu a mercadoria. */
export function confirmReceipt(orderId: string, customerId: string) {
  return request<{ order: Order }>(`/api/orders/${orderId}/receipt`, {
    method: 'POST',
    body: JSON.stringify({ action: 'confirm', customerId }),
  })
}

/** O cliente reclama que NÃO recebeu — a central é alertada na hora. */
export function disputeReceipt(orderId: string, customerId: string, reason?: string) {
  return request<{ order: Order }>(`/api/orders/${orderId}/receipt`, {
    method: 'POST',
    body: JSON.stringify({ action: 'dispute', customerId, reason }),
  })
}

/** A administração responde à reclamação e fecha o caso. */
export function resolveDispute(token: string, orderId: string, resolution: string) {
  return request<{ order: Order }>(`/api/orders/${orderId}/receipt`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'resolve', resolution }),
  })
}

// ---------- Motoboys ----------
export function fetchCouriers() {
  return request<{ couriers: Courier[] }>('/api/couriers')
}

export function createCourier(body: Partial<Courier> & { name: string }) {
  return request<{ courier: Courier }>('/api/couriers', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateCourier(
  id: string,
  body: Partial<{ latitude: number; longitude: number; available: boolean }>
) {
  return request<{ courier: Courier }>(`/api/couriers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

// ---------- Sugestões e Reclamações ----------
export function fetchFeedback(customerId?: string, token?: string | null) {
  const q = customerId ? `?customerId=${customerId}` : ''
  return request<{ feedbacks: Feedback[] }>(`/api/feedback${q}`, {
    headers: !customerId && token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

export function createFeedback(body: {
  customerId?: string
  type: 'sugestao' | 'reclamacao'
  subject: string
  message: string
}) {
  return request<{ feedback: Feedback }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function respondFeedback(token: string, id: string, response: string) {
  return request<{ feedback: Feedback }>(`/api/feedback/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ response }),
  })
}

// ---------- Centro de alertas (sons fortes) ----------
/** Registo enxuto de um pedido vigiado pelo centro de alertas. */
export interface EventOrder {
  id: string
  number: number
  status: string
  totalKz?: number
  totalLiters?: number
  address?: string
  /** confirmação de recepção do cliente (anti-burla) */
  receiptStatus?: string | null
  disputeReason?: string | null
  deliveredAt?: string | null
  courier?: { name?: string; vehicle?: string } | null
  requestedAt: string
  updatedAt: string
  customer?: { id: string; name: string; phone: string } | null
}

/** Registo enxuto de uma mensagem vigiada pelo centro de alertas. */
export interface EventFeedback {
  id: string
  type: string
  subject: string
  status: string
  createdAt: string
  respondedAt?: string | null
  customer?: { id: string; name: string; phone: string } | null
}

/**
 * Alimentação do centro de alertas: devolve apenas o que precisa de
 * atenção agora, conforme o papel (equipa, entregador ou cliente).
 */
export function fetchEvents(params: {
  token?: string | null
  courierId?: string | null
  customerId?: string | null
}) {
  const q = new URLSearchParams()
  if (params.courierId) q.set('courierId', params.courierId)
  if (params.customerId) q.set('customerId', params.customerId)
  const qs = q.toString()
  return request<{
    serverTime: string
    scope: 'staff' | 'courier' | 'customer' | 'none'
    orders: EventOrder[]
    feedbacks: EventFeedback[]
  }>(`/api/events${qs ? `?${qs}` : ''}`, {
    headers: params.token ? { Authorization: `Bearer ${params.token}` } : undefined,
  })
}


// ---------- Relatórios de actividade (diário / semanal / mensal) ----------
export interface ReportSeriesSlot {
  key: string
  label: string
  orders: number
  delivered: number
  revenueKz: number
}

export interface ReportData {
  period: 'daily' | 'weekly' | 'monthly'
  ref: string
  label: string
  from: string
  to: string
  generatedAt: string
  kpis: {
    ordersTotal: number
    delivered: number
    cancelled: number
    pending: number
    confirmed: number
    inTransit: number
    revenueKz: number
    liters: number
    avgDeliveryMin: number | null
    newCustomers: number
    messages: number
    messagesOpen: number
    receiptsConfirmed: number
    receiptsPending: number
    disputesOpen: number
    disputesResolved: number
  }
  series: ReportSeriesSlot[]
  topProducts: { name: string; quantity: number; revenueKz: number }[]
  couriers: { name: string; deliveries: number; avgMin: number | null }[]
  payments: { method: string; count: number; revenueKz: number }[]
}

/** Relatório de actividade para o período e a data de referência. */
export function fetchReports(token: string, period: 'daily' | 'weekly' | 'monthly', ref: string) {
  return request<ReportData>(`/api/reports?period=${period}&ref=${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
