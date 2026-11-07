#!/usr/bin/env python3
"""Cria o repo PRIVADO gota-real-segredos no GitHub usando o token do git config.
Não imprime o token."""
import json
import re
import subprocess
import sys
import urllib.request

REPO_NAME = "gota-real-segredos"

def main():
    out = subprocess.run(["git", "remote", "get-url", "origin"],
                         capture_output=True, text=True, check=True).stdout.strip()
    m = re.match(r"https://([^:]+):([^@]+)@github\.com/([^/]+)/([^/]+)\.git", out)
    if not m:
        print("ERRO: remote em formato inesperado")
        sys.exit(1)
    user, token, owner = m.group(1), m.group(2), m.group(3)

    body = json.dumps({
        "name": REPO_NAME,
        "description": "Credenciais e segredos do projecto Gota REAL (repo PRIVADO — não partilhar)",
        "private": True,
        "has_issues": False,
        "has_wiki": False,
        "auto_init": False,
    }).encode()

    req = urllib.request.Request(
        f"https://api.github.com/user/repos",
        data=body,
        headers={"Authorization": f"token {token}",
                 "User-Agent": "gota-real-setup",
                 "Content-Type": "application/json",
                 "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
        print(f"repo criado: {data['full_name']} | privado: {data['private']}")
        print(f"url: {data['html_url']}")
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:300]
        if e.code == 422 and "already exists" in err:
            print(f"repo {REPO_NAME} já existe — a continuar")
        else:
            print(f"ERRO HTTP {e.code}: {err}")
            sys.exit(1)

if __name__ == "__main__":
    main()
