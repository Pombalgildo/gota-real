import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'

/**
 * Autenticação por perfil com senha encriptada (scrypt) e sessões na base de dados.
 * Perfis: ADMIN (administrador), MOTOBOY (entregador), CLIENTE.
 */

const SESSION_DAYS = 30

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const test = scryptSync(password, salt, 64)
    const orig = Buffer.from(hash, 'hex')
    return test.length === orig.length && timingSafeEqual(test, orig)
  } catch {
    return false
  }
}

/** Cria uma sessão na base de dados e devolve o token de entrada. */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.session.create({ data: { id: token, userId, expiresAt } })
  // limpeza: remove sessões expiradas deste utilizador
  await db.session
    .deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
    .catch(() => undefined)
  return token
}

type UserWithLinks = Awaited<ReturnType<typeof db.user.findFirst<{ include: { customer: true; courier: true } }>>>

/** Lê o utilizador a partir do cabeçalho Authorization: Bearer <token>. */
export async function getUserFromRequest(
  req: NextRequest
): Promise<UserWithLinks | null> {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!token) return null
  const session = await db.session.findUnique({
    where: { id: token },
    include: { user: { include: { customer: true, courier: true } } },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: token } }).catch(() => undefined)
    return null
  }
  return session.user as UserWithLinks
}

/** Exige um administrador autenticado. */
export async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user || user.role !== 'ADMIN' || !user.active || user.banned) return null
  return user
}

/** Exige um trabalhador autenticado (administrador ou perfil criado por ele). */
export async function requireStaff(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user || !['ADMIN', 'MOTOBOY'].includes(user.role) || !user.active || user.banned) {
    return null
  }
  return user
}

/** Remove a senha antes de enviar o utilizador para o front-end. */
export function publicUser<T extends { password?: string }>(user: T): Omit<T, 'password'> {
  const { password: _password, ...rest } = user
  return rest
}

/** E-mail interno para clientes que não fornecem e-mail (entra pelo telefone). */
export function fallbackEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '') || 'semtelefone'
  return `${digits}@clientes.gotareal.ao`
}
