#!/usr/bin/env python3
"""Verifica visibilidade do repo GitHub usando a credencial guardada no git config.
Não imprime o token — só o estado do repositório."""
import json
import re
import subprocess
import urllib.request

def main():
    # lê o remote origin do git config
    out = subprocess.run(["git", "remote", "get-url", "origin"],
                         capture_output=True, text=True, check=True).stdout.strip()
    # extrai user:token e o caminho do repo
    m = re.match(r"https://([^:]+):([^@]+)@github\.com/([^/]+)/([^/]+)\.git", out)
    if not m:
        print("ERRO: remote em formato inesperado")
        return
    user, token, owner, repo = m.group(1), m.group(2), m.group(3), m.group(4)

    req = urllib.request.Request(
        f"https://api.github.com/repos/{owner}/{repo}",
        headers={"Authorization": f"token {token}", "User-Agent": "gota-real-setup"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.load(r)
        print(f"repo: {data['full_name']}")
        print(f"visibilidade: {'PRIVADO' if data['private'] else 'PÚBLICO ⚠️'}")
        print(f"default_branch: {data.get('default_branch')}")
        print(f"pushed_at: {data.get('pushed_at')}")
    except urllib.error.HTTPError as e:
        print(f"ERRO HTTP {e.code}: {e.reason}")

if __name__ == "__main__":
    main()
