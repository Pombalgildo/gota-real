#!/usr/bin/env python3
"""
pty_run.py — corre um comando num pseudo-terminal (PTY) e responde
automaticamente aos prompts interactivos (bubblewrap/keytool/gradle).

Uso: python3 pty_run.py <config.json>

Config JSON:
  cmd:      ["bubblewrap", "init", ...]
  cwd:      "/caminho/opcional"
  timeout:  1500            (segundos)
  log:      "/tmp/xxx.log"  (output completo em bruto)
  rules:    [{"match": "regex", "send": "resposta\\n"}, ...]  (avaliadas por ordem)
  fallback: "\\n"            (resposta quando nenhuma regra encaixa; null = não responder)
"""
import os
import pty
import re
import select
import sys
import time
import json

ANSI = re.compile(
    r'\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][0-9A-B]|\x07'
)


def strip_ansi(s: str) -> str:
    return ANSI.sub('', s)


def looks_like_prompt(tail: str) -> bool:
    """Detecta um prompt à espera de resposta na última linha (estilo keytool)."""
    lines = [l for l in tail.splitlines() if l.strip()]
    if not lines:
        return False
    last = lines[-1].rstrip()
    if last.lstrip().startswith('? '):
        return True
    if re.search(r'\((Y/n|y/N|N/y|n/Y)\)\s*$', last):
        return True
    if re.search(r':\s*[_ ]*$', last):
        return True
    if re.search(r'>\s*$', last) and '?' in tail:
        return True
    return False


def find_active_question(tail: str):
    """Devolve a linha da pergunta activa, ou None.

    - inquirer: a pergunta activa é a ÚLTIMA linha que começa por '? '
      próxima do fundo (prompts de lista têm opções por baixo).
    - keytool/gradle: a última linha termina em ':' (ex.: '[Unknown]:').
    """
    lines = [l.rstrip() for l in tail.splitlines() if l.strip()]
    if not lines:
        return None
    for i in range(len(lines) - 1, -1, -1):
        l = lines[i]
        if l.lstrip().startswith('? ') and (len(lines) - i) <= 10:
            return l
    if looks_like_prompt(tail):
        return lines[-1]
    return None


def to_response(s):
    """Converte "\\n" (do JSON) em nova linha real."""
    if not isinstance(s, str):
        return s
    return s.replace('\\n', '\n')


def main():
    cfg = json.load(open(sys.argv[1]))
    cmd = cfg['cmd']
    cwd = cfg.get('cwd')
    timeout = cfg.get('timeout', 1500)
    log_path = cfg.get('log', '/tmp/pty_run.log')
    rules = [(re.compile(r['match'], re.I), to_response(r['send']))
             for r in cfg.get('rules', [])]
    fallback = to_response(cfg.get('fallback', ''))
    if fallback == '':
        fallback = '\n'
    max_sends = cfg.get('max_sends', 80)

    env = dict(os.environ)
    env.update(cfg.get('env', {}))
    env.setdefault('NO_COLOR', '1')
    env['TERM'] = 'xterm'

    log = open(log_path, 'wb')
    status_file = cfg.get('status_file', '/tmp/pty_run.status')

    pid, fd = pty.fork()
    if pid == 0:
        if cwd:
            os.chdir(cwd)
        try:
            os.execvpe(cmd[0], cmd, env)
        finally:
            os._exit(127)

    buf = ''
    last_output = time.time()
    last_send = 0.0
    start = time.time()
    sent = 0
    status = None
    done = False
    answered = set()  # perguntas já respondidas (dedupe)

    while not done:
        if time.time() - start > timeout:
            os.write(fd, b'\x03')
            time.sleep(1)
            status = -1
            break
        r, _, _ = select.select([fd], [], [], 0.5)
        if r:
            try:
                data = os.read(fd, 65536)
            except OSError:
                break
            if not data:
                break
            log.write(data)
            log.flush()
            buf += data.decode('utf-8', 'replace')
            if len(buf) > 8000:
                buf = buf[-4000:]
            last_output = time.time()
        else:
            try:
                pid2, st = os.waitpid(pid, os.WNOHANG)
                if pid2 == pid:
                    status = st
                    break
            except ChildProcessError:
                break
            # silêncio — talvez haja um prompt à espera de resposta
            quiet = time.time() - last_output
            since_send = time.time() - last_send
            if quiet >= 1.2 and since_send >= 3.0 and sent < max_sends:
                tail = strip_ansi(buf)[-600:]
                qline = find_active_question(tail)
                if qline is not None:
                    key = re.sub(r'\s+', ' ', qline).strip()
                    is_pw = 'password' in key.lower()
                    if is_pw or key not in answered:
                        response = None
                        for rx, send in rules:
                            if rx.search(qline):
                                response = send
                                break
                        if response is None and fallback is not None:
                            response = fallback
                        if response is not None:
                            os.write(fd, response.encode())
                            sent += 1
                            last_send = time.time()
                            buf = ''
                            if not is_pw:
                                answered.add(key)
                            print(f'[pty] #{sent} {key[-70:]!r} -> {response!r}',
                                  flush=True)

    if status is None:
        try:
            _, status = os.waitpid(pid, 0)
        except ChildProcessError:
            status = 0
    try:
        code = os.waitstatus_to_exitcode(status)
    except Exception:
        code = -1
    log.close()
    with open(status_file, 'w') as f:
        f.write(str(code))
    print(f'[pty] código de saída: {code}', flush=True)
    sys.exit(0 if code == 0 else 1)


if __name__ == '__main__':
    main()
