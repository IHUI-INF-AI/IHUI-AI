"""对比 dramaScript.json 的 zh-CN / en / zh-TW."""
import json
import re
from pathlib import Path

BASE = Path(r"g:\IHUI-AI\client\src\locales\modules")


def walk(o, p, r):
    if isinstance(o, dict):
        for k, v in o.items():
            np = f"{p}.{k}" if p else k
            walk(v, np, r)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            np = f"{p}[{i}]"
            walk(v, np, r)
    else:
        r.append((p, o))
    return r


def is_mixed(v):
    v2 = re.sub(r"\{[^{}]*?\}", " ", v)
    v2 = re.sub(r"\b[A-Z][A-Z0-9]{1,5}\b", " ", v2)
    v2 = re.sub(r"\b\d+[A-Za-z]{1,3}\b", " ", v2)
    for a in ["id", "ip", "ai", "ui", "url", "api"]:
        v2 = re.sub(rf"\b{a}\b", " ", v2, flags=re.I)
    return bool(re.search(r"[\u4e00-\u9fa5]", v2)) and bool(re.search(r"[A-Za-z]{2,}", v2))


def is_eq(v):
    if not re.match(r"^[A-Za-z][A-Za-z0-9]*$", v):
        return False
    return v not in {"id", "ID", "AI", "API", "UI", "URL"}


def get_path(d, p):
    parts = p.split(".")
    cur = d
    for pp in parts:
        if pp.isdigit():
            cur = cur[int(pp)]
        else:
            cur = cur[pp]
    return cur


def main():
    for fname in ["dramaScript.json", "core.json", "floatingChat.json"]:
        print(f"\n========= {fname} =========")
        d = json.loads((BASE / "zh-CN" / fname).read_text(encoding="utf-8"))
        en = json.loads((BASE / "en" / fname).read_text(encoding="utf-8"))
        tw = json.loads((BASE / "zh-TW" / fname).read_text(encoding="utf-8"))
        enw = walk(en, "", [])
        tww = walk(tw, "", [])
        en_map = {p: v for p, v in enw}
        tw_map = {p: v for p, v in tww}
        zhw = walk(d, "", [])
        mixed = [p for p, v in zhw if is_mixed(v)]
        eq = [p for p, v in zhw if is_eq(v)]
        print(f"  mix={len(mixed)}  eq={len(eq)}")
        print(f"\n  === mix 样本 (zh-CN vs en vs zh-TW) ===")
        for p in mixed[:12]:
            try:
                zh_v = get_path(d, p)
            except Exception:
                continue
            z = en_map.get(p, "?")
            t = tw_map.get(p, "?")
            print(f"  {p}")
            print(f"    zh-CN: {zh_v!r}")
            print(f"    en:    {z!r}")
            print(f"    zh-TW: {t!r}")
        print(f"\n  === eq 样本 ===")
        for p in eq[:12]:
            try:
                zh_v = get_path(d, p)
            except Exception:
                continue
            print(f"  {p} = {zh_v!r}    en={en_map.get(p,'?')!r}")


if __name__ == "__main__":
    main()
