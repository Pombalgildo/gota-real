#!/usr/bin/env python3
"""Gera código TOTP (6 dígitos, 30s) a partir de um segredo base32.

Uso:
    python3 totp_gen.py <segredo_base32>
    TOTP_SECRET=<segredo_base32> python3 totp_gen.py

O segredo NUNCA deve ser gravado em ficheiros de repos públicos —
passe-o sempre como argumento ou variável de ambiente.
"""
import hmac, hashlib, base64, struct, sys, time, os

def totp(secret_b32: str, period: int = 30, digits: int = 6, t: int | None = None) -> str:
    # Normaliza base32 (maiúsculas, padding)
    s = secret_b32.strip().replace(' ', '').upper()
    pad = (8 - len(s) % 8) % 8
    key = base64.b32decode(s + '=' * pad)
    if t is None:
        t = int(time.time())
    counter = struct.pack('>Q', t // period)
    digest = hmac.new(key, counter, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code).zfill(digits)

if __name__ == '__main__':
    secret = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('TOTP_SECRET')
    if not secret:
        print('ERRO: indique o segredo: python3 totp_gen.py <segredo_base32>')
        print('   ou: TOTP_SECRET=<segredo> python3 totp_gen.py')
        sys.exit(1)
    now = int(time.time())
    remaining = 30 - (now % 30)
    code = totp(secret)
    print(f'code={code} validade={remaining}s unix={now}')
