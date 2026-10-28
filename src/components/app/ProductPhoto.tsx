'use client'

import { ProductArt } from '@/components/app/ProductArt'
import { cn } from '@/lib/utils'
import type { Product } from '@/lib/types'

/**
 * Mostra a FOTO REAL do artigo enviada pelo administrador
 * (guardada na base de dados). Se o artigo ainda não tiver foto,
 * mostra a ilustração SVG da marca como alternativa.
 */
export function ProductPhoto({
  product,
  className,
  imgClassName,
  rounded = 'rounded-2xl',
  alt,
}: {
  product: Pick<Product, 'image' | 'kind' | 'volumeL' | 'name'>
  className?: string
  imgClassName?: string
  rounded?: string
  alt?: string
}) {
  if (product.image) {
    return (
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden bg-secondary/60 ring-1 ring-border/60',
          rounded,
          className
        )}
      >
        {/* object-contain preserva a foto inteira sem cortes */}
        <img
          src={product.image}
          alt={alt ?? `Foto real de ${product.name}`}
          className={cn('h-full w-full object-contain', imgClassName)}
          loading="lazy"
        />
      </div>
    )
  }
  return <ProductArt kind={product.kind} volumeL={product.volumeL} className={className} />
}
