'use client'

/**
 * Utilitários de imagem para o upload da FOTO REAL do artigo
 * (feita pelo administrador na Central, a partir do telemóvel ou PC).
 *
 * A foto é redimensionada e comprimida no próprio dispositivo antes
 * de ser enviada — assim chega à base de dados leve e a loja do
 * cliente carrega depressa, mesmo com internet fraca.
 */

export function resizeImageToDataUrl(
  file: File,
  maxDim = 900,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('O ficheiro escolhido não é uma imagem.'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('Não foi possível processar a imagem neste dispositivo.'))
          return
        }
        // fundo branco (evita fundo preto em PNG transparentes)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err instanceof Error ? err : new Error('Erro ao processar a imagem.'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Imagem inválida ou ilegível.'))
    }
    img.src = url
  })
}
