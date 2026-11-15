# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""运行时合规临时根(AGENTS.md §15b 运行时对偶)—— ai-service 单一真相源。

问题:各服务模块散落 ``tempfile.mkdtemp / NamedTemporaryFile / TemporaryDirectory``,
默认落点随 TMPDIR/TEMP 环境变量漂,可能钉在 ``C:\\Users\\...\\AppData\\Local\\Temp``,
导致 agent 运行时把中间文件外泄到项目文件夹之外。

根治:服务启动早期把 ``tempfile.tempdir`` 整体重定向到仓树内 ``<仓根>/.DevEnv/tmp``
(已被 .gitignore 覆盖、不写 C 盘、普通用户可写、不依赖 TEMP 变量)。
2026-11-15 收口:旧设计用 ``~/.ihui/tmp``(junction 到 D:\\DevEnv\\cache\\userhome\\.ihui\\tmp),
虽不写 C 盘却落在项目文件夹之外;现按「所有文件都在项目文件夹内」要求改到仓内。
一处改动覆盖全仓 Python ``tempfile.*`` 调用,各模块无需逐处改。

与 TS 侧的单一真相源 ``@ihui/shared`` temp-root.ts 落点保持一致
(同为仓树内 ``.DevEnv/tmp``),两个运行时端共用同一个合规根,不漂移。
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
import tempfile

logger = logging.getLogger(__name__)


def get_runtime_temp_root() -> Path:
    """运行时合规临时根的绝对路径(纯计算,不建目录):仓树内 ``.DevEnv/tmp``。

    仓根推导:本文件位于 apps/ai-service/app/core/,向上 4 层即仓根
    (core→app→ai-service→apps→仓根);
    用 __file__ 自身位置推导(禁 process.cwd(),共享工作区 cwd 不可靠,
    AGENTS §15b 铁律)。
    """
    repo_root = Path(__file__).resolve().parents[4]
    return repo_root / ".DevEnv" / "tmp"


def install_runtime_temp_root() -> Path:
    """确保合规临时根存在,并把 ``tempfile`` 全局重定向过去(幂等)。

    必须在服务启动最早点调用(早于任何业务模块首次 ``tempfile`` 调用)。
    失败抛错而非静默回落 —— 绝不因建目录失败退回系统 TEMP(会外泄)。
    测试环境(IHUI_TEST=1)跳过重定向,避免污染单测的 tmp_path fixture。
    """
    if os.environ.get("IHUI_TEST") == "1":
        logger.info("[runtime-temp] IHUI_TEST=1,跳过 tempfile 重定向")
        return get_runtime_temp_root()
    root = get_runtime_temp_root()
    root.mkdir(parents=True, exist_ok=True)
    # 同时设环境变量与 tempfile.tempdir:覆盖「读 env」与「读 tempfile.tempdir」两类取值
    for _key in ("TMPDIR", "TEMP", "TMP"):
        os.environ[_key] = str(root)
    tempfile.tempdir = str(root)
    logger.info(f"[runtime-temp] tempfile 全局重定向到合规根: {root}")
    return root
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
