# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""构建本地单机引擎可执行文件(阶段 3 产品化打包,开发机执行)。

用法(仓库根或 apps/ai-service 下):
    python scripts/build-local-engine.py

前置:
- 在 apps/ai-service 已建好 .venv 并 `pip install -e .`(含 pyinstaller);
- pyinstaller 未装时本脚本给出安装提示后退出,不自动安装(避免越权装包)。

产物:apps/ai-service/dist/ihui-local-engine[.exe]
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

AI_SERVICE = Path(__file__).resolve().parent.parent / "apps" / "ai-service"
SPEC = AI_SERVICE / "local-engine.spec"


def _find_venv_python() -> Path | None:
    """定位 apps/ai-service/.venv 的解释器(Windows/Linux 都认)。"""
    for rel in ((".venv", "Scripts", "python.exe"), (".venv", "bin", "python")):
        p = AI_SERVICE.joinpath(*rel)
        if p.exists():
            return p
    return None


def main() -> int:
    if not SPEC.exists():
        print(f"[build] 找不到 spec: {SPEC}", file=sys.stderr)
        return 2

    py = _find_venv_python()
    if py is None:
        print(
            f"[build] 未找到 {AI_SERVICE}/.venv —— 请先在该目录建虚拟环境并 "
            f"`pip install -e . pyinstaller`",
            file=sys.stderr,
        )
        return 2

    # pyinstaller 必须已装在 venv;缺失时提示,不自动安装。
    probe = subprocess.run(
        [str(py), "-c", "import PyInstaller; print(PyInstaller.__version__)"],
        capture_output=True,
        text=True,
    )
    if probe.returncode != 0:
        print(
            "[build] .venv 里没有 PyInstaller。请运行:\n"
            f"    {py} -m pip install pyinstaller",
            file=sys.stderr,
        )
        return 2
    print(f"[build] PyInstaller {probe.stdout.strip()} · venv={py}")

    env = os.environ.copy()
    # 确保打包进的是本地单机入口语义(实际值由 local_entry 在运行时 setdefault,
    # 这里只设给 PyInstaller 收集 env 用,不影响产物默认行为)。
    env.setdefault("AI_DEV_NO_AUTH", "1")

    cmd = [str(py), "-m", "PyInstaller", str(SPEC), "--noconfirm", "--clean"]
    print("[build] 运行:", " ".join(cmd))
    rc = subprocess.run(cmd, cwd=str(AI_SERVICE), env=env).returncode
    if rc != 0:
        print(f"[build] PyInstaller 失败 exit={rc}", file=sys.stderr)
        return rc

    name = "ihui-local-engine.exe" if os.name == "nt" else "ihui-local-engine"
    out = AI_SERVICE / "dist" / name
    print(f"[build] 产物: {out} ({'存在' if out.exists() else '缺失!'})")
    return 0 if out.exists() else 3


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
