# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""token6688 端点活体冒烟矩阵(零成本,无需真实 key)。

原理:假 key 请求 → 401/403 = 端点存在且走鉴权层(接线正确);
     404/200+HTML = 端点路径错误(打到网站首页)。/v1/skills/models 免鉴权应 200。
用法:python scripts/smoke_token6688_endpoints.py
"""

import asyncio
import sys

import httpx

BASE = "https://k.token6688.com"
FAKE = {"Authorization": "Bearer sk-fake-smoke-test-no-cost"}

PROBES: list[tuple[str, str, dict, dict | None]] = [
    ("models 目录(免鉴权)", "GET", f"{BASE}/v1/skills/models", None),
    ("单模型参数(免鉴权)", "GET", f"{BASE}/v1/skills/models/seedance-2-5", None),
    ("跨渠道价格(免鉴权)", "GET", f"{BASE}/v1/skills/models/seedance-2-5/pricing", None),
    ("logical-models(免鉴权)", "GET", f"{BASE}/v1/logical-models", None),
    ("对话", "POST", f"{BASE}/v1/chat/completions",
     {"model": "gm-3.8-flash", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1}),
    ("Responses API", "POST", f"{BASE}/v1/responses", {"model": "gpt-5.4", "input": "hi"}),
    ("CL Messages 原生", "POST", f"{BASE}/v1/messages",
     {"model": "cl-sonnet-5", "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]}),
    ("CL count_tokens", "POST", f"{BASE}/v1/messages/count_tokens",
     {"model": "cl-sonnet-5", "messages": [{"role": "user", "content": "hi"}]}),
    ("legacy completions", "POST", f"{BASE}/v1/completions",
     {"model": "gm-3.8-flash", "prompt": "hi", "max_tokens": 1}),
    ("图片-同步", "POST", f"{BASE}/v1/images/generations",
     {"model": "gpt-image-2", "prompt": "hi"}),
    ("统一媒体入口-信封", "POST", f"{BASE}/v1/media/generate",
     {"model": "veo-3.1", "prompt": "hi", "params": {"aspect_ratio": "16:9", "duration": 8}}),
    ("视频-扁平形状", "POST", f"{BASE}/v1/videos/generations",
     {"model": "seedance-2-5", "prompt": "hi", "mode": "text-to-video", "duration": 5}),
    ("音乐", "POST", f"{BASE}/v1/audio/generations",
     {"model": "music", "prompt": "hi", "mode": "instrumental", "operation": "generate"}),
    ("TTS-同步", "POST", f"{BASE}/v1/audio/speech",
     {"model": "tts-1-hd", "input": "hi", "voice": "alloy"}),
    ("TTS-异步声纹", "POST", f"{BASE}/v1/audio/speech/async",
     {"model": "tts-1-hd", "input": "hi", "voice": "alloy"}),
    ("估价", "POST", f"{BASE}/v1/pricing-estimate",
     {"model": "seedance-2-5", "prompt": "hi", "params": {"mode": "text-to-video", "duration": 5}}),
    ("任务轮询", "GET", f"{BASE}/v1/tasks/fake-id", None),
    ("任务状态速查", "GET", f"{BASE}/v1/skills/task-status?task_id=fake-id", None),
    ("余额", "GET", f"{BASE}/v1/skills/balance", None),
    ("音色列表", "GET", f"{BASE}/v1/audio/voices", None),
    ("单声纹查询", "GET", f"{BASE}/v1/audio/voices/fake-voice-id", None),
]


async def main() -> int:
    failures: list[str] = []
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
        for name, method, url, json_body in PROBES:
            try:
                if method == "GET":
                    resp = await client.get(url, headers=FAKE)
                else:
                    resp = await client.post(url, headers=FAKE, json=json_body)
                ctype = resp.headers.get("content-type", "")
                is_html = "text/html" in ctype
                # models 免鉴权 → 期望 200;其余 → 期望 401/403(端点存在,假 key 被拒)
                expected_ok = resp.status_code == 200 if "models" in url else resp.status_code in (401, 403)
                verdict = "PASS" if (expected_ok and not is_html) else "FAIL"
                if verdict == "FAIL":
                    failures.append(name)
                body_hint = ""
                if resp.status_code == 200 and "models" in url:
                    try:
                        n = len(resp.json().get("models") or [])
                        body_hint = f" models={n}"
                    except ValueError:
                        body_hint = " json-parse-fail"
                elif resp.status_code not in (401, 403):
                    body_hint = f" {resp.text[:80]!r}"
                print(f"[{verdict}] {name}: HTTP {resp.status_code} {ctype.split(';')[0]}{body_hint}")
            except httpx.HTTPError as e:
                failures.append(name)
                print(f"[FAIL] {name}: 网络异常 {type(e).__name__}: {e}")
    print()
    if failures:
        print(f"冒烟失败 {len(failures)} 项: {failures}")
        return 1
    print("全部端点接线正确:免鉴权目录 200,其余 401(端点存在,等待真实 key)。")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
