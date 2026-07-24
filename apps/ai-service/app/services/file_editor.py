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
import os
import re
import shutil
import time
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# 安全常量(与 mcp_server._WORKSPACE_ROOTS 同语义)
# ---------------------------------------------------------------------------

# 工作区根目录白名单:优先复用 mcp_server 的常量,失败则从 env 读取,再失败用 cwd
def _resolve_workspace_roots() -> list[str]:
    try:
        from .mcp_server import _WORKSPACE_ROOTS as mcp_roots
        if mcp_roots:
            return list(mcp_roots)
    except Exception:
        pass
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
    backup_name = f"{src.name}.{os.getpid()}.{time.time_ns()}.bak"
    backup_path = backup_dir / backup_name
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
