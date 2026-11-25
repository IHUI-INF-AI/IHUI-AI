# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MAGI-2 真实出片冒烟(会真实计费,默认只试算不提交)。

沙箱/生产把 MAGI2_API_KEY 配好后跑:
    python scripts/smoke_magi2.py --yes
默认 4 秒(官方 0.08 USD/s,约 0.32 美元);30 秒约 2.4 美元。
脚本只提交 + 轮询,不下载成片;拿到 URL 后请在一个小时内转存。
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.providers.base_provider import ProviderError  # noqa: E402
from app.providers.magi2_provider import Magi2Provider  # noqa: E402


async def _run(args: argparse.Namespace) -> int:
    p = Magi2Provider(None, args.base, model=args.model)
    if not p.configured:
        print("[skip] 未配置 MAGI2_API_KEY / SAND_API_KEY,不发起请求")
        return 2

    estimate = args.duration * 0.08
    print(
        f"[plan] model={p.model} base={p.base_url} duration={args.duration}s "
        f"ratio={args.aspect_ratio} audio={not args.no_audio} 预估 ${estimate:.2f}"
    )
    if not args.yes:
        print("[dry-run] 加 --yes 才会真实提交(会产生费用)")
        return 0

    kwargs: dict[str, object] = {
        "duration": args.duration,
        "aspect_ratio": args.aspect_ratio,
        "generate_audio": not args.no_audio,
        "wait": False,
    }
    if args.image:
        kwargs["image"] = args.image
    if args.seed is not None:
        kwargs["seed"] = args.seed
    try:
        sub = await p.generate_video(args.prompt, "", **kwargs)
    except ProviderError as e:
        print(f"[fail] 提交失败: {e}")
        return 1

    task_id = str(sub.get("task_id") or "")
    print(f"[submit] task_id={task_id} status={sub.get('status')}")
    deadline = time.monotonic() + args.max_wait
    last = ""
    while time.monotonic() < deadline:
        await asyncio.sleep(args.interval)
        try:
            st = await p.get_task_status(task_id)
        except Exception as e:  # noqa: BLE001
            print(f"[poll] 查询异常(继续): {e}")
            continue
        status = str(st.get("status") or "")
        if status != last:
            print(f"[poll] {status}")
            last = status
        if st.get("ok") and st.get("video_url"):
            print(f"[ok] {st['video_url']}")
            print("[note] 链接 1 小时内有效,请尽快转存")
            return 0
        if st.get("failed"):
            print(f"[fail] {st.get('error')}")
            return 1
    print(f"[timeout] 超过 {args.max_wait}s 未完成,task_id={task_id}")
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description="MAGI-2 真实出片冒烟")
    ap.add_argument("--prompt", default="黄昏的海边,镜头缓慢推近,海浪拍打礁石")
    ap.add_argument("--duration", type=int, default=4, choices=range(4, 31))
    ap.add_argument("--aspect-ratio", default="16:9")
    ap.add_argument("--image", default="", help="首帧图公网 URL(可选)")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--model", default=os.environ.get("MAGI2_MODEL", "magi-2"))
    ap.add_argument("--base", default=os.environ.get("MAGI2_API_BASE", "https://api.sand.ai"))
    ap.add_argument("--interval", type=float, default=5.0)
    ap.add_argument("--max-wait", type=float, default=900.0)
    ap.add_argument("--yes", action="store_true", help="确认真实提交并产生费用")
    return asyncio.run(_run(ap.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
