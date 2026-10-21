# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审计:哪些 ai_model_config 全局启用行能用当前 CREDENTIALS_ENCRYPTION_KEY 解密,
并对可解密的做经代理的可达性探测。决策 Fix③ 的真实可见集。只读,不改任何东西。
"""
import asyncio
import json
import os

import asyncpg
import base64
import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PROD_ENV = r"D:\DevEnv\ihui-prod\apps\ai-service\.env"
DEV_ENV = r"D:\IHUI-AI\apps\ai-service\.env"


def load_env(path):
    out = {}
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return out


def try_decrypt(enc, key_str):
    try:
        payload = json.loads(enc)
        if not (isinstance(payload, dict) and all(k in payload for k in ("iv", "ciphertext", "tag"))):
            return enc, None
    except (json.JSONDecodeError, TypeError):
        return enc, None
    for key in (key_str, key_str[:32], key_str.ljust(32, "0")[:32]):
        try:
            k = key.encode("utf-8")[:32]
            iv = base64.b64decode(payload["iv"])
            ct = base64.b64decode(payload["ciphertext"])
            tag = base64.b64decode(payload["tag"])
            return AESGCM(k).decrypt(iv, ct + tag, None).decode(), None
        except Exception:
            continue
    # 尝试 hex 解码 64 位密钥
    try:
        k = bytes.fromhex(key_str)
        iv = base64.b64decode(payload["iv"])
        ct = base64.b64decode(payload["ciphertext"])
        tag = base64.b64decode(payload["tag"])
        return AESGCM(k).decrypt(iv, ct + tag, None).decode(), None
    except Exception:
        pass
    return None, "decrypt-failed"


async def main():
    env = {**load_env(PROD_ENV), **load_env(DEV_ENV)}
    db_url = env["DATABASE_URL"]
    enc_key = env.get("CREDENTIALS_ENCRYPTION_KEY") or ""
    print("enc_key len:", len(enc_key))

    pool = await asyncpg.create_pool(dsn=db_url, min_size=1, max_size=2, command_timeout=10)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT provider_code, api_key_enc, base_url
               FROM ai_model_config
               WHERE owner_uuid IS NULL AND enabled AND api_key_enc IS NOT NULL
               ORDER BY provider_code"""
        )
    await pool.close()

    print(f"\n=== 全局启用+带密文 共 {len(rows)} 行,逐行解密审计 ===")
    ok = []
    bad = []
    for r in rows:
        plain, err = try_decrypt(r["api_key_enc"], enc_key)
        if plain:
            ok.append((r["provider_code"], plain, r["base_url"]))
            print(f"  OK    {r['provider_code']}")
        else:
            bad.append(r["provider_code"])
            print(f"  FAIL  {r['provider_code']}")

    print(f"\n可解密 {len(ok)} / {len(rows)};不可解密: {bad}")

    print("\n=== 对可解密者经代理探测 /models 可达性 ===")
    async with httpx.AsyncClient(timeout=20.0) as client:
        for code, key, base in ok:
            if not base:
                print(f"  [{code}] 无 base_url -> 无法 ping")
                continue
            u = base.rstrip("/")
            u = f"{u}/models" if u.endswith(("/v1", "/openai", "/v4")) else f"{u}/v1/models"
            try:
                resp = await client.get(u, headers={"Authorization": f"Bearer {key}"})
                print(f"  [{code}] HTTP {resp.status_code} ({len(resp.content)}B) {u}")
            except Exception as e:
                print(f"  [{code}] EXC {type(e).__name__}: {str(e)[:100]} {u}")


if __name__ == "__main__":
    asyncio.run(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
