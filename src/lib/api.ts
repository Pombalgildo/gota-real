import type {
  Customer,
  Courier,
  Feedback,
  Order,
  Product,
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

// ---------- Clientes ----------
export function registerCustomer(body: {
  name: string
  phone: string
  email?: string
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

export function createProduct(body: Partial<Product>) {
  return request<{ product: Product }>('/api/products', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateProduct(id: string, body: Partial<Product>) {
  return request<{ product: Product }>(`/api/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deactivateProduct(id: string) {
  return request<{ product: Product }>(`/api/products/${id}`, { method: 'DELETE' })
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

export function fetchAllOrders() {
  return request<{ orders: Order[] }>('/api/orders?all=1')
}

export function fetchOrder(id: string) {
  return request<{ order: Order }>(`/api/orders/${id}`)
}

export function orderAction(
  id: string,
  action: 'confirm' | 'assign' | 'dispatch' | 'deliver' | 'cancel',
  courierId?: string
) {
  return request<{ order: Order }>(`/api/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action, courierId }),
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
export function fetchFeedback(customerId?: string) {
  const q = customerId ? `?customerId=${customerId}` : ''
  return request<{ feedbacks: Feedback[] }>(`/api/feedback${q}`)
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

export function respondFeedback(id: string, response: string) {
  return request<{ feedback: Feedback }>(`/api/feedback/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ response }),
  })
}
