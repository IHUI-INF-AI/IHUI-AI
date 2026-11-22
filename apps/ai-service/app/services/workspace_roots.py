# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工作区登记根白名单 —— 服务端唯一的「这条路径允许被碰」判据(Python 侧单源)。

对齐 apps/api/src/utils/workspace-roots.ts(同一 env 键 ``IHUI_WORKSPACE_ROOTS``,
同一 fail-closed 语义):workspacePath 不能是客户端自报字符串 —— 传 ``workspacePath="/"``
会让「file 落在工作区内」这条判据自我成立。白名单不能来自请求体 ⇒ 只能来自服务端 env。
未配置 ⇒ 空列表 ⇒ 一切路径都拒绝(fail-closed),错误文案只说清"要改哪个旋钮"。

2026-10-31 安全强化第 11 批立:LSP 面(任意文件读)与 knowledge compile(任意目录写)
是本判据在 ai-service 侧的两处消费方;新增暴露文件系统路径的端点必须复用本模块,
不得再抄一份。
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import HTTPException

WORKSPACE_ROOTS_ENV = "IHUI_WORKSPACE_ROOTS"


def registered_workspace_roots() -> list[str]:
    """服务端登记的根集合(全部已归一);env 未设 ⇒ 空列表。"""
    raw = os.environ.get(WORKSPACE_ROOTS_ENV, "")
    roots: list[str] = []
    for item in raw.replace(";", ",").split(","):
        trimmed = item.strip()
        if trimmed:
            roots.append(str(Path(trimmed).resolve(strict=False)))
    return roots


def is_inside_root(child: Path, root: str) -> bool:
    """``relative_to`` 判据:绝对路径、``..`` 回跳、盘符形态一次性覆盖。"""
    try:
        child.relative_to(root)
        return True
    except ValueError:
        return False


def assert_workspace_root(workspace_path: str, label: str = "工作区") -> str:
    """断言路径在任一登记根内,返回归一后的绝对路径;越界抛 400(HTTPException)。

    错误文案刻意不含任何服务器实际路径 —— 这些 detail 会被原样回吐给客户端。
    """
    roots = registered_workspace_roots()
    if not roots:
        raise HTTPException(
            status_code=400,
            detail=f"未启用:服务端未登记任何工作区根({WORKSPACE_ROOTS_ENV} 为空)",
        )
    real = Path(workspace_path).resolve(strict=False)
    for root in roots:
        if is_inside_root(real, root):
            return str(real)
    raise HTTPException(
        status_code=400,
        detail=f"{label}未在服务端登记:仅允许 {WORKSPACE_ROOTS_ENV} 白名单内的路径",
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
