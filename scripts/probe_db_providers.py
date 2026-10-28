# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""预测测试:用生产 .env + DB 真实密钥,经代理探测 gemini/qwen/zhipu 是否可达。
仅用于决策 Fix③ 是否会让这三个 provider 真正显示(HEALTHY),不改动任何东西。
"""
import asyncio
import json
import os
import sys

import httpx

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


async def main():
    env = {**load_env(PROD_ENV), **load_env(DEV_ENV)}
    db_url = env.get("DATABASE_URL")
    enc_key = env.get("CREDENTIALS_ENCRYPTION_KEY")
    print("DATABASE_URL set:", bool(db_url), "| enc_key len:", len(enc_key or ""))

    import asyncpg
    import base64
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    pool = await asyncpg.create_pool(dsn=db_url, min_size=1, max_size=2, command_timeout=10)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT provider_code, api_key_enc, base_url
               FROM ai_model_config
               WHERE provider_code IN ('gemini','qwen','zhipu')
                 AND owner_uuid IS NULL AND enabled AND api_key_enc IS NOT NULL"""
        )

    def decrypt(enc):
        try:
            payload = json.loads(enc)
            if not (isinstance(payload, dict) and all(k in payload for k in ("iv", "ciphertext", "tag"))):
                return enc
        except (json.JSONDecodeError, TypeError):
            return enc
        key = enc_key.encode()[:32]
        iv = base64.b64decode(payload["iv"])
        ct = base64.b64decode(payload["ciphertext"])
        tag = base64.b64decode(payload["tag"])
        return AESGCM(key).decrypt(iv, ct + tag, None).decode()

    targets = [(r["provider_code"], decrypt(r["api_key_enc"]), r["base_url"]) for r in rows]
    await pool.close()

    async with httpx.AsyncClient(timeout=20.0) as client:
        for code, key, base in targets:
            if not base:
                print(f"[{code}] no base_url -> skip")
                continue
            models_url = base.rstrip("/")
            if models_url.endswith(("/v1", "/openai", "/v4")):
                models_url += "/models"
            else:
                models_url += "/v1/models"
            try:
                resp = await client.get(models_url, headers={"Authorization": f"Bearer {key}"})
                print(f"[{code}] {models_url} -> HTTP {resp.status_code} ({len(resp.content)} bytes)")
            except Exception as e:
                print(f"[{code}] {models_url} -> EXC {type(e).__name__}: {str(e)[:120]}")


if __name__ == "__main__":
    asyncio.run(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
