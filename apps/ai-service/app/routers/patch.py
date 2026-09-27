# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex 风格补丁引擎 HTTP 路由(深度引擎接线,2026-09-06 立)。

挂载方式(main.py):
    app.include_router(patch.router, prefix="/api", tags=["patch"])

端点:
- POST /api/patch/preview → dry_run 预览:只做匹配计算与语法校验,不写盘。
- POST /api/patch/apply   → 事务性应用:多文件全成或全回滚。

安全:
- workspace root **不再由请求方自订**:根目录必须落在服务端登记的允许集合内
  (唯一来源 = 配置键 ``MCP_WORKSPACE_ROOTS``,见下 ``_allowed_workspace_roots``)。
  修复前只验"绝对路径且存在",于是任何已登录用户都能拿服务器**任意文件路径**
  当 root 去写/改(跨用户写服务器文件、越出工作区);
- 引擎自身再做一次 root 越界防护(补丁声明的路径不得逃逸 root);
- 引擎的 PatchError(解析/匹配/校验/越界)统一折算为 ok=False + error 文本
  (HTTP 仍 200,便于调用方读取结构化失败原因);非法 root 参数 → 400;
  root 不在允许集合内 → **403**(授权拒绝,与"参数格式不对"区分)。

审计:补丁应用会改服务器磁盘上的真实文件,因此每次调用(含被拒的越界尝试)都带
** actor = 已验证身份** 落一行日志 —— 工作区是多个用户共享的,这一行是本端点上
唯一能把"谁改了这批文件"对上的记录。它是**归因**不是**判定**:判定由允许集合做。
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.jwt_auth import get_current_user_id
from app.services.patch_engine import apply_patch

router = APIRouter(prefix="/patch", tags=["patch"])
logger = logging.getLogger(__name__)


class PatchRequest(BaseModel):
    """补丁预览/应用请求体。"""

    patch: str = Field(..., min_length=1, description="Codex 风格补丁文本(Begin/End Patch)")
    root: str = Field(
        ...,
        min_length=1,
        description=(
            "workspace root 绝对路径,且必须落在服务端允许的工作区集合内"
            "(配置键 MCP_WORKSPACE_ROOTS);补丁内所有路径以此为基准且不得越界"
        ),
    )


def _allowed_workspace_roots() -> list[Path]:
    """允许作为 patch root 的目录集合 —— **唯一来源:配置键 MCP_WORKSPACE_ROOTS**。

    取源刻意不在本端点重抄一份解析逻辑:全仓那一份实现在
    ``app/services/mcp_server.py`` 的 ``_get_workspace_roots()``(:409-412,
    os.pathsep 分隔 + 延迟读 os.environ 以避免"模块导入早于 main.py 同步 env"那个
    历史 bug)。同一个键在仓里已有 ``file_editor._resolve_workspace_roots`` 抄过
    一份,``path_guard.py`` 头注把这一型("同一约束、多份真源")记为事故根因,
    所以这里宁可依赖一次跨模块调用,也不加第三份实现。

    依据(默认值不是猜的):
    - ``app/core/config.py:170-171`` 定义该键并写明"空=用当前工作目录";
    - ``app/services/mcp_server.py:411`` ``raw = os.environ.get("MCP_WORKSPACE_ROOTS",
      os.getcwd())`` —— 即今天所有合法调用方实际用的就是**服务进程的工作区目录**;
    - ``app/main.py:154`` 把 settings 的该键同步进 os.environ。

    取不到集合时 **fail-closed**(503),绝不退化成"不限制"—— 那等于把本票修的
    那一格以另一种方式放回去。
    """
    try:
        from app.services.mcp_server import _get_workspace_roots

        raw_roots = _get_workspace_roots()
    except Exception as e:  # pragma: no cover - 依赖面故障(mcp_server 导入不了)
        logger.error("patch: 无法确定允许的工作区根目录,已拒绝: %s", e, exc_info=True)
        raise HTTPException(
            status_code=503, detail="无法确定允许的工作区根目录,补丁请求已被拒绝"
        ) from None
    if not raw_roots:
        raise HTTPException(
            status_code=503, detail="服务端未登记任何允许的工作区根目录,补丁请求已被拒绝"
        )
    # resolve():白名单自己也要解析 symlink,否则 "允许根目录的一个软链接" 会绕过对账
    return [Path(r).resolve(strict=False) for r in raw_roots]


def _validated_root(raw: str) -> Path:
    """校验 workspace root:绝对路径 → 落在允许集合内 → 是真实存在的目录。

    判序是**先白名单、后存在性**:反过来会让这个端点变成一个"服务器路径是否存在"
    的预言机(400 说"目录不存在"、200/引擎错误说"存在"),而越界探测本就该被拒。
    """
    root = Path(raw)
    if not root.is_absolute():
        raise HTTPException(status_code=400, detail="root 必须是绝对路径")
    resolved = root.resolve(strict=False)
    allowed = _allowed_workspace_roots()
    # root 必须 **等于或深于** 某条允许根:允许根的祖先目录(如 "/" 或仓库根)一律拒,
    # 因为它比授予的范围更宽 —— 这正是"越出工作区"的入口。
    if not any(resolved == a or resolved.is_relative_to(a) for a in allowed):
        raise HTTPException(
            status_code=403,
            detail=(
                f"root 不在服务端允许的工作区内: {raw}"
                "(允许集合见配置键 MCP_WORKSPACE_ROOTS)"
            ),
        )
    if not resolved.is_dir():
        raise HTTPException(status_code=400, detail=f"root 目录不存在: {raw}")
    return resolved


def _run(body: PatchRequest, *, dry_run: bool, actor: str) -> dict[str, Any]:
    """执行补丁引擎并包装为统一响应信封 {code, message, data}。

    ``actor`` 必须是承载层传进来的已验证身份(不得从请求体自报字段取,AGENTS §5
    "认证不等于授权"那条同源规矩);它进日志,用于共享工作区上的写操作归因。
    """
    kind = "preview" if dry_run else "apply"
    try:
        root = _validated_root(body.root)
    except HTTPException as e:
        # 被拒的 root 同样是"某人试图让服务端到某个目录去写"的证据,必须报名字
        logger.warning(
            "patch %s 被拒 actor=%s root=%s reason=%s", kind, actor, body.root, e.detail
        )
        raise
    result = apply_patch(body.patch, root, dry_run=dry_run)
    payload = result.to_dict()
    if not result.ok:
        logger.info(
            "patch %s 失败 actor=%s root=%s error=%s", kind, actor, root, result.error,
        )
    elif not dry_run:
        # 只有 apply 真的动盘;preview 不打"已应用",免得日志读起来像已写
        logger.info("patch %s 已应用 actor=%s root=%s", kind, actor, root)
    return {
        "code": 0,
        "message": "ok" if result.ok else "补丁未通过,详见 data.error",
        "data": payload,
    }


@router.post("/preview")
def preview_patch(
    body: PatchRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """dry_run 预览补丁:返回逐文件 hunk 匹配策略/置信度,不落盘。"""
    return _run(body, dry_run=True, actor=user_id)


@router.post("/apply")
def apply_patch_endpoint(
    body: PatchRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """事务性应用补丁:任一文件失败则整批回滚;越界路径与越出工作区的 root 直接拒绝。"""
    return _run(body, dry_run=False, actor=user_id)


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
