#!/usr/bin/env python3
"""Gera o logo quadrado de fundo BRANCO + ícones PWA a partir do logo horizontal branco."""
from PIL import Image

SRC = '/home/z/my-project/public/gota-real-logo.png'  # 1600x1177, fundo branco
OUT_SQUARE = '/home/z/my-project/public/gota-real-logo-square-white.png'
OUT_192 = '/home/z/my-project/public/icon-192.png'
OUT_512 = '/home/z/my-project/public/icon-512.png'

logo = Image.open(SRC).convert('RGB')
W, H = logo.size  # 1600 x 1177

# composição: canvas quadrado branco com o logo centrado (com margem)
def make_square(size: int, margin: float = 0.10) -> Image.Image:
    canvas = Image.new('RGB', (size, size), (255, 255, 255))
    avail = int(size * (1 - 2 * margin))
    ratio = min(avail / W, avail / H)
    new_w, new_h = int(W * ratio), int(H * ratio)
    resized = logo.resize((new_w, new_h), Image.LANCZOS)
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(resized, (x, y))
    return canvas

square = make_square(1024, margin=0.07)
square.save(OUT_SQUARE, 'PNG', optimize=True)
make_square(192, margin=0.10).save(OUT_192, 'PNG', optimize=True)
make_square(512, margin=0.10).save(OUT_512, 'PNG', optimize=True)

# verificação: cantos brancos
im = Image.open(OUT_SQUARE)
corners = [im.getpixel((3, 3)), im.getpixel((1020, 3)), im.getpixel((3, 1020)), im.getpixel((1020, 1020))]
print('logo branco:', im.size, 'cantos:', corners)
for f in (OUT_192, OUT_512):
    i = Image.open(f)
    print(f.split('/')[-1], i.size, 'canto:', i.getpixel((2, 2)))
