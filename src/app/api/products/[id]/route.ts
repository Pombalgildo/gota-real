import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/products/[id] - actualizar produto (central)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, description, category, kind, volumeL, priceKz, unitLabel, stock, active } = body

    const product = await db.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    }

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
      },
    })
    return NextResponse.json({ product: updated })
  } catch (error) {
    console.error('[api/products/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// DELETE /api/products/[id] - desactivar produto (central)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    }
    const updated = await db.product.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ product: updated })
  } catch (error) {
    console.error('[api/products/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
