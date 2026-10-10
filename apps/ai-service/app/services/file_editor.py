# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""file_edit 工具:基于 old_string/new_string 模式的精细文件编辑。

自研 Edit 工具(局部精细修改,优于整文件覆盖)。
比 mcp_server.write_file(整文件覆盖)更精细,适合大文件的局部修改。

行为契约(对标 Claude Code Edit tool):
- 文件不存在 + create_if_missing=True  → 创建新文件,内容=new_string
- 文件不存在 + create_if_missing=False → FILE_NOT_FOUND
- 文件存在 + 0 次命中                 → OLD_STRING_NOT_FOUND
- 文件存在 + 1 次命中                 → 替换并写回
- 文件存在 + >1 次 + replace_all=True → 全部替换
- 文件存在 + >1 次 + replace_all=False→ MULTIPLE_MATCHES

安全约束:
- 路径必须在 _workspace_roots() 白名单内(防 symlink 穿越;每次调用现算)
- 路径不能在敏感目录黑名单(.git/node_modules/.venv/dist/build 等)
- 文件大小上限 1MB
- old_string 不能为空(new_string 可为空,用于删除代码)
- 替换前自动备份到 .ihui-agent/tmp/file_edit_backup/<timestamp>/<filename>.bak
"""

from __future__ import annotations

import difflib
import json
import logging
import os
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Any

from app.core.tunables import FILE_VERSION_REDIS_TTL as _FILE_VERSION_REDIS_TTL

# 批58(三十):敏感目录黑名单收敛为单一权威源。
# 此前本模块与 mcp_server 各持一份实现,而只有本模块这份有黑名单判定,
# 导致 mcp_server 的三个写工具可写 .git/hooks/。现统一由 path_guard 提供。
from .path_guard import SENSITIVE_DIR_PATTERN

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 安全常量(工作区根目录白名单,唯一实现复用 mcp_server._get_workspace_roots)
# ---------------------------------------------------------------------------

# 2026-10-11 修:这里原先写 `from .mcp_server import _WORKSPACE_ROOTS`,而那个常量早在
# 2026-07-27 就被 mcp_server 换成延迟求值的 `_get_workspace_roots()`(起因见该函数上方的修复说明:
# 模块加载期求值会早于 main.py 的 settings→environ 同步)。于是这行导入**每次都抛 ImportError**、
# 被下面的 except 静默吞掉 —— 注释承诺的"复用"从未发生,两份各自读 env 的实现一直并存,
# 而 typecheck / lint / 其余门全都不响(Python 侧具名导入的悬空符号当时无尺子)。
def _resolve_workspace_roots() -> list[str]:
    try:
        from .mcp_server import _get_workspace_roots
        roots = _get_workspace_roots()
        if roots:
            return list(roots)
    except Exception as e:
        logger.debug(
            "file_editor._resolve_workspace_roots 复用 mcp_server 出口失败: %s",
            e,
            exc_info=True,
        )
    return [
        os.path.abspath(r)
        for r in os.environ.get("MCP_WORKSPACE_ROOTS", os.getcwd()).split(os.pathsep)
        if r.strip()
    ]


# 工作区白名单的唯一读取出口 —— 每次调用现算,不再有模块级常量。
# mcp_server 在 2026-07-27 就是为同一症状把常量换成延迟函数,而那次修复只落在它那一侧:
# main.py 把 settings 同步进 os.environ 发生在模块导入之后,于是 import 期求值只能读到空 env
# 而落到 os.getcwd(),相对路径被拼成重复前缀(apps/ai-service 打头两遍)。
def _workspace_roots() -> list[str]:
    """允许作为工作区根目录的绝对路径集合(现算;测试 monkeypatch.setattr 本函数)。"""
    return _resolve_workspace_roots()

# 敏感目录黑名单(正则,匹配路径片段,防误改依赖/VCS/构建产物)
# 批58(三十):正则本体已上移到 path_guard.SENSITIVE_DIR_PATTERN(单一权威源),
# 此处保留同名绑定以兼容既有引用点;匹配语义与历史版本逐字一致(含 IGNORECASE),
# 因此本模块行为零变化 —— 收敛的方向是「让 mcp_server 对齐本模块」,不是反过来。
_SENSITIVE_DIR_PATTERNS: re.Pattern[str] = SENSITIVE_DIR_PATTERN

# 文件大小上限(1MB)
MAX_FILE_SIZE = 1 * 1024 * 1024

# 备份根目录(测试时可 monkeypatch 替换)
_BACKUP_ROOT = Path(".ihui-agent/tmp/file_edit_backup")

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
        # 白名单(防 symlink 穿越到 /etc/passwd 等)—— 现算一次,遍历与报错共用同一份
        roots = _workspace_roots()
        for root in roots:
            try:
                resolved.relative_to(root)
                return True, resolved_str
            except ValueError:
                continue
        return False, (
            f"路径不在工作区白名单内: {file_path}"
            f"(允许根目录: {roots})"
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
        file_path: 目标文件路径(必须在 _workspace_roots() 白名单内)
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
        with open(resolved_path, encoding="utf-8") as f:
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
# 文件版本快照 + 回滚(file_edit 的 Checkpoint/Rewind 联动层)
# ---------------------------------------------------------------------------
# 供 Checkpoint/Rewind 撤销链路复用:agent 在某次 checkpoint 前对文件做 snapshot,
# 用户 Rewind 到该 checkpoint 时可把文件 rollback 回捕获时的内容。
# 存储:进程内 dict,key=(session_id, 绝对路径),value=版本列表(升序,旧→新)。
# 测试可用 _reset_file_version_store() 复位。

# 每个 (session, 路径) 最多保留的版本数(超出丢弃最旧,对标"最近若干版本"
# 的编辑撤销习惯)
MAX_FILE_VERSIONS = 20

# 文件版本 Redis 持久化 TTL(与 agent_checkpoint 对齐,唯一真源见 app/core/tunables.py)
# Redis key 前缀 + 记录所有已用版本 key 的索引(供 reset 一次性清空)。
# 对齐 agent_checkpoint 的降级范式:redis 包缺失 / URL 未配置 / 连接失败 → 纯内存。
_FILE_VERSION_KEY_PREFIX = "ihui:file_versions:"
_FILE_VERSION_KEY_INDEX = "ihui:file_versions:index"

# redis 包未安装时降级为纯内存模式(与 agent_checkpoint 同语义)
_redis_mod: Any
try:
    import redis as _redis_import
except ImportError:
    _redis_mod = None
else:
    _redis_mod = _redis_import

# 进程内版本存储:{(session_id, file_path): [version_record, ...]}
_FILE_VERSION_STORE: dict[tuple[str, str], list[dict[str, Any]]] = {}

# Redis 单例 + 可用性判定(三重状态:None=未判定, True/False=判定结果)
_redis_client_instance: Any = None
_redis_available: bool | None = None


def _file_version_key(session_id: str, file_path: str) -> tuple[str, str]:
    """归一化(stable)存储键:session 与绝对路径都参与隔离,防跨会话回滚。"""
    return session_id, os.path.abspath(file_path)


def _get_redis_url() -> str:
    """获取 REDIS_URL(优先项目 config,回退环境变量)。返回空串表示未配置。"""
    try:
        from app.core.config import settings

        if settings.redis_url:
            return settings.redis_url
    except Exception as e:  # noqa: BLE001 - config 异常不影响降级判断
        logger.debug("file_editor 读取 settings.redis_url 失败: %s", e)
    return os.environ.get("REDIS_URL", "")


def _redis_enabled() -> bool:
    """判断 Redis 持久化是否可用(包存在 + 配置了 URL)。"""
    global _redis_available
    if _redis_available is None:
        _redis_available = bool(_redis_mod is not None) and bool(_get_redis_url())
    return _redis_available


def _redis_client() -> Any:
    """惰性创建 redis 客户端单例。连接失败时静默降级为纯内存模式。"""
    global _redis_client_instance
    if not _redis_enabled():
        return None
    if _redis_client_instance is not None:
        return _redis_client_instance
    try:
        # protocol=2 强制 RESP2(同 agent_checkpoint),兼容老 Redis;
        # socket_connect_timeout 必须显式:主机丢包(非拒连)时 TCP 默认阻塞数分钟,
        # 会把"静默降级为纯内存"契约变成永久挂起(2026-09-08 全量回归挂起根因)
        client = _redis_mod.from_url(
            _get_redis_url(),
            decode_responses=True,
            protocol=2,
            socket_connect_timeout=2,
        )
        client.ping()
        _redis_client_instance = client
        return client
    except Exception as e:  # noqa: BLE001 - 降级为纯内存,不阻塞主流程
        logger.warning("file_editor redis 不可达,降级为纯内存: %s", e)
        _redis_available = False
        return None


def _redis_versions_key(session_id: str, absolute_path: str) -> str:
    """Redis 存储键:(session + 绝对路径)隔离,防跨会话回滚。"""
    return f"{_FILE_VERSION_KEY_PREFIX}{session_id}:{absolute_path}"


def _redis_write_versions(
    key: str, versions: list[dict[str, Any]]
) -> None:
    """把该 (session, path) 的完整版本列表全量写入 Redis(带 TTL + key 索引)。

    全量覆盖写入保证 Redis 与内存版本列表始终一致;失败静默降级。
    """
    r = _redis_client()
    if r is None:
        return
    try:
        with r.pipeline() as pipe:
            pipe.delete(key)
            if versions:
                pipe.rpush(key, *[json.dumps(v, ensure_ascii=False) for v in versions])
                pipe.expire(key, _FILE_VERSION_REDIS_TTL)
            pipe.sadd(_FILE_VERSION_KEY_INDEX, key)
            pipe.execute()
    except Exception as e:  # noqa: BLE001 - 持久化失败不影响内存主流程
        logger.warning("file_editor redis 持久化失败(静默降级): %s", e)


def _redis_load_versions(key: str) -> list[dict[str, Any]] | None:
    """从 Redis 读取完整版本列表(顺序:旧→新)。无数据/失败均返回 None。"""
    r = _redis_client()
    if r is None:
        return None
    try:
        raw_list = r.lrange(key, 0, -1)
        if not raw_list:
            return None
        return [json.loads(raw) for raw in raw_list]
    except Exception as e:  # noqa: BLE001 - 读取失败静默降级
        logger.warning("file_editor redis 读取失败(静默降级): %s", e)
        return None


def _redis_clear_all_versions() -> None:
    """清空 reset 用版本:删除索引中的全部版本 key + 索引 set 本身。失败静默。"""
    r = _redis_client()
    if r is None:
        return
    try:
        keys = r.smembers(_FILE_VERSION_KEY_INDEX)
        with r.pipeline() as pipe:
            if keys:
                pipe.delete(*keys)
            pipe.delete(_FILE_VERSION_KEY_INDEX)
            pipe.execute()
    except Exception as e:  # noqa: BLE001 - reset 失败不影响内存
        logger.warning("file_editor redis reset 清空失败(静默降级): %s", e)


def _versions_for(key: tuple[str, str], rkey: str) -> list[dict[str, Any]] | None:
    """优先内存;内存 miss 时回查 Redis 并回填内存缓存(供回滚/列举用)。"""
    if key in _FILE_VERSION_STORE:
        return _FILE_VERSION_STORE[key]
    loaded = _redis_load_versions(rkey)
    if loaded is not None:
        _FILE_VERSION_STORE[key] = loaded
        return loaded
    return None


def _reset_file_version_store() -> None:
    """清空所有文件版本快照(内存 + Redis,供测试隔离)。"""
    _FILE_VERSION_STORE.clear()
    _redis_clear_all_versions()


def snapshot_file(
    session_id: str, file_path: str, checkpoint_id: str | None = None
) -> dict[str, Any]:
    """捕获文件当前内容为一个版本,返回该版本的引用 dict。

    Args:
        session_id: 归属会话(版本按会话隔离)
        file_path: 目标文件路径
        checkpoint_id: 可选,记录该快照对应的 checkpoint id,便于按 ckpt 回滚

    Returns:
        {"version_id": <uuid>, "path": <绝对路径>, "checkpoint_id": <或省略>}

    快照的两个布尔位(G-815934):
        existed_before: 拍快照时文件是否在磁盘上存在
        read_ok:        存在时是否真的读到了内容
    原实现在读取失败时把 content 记成 "" 且只 logger.debug,于是回滚会把
    "文件本来不存在" 与 "文件存在但读不到" 两种情形都变成 "把现有文件写成空
    文件" —— 那是数据丢失。现把两者记成一等的布尔位,由 rollback_file 分流。
    """
    absolute = os.path.abspath(file_path)
    existed_before = os.path.exists(absolute)
    content = ""
    read_ok = False
    read_error: str | None = None
    if existed_before:
        try:
            content = Path(absolute).read_text(encoding="utf-8")
            read_ok = True
        except Exception as e:  # noqa: BLE001 - 读不到不再伪装成空内容,但也不打断快照
            read_error = f"{type(e).__name__}: {e}"
            logger.warning("snapshot_file 读取失败(%s): %s", absolute, read_error)
    record: dict[str, Any] = {
        "version_id": uuid.uuid4().hex,
        "path": absolute,
        "created_at": time.time(),
        "existed_before": existed_before,
        "read_ok": read_ok,
    }
    # 读失败/文件缺失都不得落 content(落了一份不可信内容,回滚就有了写空的材料)
    if read_ok:
        record["content"] = content
    if read_error is not None:
        record["read_error"] = read_error
    if checkpoint_id:
        record["checkpoint_id"] = checkpoint_id
    key = _file_version_key(session_id, file_path)
    rkey = _redis_versions_key(session_id, absolute)
    versions = _versions_for(key, rkey)
    if versions is None:
        versions = []
        _FILE_VERSION_STORE[key] = versions
    versions.append(record)
    # 配额:只保留最近 MAX_FILE_VERSIONS 个
    if len(versions) > MAX_FILE_VERSIONS:
        del versions[: len(versions) - MAX_FILE_VERSIONS]
    # Redis 持久化(失败静默降级,不影响内存主流程)
    _redis_write_versions(rkey, versions)
    return {
        "version_id": record["version_id"],
        "path": absolute,
        "checkpoint_id": checkpoint_id,
    }


def list_file_versions(session_id: str, file_path: str) -> list[dict[str, Any]]:
    """列出某会话下该文件的所有版本元数据(不含文件内容)。"""
    versions = _versions_for(
        _file_version_key(session_id, file_path),
        _redis_versions_key(session_id, os.path.abspath(file_path)),
    ) or []
    return [
        {
            "version_id": v["version_id"],
            "path": v["path"],
            "created_at": v["created_at"],
        }
        | ({"checkpoint_id": v["checkpoint_id"]} if "checkpoint_id" in v else {})
        for v in versions
    ]


def rollback_file(
    session_id: str,
    file_path: str,
    version_id: str | None = None,
    checkpoint_id: str | None = None,
) -> dict[str, Any]:
    """把文件回滚到记录的某个版本。

    Args:
        session_id: 版本归属会话(跨会话回滚视为无版本)
        file_path: 目标文件路径
        version_id: 精确版本 id(优先)
        checkpoint_id: 或按快照时记录的 checkpoint id 定位版本

    Returns:
        {"ok": True, "action": "restored", "path":..., "version_id":...}     写回成功
        {"ok": True, "action": "deleted", "path":..., "version_id":...}      快照时文件不存在 → 已删除
        {"ok": False, "errorCode": "NO_FILE_VERSIONS"}           该会话无此文件版本
        {"ok": False, "errorCode": "VERSION_SELECTOR_REQUIRED"}  有版本但未给版本选择器
        {"ok": False, "errorCode": "VERSION_NOT_FOUND"}          给了选择器但未命中
        {"ok": False, "errorCode": "SNAPSHOT_UNREADABLE"}        快照没读到内容 → 拒绝执行(不写空)
        {"ok": False, "errorCode": "DELETE_FAILED"}              删除失败
        {"ok": False, "errorCode": "WRITE_FAILED"}               写回失败
    """
    versions = _versions_for(
        _file_version_key(session_id, file_path),
        _redis_versions_key(session_id, os.path.abspath(file_path)),
    ) or []
    if not versions:
        return {"ok": False, "errorCode": "NO_FILE_VERSIONS", "path": os.path.abspath(file_path)}
    if version_id is None and checkpoint_id is None:
        return {
            "ok": False,
            "errorCode": "VERSION_SELECTOR_REQUIRED",
            "path": os.path.abspath(file_path),
        }
    target = None
    if version_id is not None:
        target = next((v for v in versions if v["version_id"] == version_id), None)
    else:
        target = next((v for v in versions if v.get("checkpoint_id") == checkpoint_id), None)
    if target is None:
        return {"ok": False, "errorCode": "VERSION_NOT_FOUND", "path": os.path.abspath(file_path)}
    return _apply_rollback(target)


def _apply_rollback(target: dict[str, Any]) -> dict[str, Any]:
    """把一条快照记录落到磁盘上,按三态分流(G-815934)。

    三态(判据只有这两个布尔位,绝不靠 content 猜):
      ① not existed_before           → 删除文件(missing_ok,绝不新建空文件)
      ② existed_before ∧ read_ok     → 原子写回快照内容
      ③ existed_before ∧ ¬read_ok    → 拒绝执行并点名路径与原因
                                        (写空 = 用"读不到"销毁现有内容)
    """
    path = target["path"]
    existed_before = target.get("existed_before")
    read_ok = target.get("read_ok")
    if existed_before is None or read_ok is None:
        # 兼容本次改造之前拍的旧快照(没有这两个布尔位):按历史语义保守处理 ——
        # 视为"文件存在过",内容取 content 键。**绝不据此删除文件**:把"不认识"
        # 当成"已知不存在",正是本票要修的那一型错误。
        existed_before, read_ok = True, "content" in target

    # ① 快照时文件本不存在 → 回滚 = 删掉它(agent 新建的文件在回滚后应当消失)
    if not existed_before:
        try:
            Path(path).unlink(missing_ok=True)
        except OSError as e:
            return {
                "ok": False,
                "errorCode": "DELETE_FAILED",
                "message": f"回滚删除失败: {type(e).__name__}: {e}",
                "path": path,
            }
        return {
            "ok": True,
            "action": "deleted",
            "path": path,
            "version_id": target["version_id"],
        }

    # ③ 文件存在过但快照没读到 → 拒绝,不拿空内容覆盖现有文件
    if not read_ok:
        reason = target.get("read_error") or "快照期未记录读取成功"
        return {
            "ok": False,
            "errorCode": "SNAPSHOT_UNREADABLE",
            "message": (
                f"拒绝回滚:拍快照时未能读取该文件,写回会把它变成空文件。"
                f"路径: {path};原因: {reason}"
            ),
            "path": path,
            "version_id": target["version_id"],
        }

    # ② 正常路径:原子写回(同目录临时文件 + os.replace,沿用仓内既有写法)
    content = target.get("content")
    if not isinstance(content, str):
        return {
            "ok": False,
            "errorCode": "SNAPSHOT_UNREADABLE",
            "message": f"拒绝回滚:快照标记读成功但缺少内容。路径: {path}",
            "path": path,
            "version_id": target["version_id"],
        }
    tmp_path = f"{path}.fe_tmp_{uuid.uuid4().hex}"
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp_path, path)
    except Exception as e:  # noqa: BLE001 - 写回失败须返回错误
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except OSError:
            pass
        return {
            "ok": False,
            "errorCode": "WRITE_FAILED",
            "message": f"回滚写入失败: {e}",
            "path": path,
        }
    return {
        "ok": True,
        "action": "restored",
        "path": path,
        "version_id": target["version_id"],
    }


def get_file_version_content(
    session_id: str, file_path: str, version_id: str
) -> str | None:
    """读取某会话下指定文件版本的内容(供 checkpoint 回退影响预览的 diff 计算)。

    Args:
        session_id: 版本归属会话(跨会话隔离)
        file_path: 目标文件路径
        version_id: 精确版本 id

    Returns:
        该版本的快照内容字符串;版本不存在/已被配额淘汰/快照期没读到内容
        (read_ok=False 的记录刻意不落 content)返回 None。
    """
    versions = _versions_for(
        _file_version_key(session_id, file_path),
        _redis_versions_key(session_id, os.path.abspath(file_path)),
    ) or []
    target = next((v for v in versions if v.get("version_id") == version_id), None)
    if target is None:
        return None
    return target.get("content")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
