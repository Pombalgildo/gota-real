#!/usr/bin/env python3
"""Prepara o cenário de teste E2E: pedido confirmado + atribuído ao João Motoboy.
Usa a API como o frontend faria."""
import json
import urllib.request

BASE = 'http://localhost:3000'

def req(method, path, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=20) as resp:
        return json.load(resp)

def main():
    # logins
    cli = req('POST', '/api/auth/login', {'identifier': 'cliente@gotareal.ao', 'password': 'cliente123'})
    adm = req('POST', '/api/auth/login', {'identifier': 'admin@gotareal.ao', 'password': 'admin123'})
    cli_token, cli_id = cli['token'], cli['user']['customerId']
    adm_token = adm['token']
    print('logins ok')

    # produto mais barato
    prods = req('GET', '/api/products')['products']
    prod = next(p for p in prods if p.get('available', True))
    print('produto:', prod['name'])

    # pedido com GPS do cliente (perto do centro de Luanda)
    order = req('POST', '/api/orders', {
        'customerId': cli_id,
        'items': [{'productId': prod['id'], 'quantity': 2}],
        'paymentMethod': 'CASH',
        'latitude': -8.8368,
        'longitude': 13.2343,
        'address': 'Rua da Missão, Ingombota, Luanda',
        'notes': 'teste de rastreio GPS',
    }, cli_token)['order']
    print('pedido criado nº', order['number'], order['id'])

    # admin confirma e atribui o João Motoboy
    joao = 'cmvrx1c1x000ao1y5xxxtcbvj'
    req('PATCH', f"/api/orders/{order['id']}", {'action': 'confirm'}, adm_token)
    req('PATCH', f"/api/orders/{order['id']}", {'action': 'assign', 'courierId': joao}, adm_token)
    o = req('GET', f"/api/orders/{order['id']}", token=adm_token)
    print('estado final:', o.get('order', o).get('status'), '| courier:', o.get('order', o).get('courierId'))

    with open('/tmp/e2e_order.json', 'w') as f:
        json.dump({'orderId': order['id'], 'number': order['number']}, f)

if __name__ == '__main__':
    main()
