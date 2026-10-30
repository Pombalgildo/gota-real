import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitRealtime } from '@/lib/realtime-emitter'
import { CATALOG_ROLES, requireRole } from '@/lib/auth'

// limite do data URL da foto (~1,4 MB em base64 ≈ foto de 900px já comprimida)
const MAX_IMAGE_LENGTH = 1_500_000

/**
 * Valida a foto real do artigo:
 *  - undefined → não alterar (mantém a actual)
 *  - null ou "" → remover a foto
 *  - data URL válido → guardar
 */
function validateImage(image: unknown): string | null | undefined {
  if (image === null) return null
  if (image === undefined) return undefined
  if (typeof image !== 'string') return undefined
  if (image === '') return null
  if (!image.startsWith('data:image/')) {
    throw new Error('Formato de foto inválido.')
  }
  if (image.length > MAX_IMAGE_LENGTH) {
    throw new Error('Foto demasiado grande — escolha uma imagem mais leve.')
  }
  return image
}

// PATCH /api/products/[id] - actualizar produto (administrador ou editor)
// usado para ALTERAR PREÇOS, stock, foto real do artigo, etc.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await requireRole(req, CATALOG_ROLES)
    if (!staff) {
      return NextResponse.json(
        { error: 'Apenas o administrador ou o editor podem gerir a loja.' },
        { status: 403 }
      )
    }
    const { id } = await params
    const body = await req.json()
    const {
      name,
      description,
      category,
      kind,
      volumeL,
      priceKz,
      unitLabel,
      stock,
      active,
      image,
    } = body

    const product = await db.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    }

    const validatedImage = validateImage(image)

    const updated = await db.product.update({
      where: { id },
      data: {
        name: name ?? product.name,
        description: description ?? product.description,
        category: category ?? product.category,
        kind: kind ?? product.kind,
        volumeL: volumeL ?? product.volumeL,
        priceKz: priceKz != null ? Number(priceKz) : product.priceKz,
        unitLabel: unitLabel ?? product.unitLabel,
        stock: stock != null ? Number(stock) : product.stock,
        active: active != null ? Boolean(active) : product.active,
        ...(validatedImage !== undefined ? { image: validatedImage } : {}),
      },
    })

    // a loja de todos os clientes ligados actualiza-se automaticamente
    // (novo preço, nova foto real, artigo activo/inactivo)
    await emitRealtime('products:update', { product: updated })

    return NextResponse.json({ product: updated })
  } catch (error) {
    console.error('[api/products/[id]] erro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno.' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - desactivar produto (administrador ou editor)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await requireRole(req, CATALOG_ROLES)
    if (!staff) {
      return NextResponse.json(
        { error: 'Apenas o administrador ou o editor podem gerir a loja.' },
        { status: 403 }
      )
    }
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    }

    const updated = await db.product.update({ where: { id }, data: { active: false } })

    await emitRealtime('products:update', { product: updated })

    return NextResponse.json({ product: updated })
  } catch (error) {
    console.error('[api/products/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
