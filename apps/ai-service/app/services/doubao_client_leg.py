# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""豆包「客户端内发起」写腿(2026-11-18 立)。

背景(2026-11-18 实证):豆包 campaign 的写接口(checkin / reward claim)在纯 HTTP
与页面裸 fetch 下恒返回 710010702,即使 body 完全正确。抓包证明客户端对 campaign
的每个请求都带 msToken + a_bogus(按 query/body/UA 现算),由客户端自己的请求层注入;
裸 fetch 绕过该层 ⇒ 写必被拦。故写腿必须由**客户端页面自己的 API 模块**发起。

实现:拉起一个独立 user-data-dir 的豆包实例(每账号一份目录 = 稳定且互异的设备指纹,
可选 --proxy-server 绑定该账号独占出口 IP),用 CDP 注入该账号 cookie,再调用页面内
rspack 模块 f6O(initApiService("ugCampaign"))的 DailyCheckIn。

对外契约与其它平台一致:返回 {ok, status, action, code, message, http_status,
credits, credits_delta} 的子集,由 doubao_checkin_account 合并进统一结果。
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Final

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)

DEFAULT_CLIENT_EXE: Final = r"E:\Software\Doubao\app\Doubao.exe"
_REPO_NODE_SCRIPT: Final = Path(__file__).resolve().parents[4] / "scripts" / "doubao-client-checkin.mjs"
_LEG_ROOT_ENV: Final = "DOUBAO_CLIENT_LEG_DIR"
_LAUNCH_TIMEOUT: Final = 25.0
_RUN_TIMEOUT: Final = 170.0
_PAGE_WAIT_MS: Final = "18000"


def _client_exe() -> str:
    return os.environ.get("DOUBAO_CLIENT_EXE", DEFAULT_CLIENT_EXE)


def _leg_dir(account_key: str) -> Path:
    root = Path(os.environ.get(_LEG_ROOT_ENV) or (Path(tempfile.gettempdir()) / "doubao-leg"))
    safe = "".join(ch for ch in account_key if ch.isalnum() or ch in "-_")[:40] or "acct"
    path = root / safe
    path.mkdir(parents=True, exist_ok=True)
    return path


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _proxy_arg(proxy: str) -> str | None:
    """device_map.proxy → Chromium --proxy-server 取值。"""
    p = (proxy or "").strip()
    return p or None


def _launch(exe: str, profile_dir: Path, port: int, proxy: str | None) -> subprocess.Popen[bytes]:
    args = [
        exe,
        f"--user-data-dir={profile_dir}",
        f"--remote-debugging-port={port}",
        "--no-first-run",
        "--no-default-browser-check",
    ]
    if proxy:
        args.append(f"--proxy-server={proxy}")
        # 客户端页面与本机 bridge 走 127.0.0.1,不能被代理劫持,否则整页空白
        args.append("--proxy-bypass-list=127.0.0.1;localhost;<local>")
    return subprocess.Popen(
        args,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )


async def _wait_port(port: int, deadline_s: float) -> bool:
    end = time.monotonic() + deadline_s
    while time.monotonic() < end:
        try:
            async with httpx.AsyncClient(timeout=2.0) as c:
                r = await c.get(f"http://127.0.0.1:{port}/json/version")
                if r.status_code == 200:
                    return True
        except Exception:
            await asyncio.sleep(0.8)
    return False


def _kill_tree(pid: int) -> None:
    subprocess.run(
        ["taskkill", "/PID", str(pid), "/T", "/F"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )


async def client_checkin(
    account_key: str,
    cookie_header: str,
    *,
    proxy: str = "",
    scene: str = "pc_incentive_task_mvp_v3",
    timeout: float = _RUN_TIMEOUT,
) -> dict[str, Any]:
    """客户端实例内发起签到。返回 {code, message, ok, status, action}。"""
    exe = _client_exe()
    if not Path(exe).exists():
        return {"code": None, "message": f"客户端不存在: {exe}", "ok": False, "action": "checkin"}
    node = shutil.which("node")
    if not node:
        return {"code": None, "message": "未找到 node,无法驱动 CDP", "ok": False, "action": "checkin"}
    if not _REPO_NODE_SCRIPT.exists():
        return {"code": None, "message": f"CDP 脚本缺失: {_REPO_NODE_SCRIPT}", "ok": False, "action": "checkin"}

    profile = _leg_dir(account_key)
    port = _free_port()
    proc = _launch(exe, profile, port, _proxy_arg(proxy))
    cookie_file = Path(tempfile.gettempdir()) / f".doubao-leg-{os.getpid()}-{port}.ck"
    try:
        if not await _wait_port(port, _LAUNCH_TIMEOUT):
            return {"code": None, "message": "客户端调试端口未就绪", "ok": False, "action": "checkin"}
        cookie_file.write_text(cookie_header, encoding="utf-8")
        run = subprocess.run(
            [node, str(_REPO_NODE_SCRIPT), "--port", str(port), "--cookie-file", str(cookie_file), "--scene", scene, "--wait", _PAGE_WAIT_MS],
            capture_output=True,
            text=True,
            timeout=timeout,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        raw = (run.stdout or "").strip().splitlines()
        payload = next((ln for ln in reversed(raw) if ln.startswith("{")), "")
        if not payload:
            return {
                "code": None,
                "message": f"CDP 无输出(rc={run.returncode}): {(run.stderr or '')[:200]}",
                "ok": False,
                "action": "checkin",
            }
        data: dict[str, Any] = json.loads(payload)
        code = data.get("code")
        ok = code == 0
        return {
            "code": code,
            "message": str(data.get("message") or ""),
            "ok": ok,
            "status": "ok" if ok else "fail",
            "action": "claim_ok" if ok else "checkin",
            "detail_code": data.get("detailCode"),
        }
    except subprocess.TimeoutExpired:
        return {"code": None, "message": "客户端内签到超时", "ok": False, "action": "checkin"}
    finally:
        try:
            _kill_tree(proc.pid)
        except Exception:  # noqa: BLE001 - 清理失败不影响结果
            logger.warning("[doubao-leg] 结束实例失败 pid=%s", proc.pid)
        cookie_file.unlink(missing_ok=True)


__all__ = ["client_checkin"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
