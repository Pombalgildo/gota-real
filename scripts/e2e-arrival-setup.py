#!/usr/bin/env python3
"""E2E do aviso de chegada: põe o motoboy a 2,5 km e inicia a entrega."""
import json
import urllib.request

BASE = 'http://localhost:3000'
JOAO = 'cmvrx1c1x000ao1y5xxxtcbvj'

def req(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=20) as resp:
        return json.load(resp)

def main():
    with open('/tmp/e2e_order.json') as f:
        order = json.load(f)
    oid = order['orderId']

    mb = req('POST', '/api/auth/login', {'identifier': 'motoboy@gotareal.ao', 'password': 'motoboy123'})
    tok = mb['token']
    print('login motoboy ok')

    # motoboy a ~2,5 km a sul do cliente (-8.8368, 13.2343)
    req('PATCH', f'/api/couriers/{JOAO}', {'latitude': -8.8593, 'longitude': 13.2343}, tok)
    print('motoboy reposicionado a ~2,5 km')

    # inicia a entrega (em_transito)
    req('PATCH', f'/api/orders/{oid}', {'action': 'dispatch'}, tok)
    o = req('GET', f'/api/orders/{oid}', token=tok)
    st = o.get('order', o)
    print('estado:', st['status'], '| courier:', st.get('courierId'))
    print('cliente GPS:', st.get('latitude'), st.get('longitude'))

if __name__ == '__main__':
    main()
