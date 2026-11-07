#!/usr/bin/env python3
"""Verificação final de segurança: repo privado inacessível anonimamente,
repo público sem segredos. Não imprime o token."""
import json
import re
import subprocess
import urllib.request

def http_get(url, token=None):
    headers = {"User-Agent": "gota-real-setup"}
    if token:
        headers["Authorization"] = f"token {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, None

def main():
    out = subprocess.run(["git", "remote", "get-url", "origin"],
                         capture_output=True, text=True, check=True).stdout.strip()
    m = re.match(r"https://([^:]+):([^@]+)@github\.com/([^/]+)/([^/]+)\.git", out)
    token = m.group(2)

    print("== 1. Repo PRIVADO anonimamente (deve dar 404) ==")
    st, _ = http_get("https://api.github.com/repos/Pombalgildo/gota-real-segredos")
    print(f"   status anónimo: {st} {'✅ inacessível sem autenticação' if st == 404 else '⚠️ VERIFICAR'}")

    print("== 2. Repo PRIVADO com token (deve dar 200) ==")
    st, data = http_get("https://api.github.com/repos/Pombalgildo/gota-real-segredos", token)
    print(f"   status: {st} | private: {data.get('private') if data else '?'}")

    print("== 3. Últimos commits do repo PRIVADO ==")
    st, data = http_get("https://api.github.com/repos/Pombalgildo/gota-real-segredos/commits?per_page=5", token)
    if data:
        for c in data:
            print(f"   {c['sha'][:7]} {c['commit']['message'].splitlines()[0][:70]}")

    print("== 4. Últimos commits do repo PÚBLICO ==")
    st, data = http_get("https://api.github.com/repos/Pombalgildo/gota-real/commits?per_page=6")
    if data:
        for c in data:
            print(f"   {c['sha'][:7]} {c['commit']['message'].splitlines()[0][:70]}")

    print("== 5. Ficheiros no repo privado ==")
    st, data = http_get("https://api.github.com/repos/Pombalgildo/gota-real-segredos/contents/", token)
    if data:
        print("   " + ", ".join(f["name"] for f in data))

if __name__ == "__main__":
    main()
