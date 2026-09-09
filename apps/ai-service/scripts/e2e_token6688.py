# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""token6688 全模态真实 key 端到端验收(拿到 key 后一条命令跑完全部模态)。

直接驱动 Token6688Provider 适配层(非裸 HTTP),与线上调用链同构:
  1. list_models()      免鉴权模型目录(112 模型)          零成本
  2. get_balance()      余额("$49.96" → 数值)             零成本
  3. astream()          对话流式(gm-3.8-flash, max_tokens=8) 近零成本
  4. tts()              语音合成(tts-1-hd, 短文本 mp3)      近零成本
  5. list_voices()      声纹列表                            零成本
  --- 以下为付费项(默认需要确认;--cheap 跳过) ---
  6. generate_image()   图片生成(gpt-image-2, 40-50s)      付费(分级)
  7. generate_music(wait=False) + get_task_status()        付费
     音乐提交即返 task_id,轮询至成片(官方 1~5 分钟)
  8. generate_video(wait=False) + get_task_status()        付费
     视频提交即返 task_id + 立即查询一次(成片 4~40 分钟,不等待;
     稍后可对 AI 说"视频好了吗 <task_id>"取件)

key 解析优先级:--key 参数 > 环境变量 TOKEN6688_API_KEY > .env(TOKEN6688_API_KEY=
或 LLM_PROVIDERS JSON 的 token6688.api_key)。

用法:
    .venv/Scripts/python.exe scripts/e2e_token6688.py             # 全矩阵(付费项需确认)
    .venv/Scripts/python.exe scripts/e2e_token6688.py --cheap     # 仅 1~5(近零成本)
    .venv/Scripts/python.exe scripts/e2e_token6688.py --yes       # 全矩阵且跳过确认
    .venv/Scripts/python.exe scripts/e2e_token6688.py --key sk-xx # 临时 key(不落盘)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.providers.base_provider import ProviderError  # noqa: E402
from app.providers.token6688_provider import Token6688Provider  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"


def _load_key_from_env_file() -> str:
    """从 .env 解析 key:TOKEN6688_API_KEY= 行,或 LLM_PROVIDERS JSON token6688.api_key。"""
    if not ENV_PATH.exists():
        return ""
    try:
        text = ENV_PATH.read_text(encoding="utf-8")
    except OSError:
        return ""
    for line in text.splitlines():
        if line.startswith("TOKEN6688_API_KEY=") and line.split("=", 1)[1].strip():
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    for line in text.splitlines():
        if line.startswith("LLM_PROVIDERS="):
            try:
                raw = line.split("=", 1)[1].strip()
                # .env 值可能被引号包裹
                if raw and raw[0] in "\"'" and raw[-1] == raw[0]:
                    raw = raw[1:-1]
                providers = json.loads(raw)
                key = (providers.get("token6688") or {}).get("api_key") or ""
                return key.strip()
            except (json.JSONDecodeError, AttributeError):
                return ""
    return ""


def _resolve_key(cli_key: str) -> str:
    return cli_key or os.environ.get("TOKEN6688_API_KEY", "").strip() or _load_key_from_env_file()


# ---------------------------------------------------------------------------
# 各模态验收步骤(返回 (是否通过, 摘要))
# ---------------------------------------------------------------------------


async def step_models(p: Token6688Provider) -> tuple[bool, str]:
    models = await p.list_models()
    chat_n = sum(1 for m in models if m.get("capabilities") and "text" in (m["capabilities"] or []))
    return len(models) >= 50, f"{len(models)} 个模型(chat≈{chat_n}), api_base={p.base_url}"


async def step_balance(p: Token6688Provider) -> tuple[bool, str]:
    bal = await p.get_balance()
    avail = bal.get("available_balance") or bal.get("balance")
    return avail is not None, f"可用余额={avail}, frozen={bal.get('frozen')}"


async def step_chat(p: Token6688Provider) -> tuple[bool, str]:
    pieces: list[str] = []
    async for ev in p.astream(
        [{"role": "user", "content": "只回复两个字:正常"}], "gm-3.8-flash", max_tokens=16,
    ):
        if ev.get("type") == "chunk":
            pieces.append(ev["content"])
        elif ev.get("type") == "error":
            return False, f"流式错误: {ev.get('message')}"
    text = "".join(pieces).strip()
    return bool(text), f"流式回复={text[:40]!r}"


async def step_tts(p: Token6688Provider) -> tuple[bool, str]:
    audio, ctype = await p.tts("你好,这是语音合成验收测试。", voice="alloy", response_format="mp3")
    ok = len(audio) > 1000 and "audio" in ctype.lower()
    return ok, f"{len(audio)} 字节 {ctype}, 头部={audio[:4]!r}"


async def step_voices(p: Token6688Provider) -> tuple[bool, str]:
    voices = await p.list_voices()
    return isinstance(voices, list), f"声纹 {len(voices)} 条(未上传过为空列表属正常)"


async def step_image(p: Token6688Provider) -> tuple[bool, str]:
    result = await p.generate_image("a single red apple on a white table, photo", size="1024x1024")
    img = result["images"][0]
    url = img.get("url") or ""
    summary = url[:80] if url else f"b64_json({len(img.get('b64_json') or '')} 字符)"
    return True, f"model={result['model']}, 产物={summary}"


async def step_music(p: Token6688Provider) -> tuple[bool, str]:
    submitted = await p.generate_music(
        "轻快的钢琴短旋律", mode="instrumental", wait=False,
    )
    task_id = submitted["task_id"]
    # 官方音乐 1~5 分钟 → E2E 最多等 420s
    deadline = time.monotonic() + 420
    delay = 5.0
    st: dict[str, Any] = {}
    while True:
        st = await p.get_task_status(task_id)
        if st["ok"] or st["failed"] or time.monotonic() > deadline:
            break
        await asyncio.sleep(delay)
        delay = min(delay * 1.3, 10.0)
    if st["ok"]:
        return True, f"task={task_id}, 音频={st['video_url'][:80]}"
    if st["failed"]:
        return False, f"task={task_id} 失败: {st.get('error')}"
    return False, f"task={task_id} 420s 未出片(status={st['status']}),稍后用任务查询取件"


async def step_video(p: Token6688Provider) -> tuple[bool, str]:
    submitted = await p.generate_video(
        "一只橘猫在窗台晒太阳,镜头缓慢推进", "seedance-2-5", duration=4, wait=False,
    )
    task_id = submitted["task_id"]
    st = await p.get_task_status(task_id)  # 立即查一次:验证任务可查询,不等成片
    ok = bool(task_id) and st["status"] in ("pending", "processing", "submitted", "queued", "")
    return ok, (
        f"task={task_id}, status={st['status']}(成片需 4~40 分钟,"
        f"稍后运行本脚本的 --status {task_id} 或对 AI 说\"视频好了吗 {task_id}\"取件)"
    )


async def step_video_status(p: Token6688Provider, task_id: str) -> tuple[bool, str]:
    st = await p.get_task_status(task_id)
    if st["ok"]:
        return True, f"成片直链: {st['video_url']}"
    return st["status"] != "failed", f"status={st['status']} progress={st.get('progress')} (未终态属正常)"


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

CHEAP_STEPS = [
    ("模型目录(免鉴权)", step_models),
    ("余额查询", step_balance),
    ("对话流式(gm-3.8-flash)", step_chat),
    ("语音合成 TTS", step_tts),
    ("声纹列表", step_voices),
]
PAID_STEPS = [
    ("图片生成(gpt-image-2, ~40-50s)", step_image),
    ("音乐生成(Suno, 1~5 分钟)", step_music),
    ("视频生成提交(seedance-2-5)", step_video),
]


async def main() -> int:
    parser = argparse.ArgumentParser(description="token6688 全模态真实 key E2E 验收")
    parser.add_argument("--key", default="", help="临时 key(不落盘;默认读 .env)")
    parser.add_argument("--cheap", action="store_true", help="仅近零成本项(跳过图片/音乐/视频)")
    parser.add_argument("--yes", action="store_true", help="付费项跳过确认")
    parser.add_argument("--status", default="", help="只查询指定视频/音乐任务状态后退出")
    args = parser.parse_args()

    key = _resolve_key(args.key)
    if not key:
        print("未找到 token6688 key。请在 .env 配置 TOKEN6688_API_KEY=sk-xxx 后重跑,")
        print("或临时传入:python scripts/e2e_token6688.py --key sk-xxx")
        return 2
    p = Token6688Provider(api_key=key)
    if args.status:
        ok, msg = await step_video_status(p, args.status)
        print(f"[{'PASS' if ok else 'FAIL'}] 任务 {args.status}: {msg}")
        return 0 if ok else 1

    print(f"token6688 全模态 E2E 验收 · base={p.base_url} · key=***{key[-6:]}")
    print(f"模式: {'--cheap(近零成本)' if args.cheap else '全矩阵(含付费项)'}\n")

    if not args.cheap and not args.yes:
        print("付费项:图片 1 张 + 音乐 1 首 + 视频 1 条(最小参数),按平台价目计费。")
        try:
            confirm = input("继续? [y/N] ").strip().lower()
        except EOFError:
            confirm = ""
        if confirm != "y":
            print("已取消付费项;可加 --cheap 只跑零成本项。")
            return 2
        print()

    failures: list[str] = []
    steps = CHEAP_STEPS if args.cheap else CHEAP_STEPS + PAID_STEPS
    for name, fn in steps:
        try:
            ok, msg = await fn(p)
        except ProviderError as e:
            ok, msg = False, f"ProviderError: {e}"
        except Exception as e:  # noqa: BLE001 — E2E 顶层兜底,不让单步异常中断矩阵
            ok, msg = False, f"{type(e).__name__}: {e}"
        if not ok:
            failures.append(name)
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {msg}")

    print()
    if failures:
        print(f"验收失败 {len(failures)} 项: {failures}")
        return 1
    print("全模态验收通过:单 key 覆盖 目录/余额/对话/TTS/声纹" + ("" if args.cheap else "/图片/音乐/视频") + "。")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
