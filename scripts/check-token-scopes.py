#!/usr/bin/env python3
"""Verifica os scopes do token GitHub guardado no git config (não imprime o token)."""
import re
import subprocess
import urllib.request

def main():
    out = subprocess.run(["git", "remote", "get-url", "origin"],
                         capture_output=True, text=True, check=True).stdout.strip()
    m = re.match(r"https://([^:]+):([^@]+)@github\.com/([^/]+)/([^/]+)\.git", out)
    if not m:
        print("ERRO: remote em formato inesperado")
        return
    user, token = m.group(1), m.group(2)

    req = urllib.request.Request(
        "https://api.github.com/user",
        headers={"Authorization": f"token {token}", "User-Agent": "gota-real-setup"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            scopes = r.headers.get("X-OAuth-Scopes", "(nenhum)")
            print(f"utilizador: {r.headers.get('X-OAuth-Login', user) or user}")
            print(f"scopes do token: {scopes}")
    except urllib.error.HTTPError as e:
        print(f"ERRO HTTP {e.code}: {e.reason}")

if __name__ == "__main__":
    main()
