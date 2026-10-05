#!/usr/bin/env python3
"""
PHP structural sanity checker (no PHP CLI available in sandbox).
- Tokenizes PHP code: skips 'single', "double" strings, //, #, /* */ comments,
  and heredocs, then verifies (), [], {} balance and statement sanity.
- Also flags single-quoted strings containing literal \n (classic SSE bug).
Exit code 0 = all clean.
"""
import sys, re

def strip_php(code: str):
    """Return brace/paren/bracket-validated view: strings & comments removed."""
    i, n = 0, len(code)
    out = []
    stack = []
    line = 1
    errors = []
    pairs = {')': '(', ']': '[', '}': '{'}
    while i < n:
        c = code[i]
        nxt = code[i+1] if i+1 < n else ''
        if c == '\n':
            line += 1; i += 1; continue
        # comments
        if c == '/' and nxt == '/':
            while i < n and code[i] != '\n': i += 1
            continue
        if c == '#':
            while i < n and code[i] != '\n': i += 1
            continue
        if c == '/' and nxt == '*':
            j = code.find('*/', i+2)
            if j == -1:
                errors.append(f'line {line}: unterminated block comment'); break
            line += code.count('\n', i, j)
            i = j + 2
            continue
        # single-quoted string (PHP: only \' and \\ escapes)
        if c == "'":
            j = i + 1
            buf = []
            while j < n:
                if code[j] == '\\':
                    buf.append(code[j:j+2]); j += 2; continue
                if code[j] == "'": break
                if code[j] == '\n': line += 1
                buf.append(code[j]); j += 1
            if j >= n:
                errors.append(f'line {line}: unterminated single-quoted string'); break
            s = ''.join(buf)
            if '\\n' in s or '\\t' in s:
                errors.append(f'line {line+code.count(chr(10), i, j)}: literal \\n/\\t inside SINGLE-quoted string -> {s[:60]!r}')
            i = j + 1
            continue
        # double-quoted string (ignore interpolation content, count escapes)
        if c == '"':
            j = i + 1
            while j < n:
                if code[j] == '\\':
                    j += 2; continue
                if code[j] == '"': break
                if code[j] == '\n': line += 1
                j += 1
            if j >= n:
                errors.append(f'line {line}: unterminated double-quoted string'); break
            i = j + 1
            continue
        # heredoc / nowdoc
        m = re.match(r"<<<'?([A-Za-z_][A-Za-z0-9_]*)'?\r?\n", code[i:])
        if m:
            tag = m.group(1)
            j = i + m.end()
            endm = re.search(rf"\n[ \t]*{tag}\b", code[j:])
            if not endm:
                errors.append(f'line {line}: unterminated heredoc {tag}'); break
            line += code.count('\n', i, j + endm.end())
            i = j + endm.end()
            continue
        if c in '([{':
            stack.append((c, line)); i += 1; continue
        if c in ')]}':
            if not stack:
                errors.append(f'line {line}: unmatched closing {c}')
            else:
                op, ol = stack.pop()
                if op != pairs[c]:
                    errors.append(f'line {line}: {c} closes {op} opened line {ol}')
            i += 1; continue
        i += 1
    for op, ol in stack:
        errors.append(f'line {ol}: unclosed {op}')
    return errors

def main(files):
    failed = False
    for f in files:
        code = open(f, encoding='utf-8', errors='replace').read()
        if f.endswith('.php'):
            # Only validate actual PHP segments between <?php/<?= and ?>
            # (CSS/JS inside .php views is not PHP)
            segs = []
            pos = 0
            pattern = re.compile(r'<\?(php|=)?', re.I)
            matches = list(pattern.finditer(code))
            for idx, m in enumerate(matches):
                start = m.end()
                end = code.find('?>', start)
                if end == -1:
                    end = len(code)
                    segs.append(code[start:end])
                    pos = len(code)
                    break
                segs.append(code[start:end])
            if not matches:
                segs = []
            # Prepend line numbers offset per segment so reported lines are global
            errs = []
            offset = 0
            search_from = 0
            for seg in segs:
                seg_start_abs = code.find(seg[:40], search_from)
                if seg_start_abs == -1:
                    seg_start_abs = search_from
                pre_lines = code.count('\n', 0, seg_start_abs)
                for e in strip_php(seg):
                    # re-offset "line N" errors
                    em = re.match(r'line (\d+): (.*)', e)
                    if em:
                        errs.append(f"line {int(em.group(1)) + pre_lines}: {em.group(2)}")
                    else:
                        errs.append(e)
                search_from = seg_start_abs + max(len(seg), 1)
        else:
            errs = strip_php(code)
        if errs:
            failed = True
            print(f'FAIL {f}')
            for e in errs[:12]:
                print('   ', e)
        else:
            print(f'OK   {f}')
    sys.exit(1 if failed else 0)

if __name__ == '__main__':
    main(sys.argv[1:])
