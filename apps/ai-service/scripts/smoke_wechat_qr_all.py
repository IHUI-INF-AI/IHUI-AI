# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""9 个微信码平台全链路出码冒烟测试(2026-09-30)。

与运行时同一码路径:create_task → 后台线程真浏览器出码 → 轮询 waiting_scan+has_qr
→ get_qr_image 取 PNG 验证(字节头 + 尺寸阈值) → cancel 清理浏览器。

用法:cd apps/ai-service && .venv/Scripts/python.exe scripts/smoke_wechat_qr_all.py
"""

from __future__ import annotations

import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# 以脚本自身位置定位 ai-service 根(不硬编码盘符,任意检出路径均可跑)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.scan_login import (  # noqa: E402
    cancel_scan_task,
    get_qr_image,
    get_task,
    start_scan_task,
)

TEST_USER = "qr-smoke-test"
PLATFORMS = (
    "toutiao",
    "bilibili",
    "csdn",
    "weibo",
    "xiaohongshu",
    "douban",
    "baidu_zhidao",
    "baidu_tieba",
    "sina",
)
WAIT_QR_SECONDS = 80


def check_png(raw: bytes | None) -> str:
    if not raw:
        return "0B (empty)"
    head_ok = raw[:4] == b"\x89PNG"
    return f"{len(raw)}B png={'yes' if head_ok else 'NO'}"


def probe(platform: str) -> str:
    # start_scan_task:create + 启动后台线程(_run_scan_task 真浏览器出码)
    task = start_scan_task(TEST_USER, platform)
    tid = task.task_id
    deadline = time.time() + WAIT_QR_SECONDS
    status, msg, has_qr = "pending", "", False
    try:
        while time.time() < deadline:
            cur = get_task(tid)
            if cur is None:
                return f"{platform}: TASK_LOST"
            status, msg, has_qr = cur.status, cur.message, bool(cur.qr_image_b64)
            if status == "waiting_scan" and has_qr:
                png = get_qr_image(tid)
                detail = check_png(png)
                return f"{platform}: OK status={status} qr={detail}"
            if cur.is_terminal():
                return f"{platform}: FAIL status={status} msg={msg[:80]}"
            time.sleep(2.0)
        return f"{platform}: TIMEOUT waited={WAIT_QR_SECONDS}s last={status} msg={msg[:60]}"
    finally:
        cancel_scan_task(tid)


def main() -> None:
    print(f"smoke start: {len(PLATFORMS)} platforms, parallel=3", flush=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        for line in pool.map(probe, PLATFORMS):
            print(line, flush=True)
    print("smoke done", flush=True)


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
