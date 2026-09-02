# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""file_edit 工具:基于 old_string/new_string 模式的精细文件编辑。

对标 Trae Edit 工具 + Claude Code Edit tool。
比 mcp_server.write_file(整文件覆盖)更精细,适合大文件的局部修改。

行为契约(对标 Claude Code Edit tool):
- 文件不存在 + create_if_missing=True  → 创建新文件,内容=new_string
- 文件不存在 + create_if_missing=False → FILE_NOT_FOUND
- 文件存在 + 0 次命中                 → OLD_STRING_NOT_FOUND
- 文件存在 + 1 次命中                 → 替换并写回
- 文件存在 + >1 次 + replace_all=True → 全部替换
- 文件存在 + >1 次 + replace_all=False→ MULTIPLE_MATCHES

安全约束:
- 路径必须在 _WORKSPACE_ROOTS 白名单内(防 symlink 穿越)
- 路径不能在敏感目录黑名单(.git/node_modules/.venv/dist/build 等)
- 文件大小上限 1MB
- old_string 不能为空(new_string 可为空,用于删除代码)
- 替换前自动备份到 .trae-cn/tmp/file_edit_backup/<timestamp>/<filename>.bak
"""

from __future__ import annotations

import difflib
import logging
import os
import re
import shutil
import threading
import time
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 安全常量(与 mcp_server._WORKSPACE_ROOTS 同语义)
# ---------------------------------------------------------------------------

# 工作区根目录白名单:优先复用 mcp_server 的常量,失败则从 env 读取,再失败用 cwd
def _resolve_workspace_roots() -> list[str]:
    try:
        from .mcp_server import _WORKSPACE_ROOTS as mcp_roots  # type: ignore[attr-defined]
        if mcp_roots:
            return list(mcp_roots)
    except Exception as e:
        logger.debug("file_editor._resolve_workspace_roots 加载 mcp_server 常量失败: %s", e, exc_info=True)
    return [
        os.path.abspath(r)
        for r in os.environ.get("MCP_WORKSPACE_ROOTS", os.getcwd()).split(os.pathsep)
        if r.strip()
    ]


# 模块级常量(测试时可用 monkeypatch.setattr 替换)
_WORKSPACE_ROOTS: list[str] = _resolve_workspace_roots()

# 敏感目录黑名单(正则,匹配路径片段,防误改依赖/VCS/构建产物)
_SENSITIVE_DIR_PATTERNS = re.compile(
    r"(^|[\\/])(\.git|node_modules|\.venv|venv|dist|build|__pycache__|\.next)([\\/]|$)",
    re.IGNORECASE,
)

# 文件大小上限(1MB)
MAX_FILE_SIZE = 1 * 1024 * 1024

# 备份根目录(测试时可 monkeypatch 替换)
_BACKUP_ROOT = Path(".trae-cn/tmp/file_edit_backup")

# diff 最大行数(避免超长 diff 撑爆响应)
MAX_DIFF_LINES = 200

# 单 (session, 文件) 维度最多保留的文件版本数(余量保留,超出丢弃最旧)
MAX_FILE_VERSIONS = 20


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def validate_path(file_path: str) -> tuple[bool, str]:
    """校验路径在工作区白名单内 + 不在敏感目录黑名单。

    Returns:
        (True, resolved_path)  校验通过
        (False, error_message) 校验失败(message 含具体原因)
    """
    if not file_path:
        return False, "路径为空"
    try:
        resolved = Path(file_path).resolve(strict=False)
        resolved_str = str(resolved)
        # 黑名单优先(防 .git/node_modules 等敏感目录)
        if _SENSITIVE_DIR_PATTERNS.search(resolved_str):
            return False, f"路径在敏感目录黑名单内: {resolved_str}"
        # 白名单(防 symlink 穿越到 /etc/passwd 等)
        for root in _WORKSPACE_ROOTS:
            try:
                resolved.relative_to(root)
                return True, resolved_str
            except ValueError:
                continue
        return False, (
            f"路径不在工作区白名单内: {file_path}"
            f"(允许根目录: {_WORKSPACE_ROOTS})"
        )
    except Exception as e:
        logger.warning("file_editor.validate_path 路径解析失败: %s", e, exc_info=True)
        return False, f"路径解析失败: {e}"


def create_backup(file_path: str) -> str:
    """创建文件备份,返回备份文件路径。

    备份位置: _BACKUP_ROOT/<timestamp>/<filename>.<pid>.<nanos>.bak
    (pid + 纳秒后缀避免并发冲突)
    """
    src = Path(file_path)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_dir = _BACKUP_ROOT / timestamp
    backup_dir.mkdir(parents=True, exist_ok=True)
    # pid+nanos 后缀防并发冲突;但 Windows 上 time_ns 存在时序碰撞(两次调用
    # 落同一时间窗口),故对已存在路径追加序号兜底,保证唯一性。
    backup_path = backup_dir / f"{src.name}.{os.getpid()}.{time.time_ns()}.bak"
    seq = 1
    while backup_path.exists():
        backup_path = backup_dir / f"{src.name}.{os.getpid()}.{time.time_ns()}.{seq}.bak"
        seq += 1
    shutil.copy2(src, backup_path)
    return str(backup_path)


def generate_diff(old_content: str, new_content: str, file_path: str) -> str:
    """生成 unified diff,截断到前 MAX_DIFF_LINES 行。"""
    old_lines = old_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)
    diff = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile=f"a/{os.path.basename(file_path)}",
        tofile=f"b/{os.path.basename(file_path)}",
    )
    lines = list(diff)[:MAX_DIFF_LINES]
    return "".join(lines)


# ---------------------------------------------------------------------------
# 核心函数:edit_file
# ---------------------------------------------------------------------------


def edit_file(
    file_path: str,
    old_string: str,
    new_string: str,
    replace_all: bool = False,
    create_if_missing: bool = False,
) -> dict[str, Any]:
    """精细编辑文件:基于 old_string/new_string 模式。

    Args:
        file_path: 目标文件路径(必须在 _WORKSPACE_ROOTS 白名单内)
        old_string: 待替换的字符串(不能为空)
        new_string: 替换后的字符串(可为空,表示删除代码)
        replace_all: old_string 多次命中时是否全部替换(默认 False)
        create_if_missing: 文件不存在时是否创建新文件(默认 False)

    Returns:
        dict 统一响应格式:
        - 成功: {ok: True, action: "replaced"/"replaced_all"/"created", ...}
        - 失败: {ok: False, errorCode: "...", message: "..."}
    """
    # 1. 校验 old_string 非空(最先校验,避免无意义磁盘操作)
    if not old_string:
        return {
            "ok": False,
            "errorCode": "EMPTY_OLD_STRING",
            "message": "old_string 不能为空字符串",
        }

    # 2. 校验路径白名单 + 黑名单
    ok, info = validate_path(file_path)
    if not ok:
        return {
            "ok": False,
            "errorCode": "PATH_NOT_IN_WORKSPACE",
            "message": info,
        }
    resolved_path = info

    # 3. 文件不存在场景
    if not os.path.exists(resolved_path):
        if create_if_missing:
            try:
                Path(resolved_path).parent.mkdir(parents=True, exist_ok=True)
                with open(resolved_path, "w", encoding="utf-8") as f:
                    f.write(new_string)
            except PermissionError as e:
                return {
                    "ok": False,
                    "errorCode": "PERMISSION_DENIED",
                    "message": f"文件创建权限失败: {e}",
                }
            except OSError as e:
                return {
                    "ok": False,
                    "errorCode": "PERMISSION_DENIED",
                    "message": f"文件创建失败: {e}",
                }
            return {
                "ok": True,
                "action": "created",
                "file_path": resolved_path,
                "new_content_preview": new_string[:500],
            }
        return {
            "ok": False,
            "errorCode": "FILE_NOT_FOUND",
            "message": f"文件不存在: {resolved_path}",
        }

    # 4. 文件大小校验(防读取超大文件撑爆内存)
    try:
        file_size = os.path.getsize(resolved_path)
    except OSError as e:
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "message": f"无法获取文件大小: {e}",
        }
    if file_size > MAX_FILE_SIZE:
        return {
            "ok": False,
            "errorCode": "FILE_TOO_LARGE",
            "message": (
                f"文件大小 {file_size} 字节超过上限 {MAX_FILE_SIZE} 字节(1MB)"
            ),
        }

    # 5. 读取文件内容(UTF-8)
    try:
        with open(resolved_path, "r", encoding="utf-8") as f:
            old_content = f.read()
    except UnicodeDecodeError as e:
        return {
            "ok": False,
            "errorCode": "ENCODING_ERROR",
            "message": f"文件非 UTF-8 编码: {e}",
        }
    except PermissionError as e:
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "message": f"文件读取权限失败: {e}",
        }
    except OSError as e:
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "message": f"文件读取失败: {e}",
        }

    # 6. 统计 old_string 出现次数
    count = old_content.count(old_string)

    # 7. 0 次命中(文件存在但 old_string 不在内容中)
    if count == 0:
        return {
            "ok": False,
            "errorCode": "OLD_STRING_NOT_FOUND",
            "message": f"未在文件中找到 old_string: {resolved_path}",
        }

    # 8. >1 次命中 + replace_all=False(防歧义替换)
    if count > 1 and not replace_all:
        return {
            "ok": False,
            "errorCode": "MULTIPLE_MATCHES",
            "message": f"找到 {count} 处匹配,设置 replace_all=True 全部替换",
            "count": count,
        }

    # 9. 执行替换
    if replace_all:
        new_content = old_content.replace(old_string, new_string)
    else:
        new_content = old_content.replace(old_string, new_string, 1)

    # 10. 替换前创建备份(仅替换操作备份,创建新文件不备份)
    try:
        backup_path = create_backup(resolved_path)
    except Exception as e:
        logger.warning("file_editor.edit_file 备份创建失败: %s", e, exc_info=True)
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "message": f"备份创建失败: {e}",
        }

    # 11. 写回文件
    try:
        with open(resolved_path, "w", encoding="utf-8") as f:
            f.write(new_content)
    except PermissionError as e:
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "message": f"文件写入权限失败: {e}",
        }
    except OSError as e:
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "message": f"文件写入失败: {e}",
        }

    # 12. 生成 unified diff
    diff = generate_diff(old_content, new_content, resolved_path)

    # 13. 返回结果
    action = "replaced_all" if (count > 1 and replace_all) else "replaced"
    return {
        "ok": True,
        "action": action,
        "file_path": resolved_path,
        "count": count,
        "old_content_preview": old_content[:500],
        "new_content_preview": new_content[:500],
        "diff": diff,
        "backup_path": backup_path,
    }


# ---------------------------------------------------------------------------
# 文件版本快照 + 回滚(Checkpoint/Rewind 文件面)
# ---------------------------------------------------------------------------
# 以 (session_id, 文件绝对路径) 为维度维护内存版本表,每文件限量保留最近
# MAX_FILE_VERSIONS(默认 20)个版本。该表独立于 edit_file 的磁盘 .bak 备份:
# 此表保存的是"编辑前"的 content 快照,供恢复场景精确回滚到指定版本。
# 内存内实现(进程内),并发写用 threading.Lock 保护;不依赖 Redis(开发期够用)。
# 注意:仅可用作会话内即时恢复;进程重启后丢失,与 agent_checkpoint 的具备
# redis 持久化不同——需要跨重启文件恢复时,后续可扩展为落盘/Redis 快照。

# 版本表结构:
#   _FILE_VERSION_STORE[(session_id, resolved_path)] -> list[dict],按 created_at 升序
#   dict = {
#       "version_id": str,        # uuid4.hex
#       "session_id": str,
#       "path": str,              # resolved 绝对路径
#       "checkpoint_id": str|None,# 关联的 checkpoint(可选,便于按 checkpoint 回滚)
#       "created_at": float,
#       "content": str,           # 该版本的文件内容
#   }
_FILE_VERSION_STORE: dict[tuple[str, str], list[dict[str, Any]]] = {}
_FILE_VERSION_LOCK = threading.Lock()


def _version_key(session_id: str, resolved_path: str) -> tuple[str, str]:
    return (session_id, resolved_path)


def snapshot_file(
    session_id: str, file_path: str, checkpoint_id: str | None = None
) -> dict[str, Any]:
    """为 (session, file) 记录当前磁盘内容的文件版本快照。

    用于"编辑前调用",把编辑前的完整文件内容保存为某个版本,恢复时可回滚至此。

    Args:
        session_id: 会话 id(版本按会话隔离)
        file_path: 目标文件路径(须在工作区白名单内)
        checkpoint_id: 可选,关联的 checkpoint id(供按 checkpoint 一次性回滚)

    Returns:
        成功: {ok: True, version_id, path, session_id, created_at, total}
        失败: {ok: False, errorCode, message}
    """
    ok, info = validate_path(file_path)
    if not ok:
        return {"ok": False, "errorCode": "PATH_NOT_IN_WORKSPACE", "message": info}
    resolved = info
    if not os.path.exists(resolved):
        return {
            "ok": False,
            "errorCode": "FILE_NOT_FOUND",
            "message": f"文件不存在: {resolved}",
        }
    try:
        file_size = os.path.getsize(resolved)
    except OSError as e:
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "message": f"无法获取文件大小: {e}",
        }
    if file_size > MAX_FILE_SIZE:
        return {
            "ok": False,
            "errorCode": "FILE_TOO_LARGE",
            "message": f"文件大小 {file_size} 字节超过上限 {MAX_FILE_SIZE} 字节(1MB)",
        }
    try:
        with open(resolved, "r", encoding="utf-8") as f:
            content = f.read()
    except UnicodeDecodeError as e:
        return {
            "ok": False,
            "errorCode": "ENCODING_ERROR",
            "message": f"文件非 UTF-8 编码: {e}",
        }
    except OSError as e:
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "message": f"文件读取失败: {e}",
        }

    version = {
        "version_id": uuid.uuid4().hex,
        "session_id": session_id,
        "path": resolved,
        "checkpoint_id": checkpoint_id,
        "created_at": time.time(),
        "content": content,
    }
    key = _version_key(session_id, resolved)
    with _FILE_VERSION_LOCK:
        versions = _FILE_VERSION_STORE.setdefault(key, [])
        versions.append(version)
        # 限量保留最近 MAX_FILE_VERSIONS 个
        if len(versions) > MAX_FILE_VERSIONS:
            del versions[: len(versions) - MAX_FILE_VERSIONS]

    logger.debug(
        "file_editor.snapshot_file session=%s path=%s total=%d",
        session_id,
        resolved,
        len(_FILE_VERSION_STORE[key]),
    )
    return {
        "ok": True,
        "version_id": version["version_id"],
        "path": resolved,
        "session_id": session_id,
        "created_at": version["created_at"],
        "total": len(_FILE_VERSION_STORE[key]),
    }


def list_file_versions(
    session_id: str, file_path: str, include_content: bool = False
) -> list[dict[str, Any]]:
    """列出 (session, file) 的文件版本元数据(按 created_at 升序)。"""
    ok, info = validate_path(file_path)
    if not ok:
        return []
    key = _version_key(session_id, info)
    with _FILE_VERSION_LOCK:
        versions = list(_FILE_VERSION_STORE.get(key, []))
    out = []
    for v in versions:
        item = {
            "version_id": v["version_id"],
            "session_id": v["session_id"],
            "path": v["path"],
            "checkpoint_id": v.get("checkpoint_id"),
            "created_at": v["created_at"],
        }
        if include_content:
            item["content"] = v["content"]
        out.append(item)
    return out


def rollback_file(
    session_id: str,
    file_path: str,
    checkpoint_id: str | None = None,
    version_id: str | None = None,
) -> dict[str, Any]:
    """把文件回滚到指定版本,并写回磁盘。

    目标版本定位规则(优先级高到低):
    1. version_id:精确匹配指定版本
    2. checkpoint_id:匹配"该 checkpoint_id 关联的最新版本"

    推荐恢复路径:调用方先从 checkpoint.restore 返回的 metadata/权威文件版本
    引用里取到 version_id,再调用本函数精确回滚(见 checkpoint_rewind 路由)。

    Args:
        session_id: 会话 id
        file_path: 目标文件路径(须在工作区白名单内)
        checkpoint_id: 可选,按 checkpoint 关联定位
        version_id: 可选,精确版本

    Returns:
        成功: {ok: True, version_id, path, checkpoint_id, restored, message}
        失败: {ok: False, errorCode, message}
    """
    ok, info = validate_path(file_path)
    if not ok:
        return {"ok": False, "errorCode": "PATH_NOT_IN_WORKSPACE", "message": info}
    resolved = info

    key = _version_key(session_id, resolved)
    with _FILE_VERSION_LOCK:
        versions = list(_FILE_VERSION_STORE.get(key, []))
    if not versions:
        return {
            "ok": False,
            "errorCode": "NO_FILE_VERSIONS",
            "message": f"尚无文件版本: session={session_id} path={resolved}",
        }

    target = None
    if version_id is not None:
        target = next((v for v in versions if v["version_id"] == version_id), None)
    elif checkpoint_id is not None:
        # 取匹配该 checkpoint 的最新版本
        target = next(
            (v for v in reversed(versions) if v.get("checkpoint_id") == checkpoint_id),
            None,
        )
    else:
        return {
            "ok": False,
            "errorCode": "VERSION_SELECTOR_REQUIRED",
            "message": "必须提供 version_id 或 checkpoint_id 之一",
        }

    if target is None:
        return {
            "ok": False,
            "errorCode": "VERSION_NOT_FOUND",
            "message": (
                f"未找到目标版本: session={session_id} path={resolved} "
                f"checkpoint_id={checkpoint_id} version_id={version_id}"
            ),
        }

    try:
        with open(resolved, "w", encoding="utf-8") as f:
            f.write(target["content"])
    except PermissionError as e:
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "message": f"文件写入权限失败: {e}",
        }
    except OSError as e:
        return {
            "ok": False,
            "errorCode": "PERMISSION_DENIED",
            "message": f"文件写入失败: {e}",
        }

    return {
        "ok": True,
        "version_id": target["version_id"],
        "path": resolved,
        "checkpoint_id": target.get("checkpoint_id"),
        "restored": True,
        "message": f"文件已回滚到版本 {target['version_id']}",
    }


def _reset_file_version_store() -> None:
    """(测试用)清空文件版本表。"""
    with _FILE_VERSION_LOCK:
        _FILE_VERSION_STORE.clear()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
