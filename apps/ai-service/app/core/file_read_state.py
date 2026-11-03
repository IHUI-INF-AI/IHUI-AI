# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""file_read_state — 读侧登记 + 编辑前脏判定(逆向-复现-超越 §0.11 第 ③④ 步)。

对照程序取证(定位册,不重复取证):
- Trae `cc_file_read_state_cache`:读状态持久进会话 context,拒绝原因三态
  `dedup_disabled · cache_miss_or_condition_not_met · file_dirty` 不并桶
  (`docs/benchmark-evidence/2026-10/trae-rea-20261031/T1-trae-ai-agent.md` §3 与缺口表 M2)。
- Qoder 用户态 `file-history/<session>/<uuid>@vN`:只有**写侧**逐版本快照,没有读侧登记面
  (`docs/benchmark-evidence/2026-10/qoder-rea-20261030/S3-desktop-shell.md` 第 8 节)。

本仓此前同样只有写侧(`file_editor.snapshot_file`)与不分会话的 base
(`mcp_server._FILE_BASE_CONTENT`,键只有路径)⇒ "自你上次读它,它在盘上变过吗"这一问
从未被回答:`old_string` 恰好还能匹配时改动照旧落盘,可能覆盖他席刚写进去的内容。

四档判定(一等契约;调用方只引常量,不自拼字面量,四档永不并桶 —— AGENTS §0.3):
    fresh         读过且盘上未变(含"未变是因为本会话自己刚写过")
    stale         读过但盘上已变(默认**不硬拦**,必须在返回体点名;strict 才拒写)
    never_read    本会话没有读登记
    undetermined  取不到输入(盘读不动 / 拿不到会话身份 / 判定异常)
                  —— 与 fresh **结构上不同名**,永不渲染成"没问题"

超越轴(本仓是**多会话共写一棵树**;对方是单会话产品形态,结构上不需要这一格):
stale 附带 `changed_by` 归因,把"谁改的"量出来而不是猜:
    self      盘上现状 == 本会话自己最后一次经工具写入的内容 ⇒ 不得报成"被别人改了"
    other     盘上现状 == 归因账本里另一个会话写入的内容
    external  盘上现状谁都没登记过(编辑器 / git / 脚本等工具面之外的改动)
    unknown   归因输入取不到(只点名"变过",不假装知道是谁)
配套地,本会话每次写成功都会刷新**自己那条**读登记(`record_self_write`),所以"我刚写完
又被说成脏"这种自指噪音在判定层就被消掉(而不是靠模型重读一遍绕过去)。

存储纪律(AGENTS §0.6 单一真相源):双通道(进程内 dict + Redis)**复用**
`app.services.file_editor` 已有的那一族原语(`_redis_client` / `_redis_enabled` /
`_file_version_key`),不新开存储引擎、不新造 Redis 客户端;TTL 复用
`app.core.tunables.FILE_VERSION_REDIS_TTL`。Redis 不可用 ⇒ 静默降级为纯进程内(与
file_editor / agent_checkpoint 同语义),且**降级不改变判定结果**。

失效方向(AGENTS §0.10):登记/判定失败绝不让编辑主流程炸(公开函数全部 catch-all),
但也绝不静默当作 `fresh`;拒写只在「显式严格档 ∧ stale」发生,undetermined 的出路是
"多要一次定向说明",不是"多放一次跳门"、也不是"多加一道拦门"。
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from collections.abc import Mapping
from typing import Any

from app.core.tunables import FILE_VERSION_REDIS_TTL

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 一等契约:档位常量(唯一声明处)
# ---------------------------------------------------------------------------

VERDICT_FRESH = "fresh"
VERDICT_STALE = "stale"
VERDICT_NEVER_READ = "never_read"
VERDICT_UNDETERMINED = "undetermined"

READ_STATE_VERDICTS: tuple[str, ...] = (
    VERDICT_FRESH,
    VERDICT_STALE,
    VERDICT_NEVER_READ,
    VERDICT_UNDETERMINED,
)

CHANGED_BY_SELF = "self"
CHANGED_BY_OTHER = "other"
CHANGED_BY_EXTERNAL = "external"
CHANGED_BY_UNKNOWN = "unknown"

#: 登记来源:read=工具读成功;self_write=本会话写成功后刷新(超越轴的去噪位)
SOURCE_READ = "read"
SOURCE_SELF_WRITE = "self_write"

#: 严格档开关。只有本文件 `strict_mode_requested()` 一处解析口径(§0.6):
#: handler 入参键(既有参数形态,与 write_file 的 force 同形)优先,其次部署级 env。
STRICT_ARGUMENT_KEY = "read_state_strict"
STRICT_ENV_KEY = "FILE_READ_STATE_STRICT"

#: 进程内容量(与 mcp_server._FILE_BASE_MAX 同量级,超限淘汰最旧)
MAX_READ_STATE_RECORDS = 512
MAX_WRITE_LEDGER_ENTRIES = 32

#: Redis 键:与 file_editor 的版本快照同前缀族、不同命名空间(互不清对方的库)
_READ_STATE_KEY_PREFIX = "ihui:file_read_state:"
_READ_STATE_LEDGER_PREFIX = "ihui:file_read_state:ledger:"
_READ_STATE_KEY_INDEX = "ihui:file_read_state:index"

# ---------------------------------------------------------------------------
# 进程内通道(与 file_editor._FILE_VERSION_STORE 同形:键归一 + 惰性 + reset)
# ---------------------------------------------------------------------------

#: 键 = `_mem_key()` 归一出的 (session_id, 归一绝对路径);值 = 最近一次读登记
_READ_STATE_STORE: dict[tuple[str, str], dict[str, Any]] = {}
#: 键 = 归一绝对路径;值 = 该文件经工具写入的历史(旧→新),供 changed_by 归因
_WRITE_LEDGER_STORE: dict[str, list[dict[str, Any]]] = {}

RecordDict = dict[str, Any]
SampleDict = dict[str, Any]
VerdictDict = dict[str, Any]


def _now(now: float | None) -> float:
    """可注入时钟:测试传定值,运行期取 time.time()。"""
    return time.time() if now is None else float(now)


def _file_editor_module() -> Any:
    """延迟取 file_editor 的存储原语(避开 core→services 的导入环)。

    取不到 ⇒ None ⇒ 只走进程内通道(与 Redis 不可用同一降级语义),不抛。
    """
    try:
        from app.services import file_editor

        return file_editor
    except Exception as e:  # noqa: BLE001 - 存储层不可用不许影响判定主流程
        logger.warning("file_read_state 取 file_editor 存储原语失败(仅进程内): %s", e)
        return None


def _norm_path(path: str) -> str:
    """路径归一:abspath + normcase + normpath(Windows 大小写不敏感,同文件同键)。"""
    return os.path.normcase(os.path.normpath(os.path.abspath(path)))


def _mem_key(session_id: str, path: str) -> tuple[str, str]:
    """读登记键:复用 file_editor._file_version_key(同一会话+路径口径,不另写一份)。

    file_editor 那份只做到 abspath;本层再套 normcase 以与 `_norm_path` 存的
    `record["path"]` 同形(否则写侧键与读侧键大小写不一致 ⇒ 缓存永 miss)。
    """
    fe = _file_editor_module()
    if fe is not None:
        try:
            key = fe._file_version_key(session_id, path)
            if isinstance(key, tuple) and len(key) == 2:
                return (str(key[0]), os.path.normcase(str(key[1])))
        except Exception as e:  # noqa: BLE001 - 复用失败回到本层同口径归一
            logger.warning("file_read_state 复用 _file_version_key 失败: %s", e)
    return session_id, _norm_path(path)


def _redis_string_cmd() -> Any:
    """共享 Redis 客户端(file_editor 单例;不可用 ⇒ None ⇒ 纯进程内)。"""
    fe = _file_editor_module()
    if fe is None:
        return None
    try:
        if not fe._redis_enabled():
            return None
        return fe._redis_client()
    except Exception as e:  # noqa: BLE001 - 连接异常 = 降级,不冒泡
        logger.warning("file_read_state redis 不可用(降级为进程内): %s", e)
        return None


def _read_state_redis_key(session_id: str, path: str) -> str:
    return f"{_READ_STATE_KEY_PREFIX}{session_id}:{_norm_path(path)}"


def _ledger_redis_key(path: str) -> str:
    return f"{_READ_STATE_LEDGER_PREFIX}{_norm_path(path)}"


def _redis_set_json(rkey: str, payload: object) -> None:
    """全量覆盖写 + TTL + 进 reset 索引;失败静默降级(进程内主通道不受影响)。"""
    r = _redis_string_cmd()
    if r is None:
        return
    try:
        with r.pipeline() as pipe:
            pipe.set(rkey, json.dumps(payload, ensure_ascii=False), ex=FILE_VERSION_REDIS_TTL)
            pipe.sadd(_READ_STATE_KEY_INDEX, rkey)
            pipe.execute()
    except Exception as e:  # noqa: BLE001
        logger.warning("file_read_state redis 写入失败(静默降级): %s", e)


def _redis_get_json(rkey: str) -> object:
    r = _redis_string_cmd()
    if r is None:
        return None
    try:
        raw = r.get(rkey)
        if not raw:
            return None
        return json.loads(raw)
    except Exception as e:  # noqa: BLE001
        logger.warning("file_read_state redis 读取失败(静默降级): %s", e)
        return None


def _redis_index_keys() -> list[str]:
    r = _redis_string_cmd()
    if r is None:
        return []
    try:
        return sorted(r.smembers(_READ_STATE_KEY_INDEX))
    except Exception as e:  # noqa: BLE001
        logger.warning("file_read_state redis 索引读取失败(静默降级): %s", e)
        return []


# ---------------------------------------------------------------------------
# 指纹与盘上取样
# ---------------------------------------------------------------------------


def normalize_eol_bytes(data: bytes) -> bytes:
    """行尾归一(CRLF/CR → LF),与 Python 文本模式 universal newlines 同口径。

    为什么必须先归一再哈希:`read_file` 是文本模式读(行尾已被翻译成 LF),而盘上是
    原字节。两侧若不先归一到同一形态,CRLF 文件会被**永远**判成 stale —— 那是把
    表示差异说成内容变化。归一只影响指纹输入,不改盘上字节。
    """
    return data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


def content_fingerprint(content: str | bytes) -> str:
    """内容指纹(sha256 全量 hex,行尾归一后)。

    本仓无通用哈希出口(现读:`app/providers/jimeng_provider.py:_sha256_hex` 是厂商私有),
    故按标准库实现,并保证**全仓判据只在摘要这一处**出现哈希调用(§0.6)。
    bytes 直接取(二进制不过解码,免得判据因编码问题炸掉)。
    """
    data = content if isinstance(content, bytes) else content.encode("utf-8", "surrogatepass")
    return hashlib.sha256(normalize_eol_bytes(data)).hexdigest()


def sample_file(path: str) -> SampleDict:
    """盘上取样(永不抛):状态 + 指纹 + mtime + size。

    三态不并桶:
      ok         读到字节
      absent     路径不存在(lexists False)⇒ 这是可观测事实,不是"判不出"
      unreadable 存在但读不动(权限/目录/IO)⇒ 取不到输入,判 undetermined
    """
    out: SampleDict = {
        "status": "unreadable",
        "path": _norm_path(path),
        "fingerprint": None,
        "mtime": None,
        "size": None,
        "error": None,
    }
    try:
        if not os.path.lexists(path):
            out["status"] = "absent"
            out["error"] = "not_found"
            return out
        stat = os.stat(path)
        out["mtime"] = stat.st_mtime
        out["size"] = stat.st_size
        if not os.path.isfile(path):
            out["error"] = "not_a_regular_file"
            return out
        with open(path, "rb") as f:
            data = f.read()
        out["fingerprint"] = content_fingerprint(data)
        out["status"] = "ok"
        out["error"] = None
        return out
    except OSError as e:
        out["error"] = f"{type(e).__name__}: {e}"
        return out
    except Exception as e:  # noqa: BLE001 - 取样层永不冒泡到编辑主流程
        out["error"] = f"{type(e).__name__}: {e}"
        return out


# ---------------------------------------------------------------------------
# 登记存储
# ---------------------------------------------------------------------------


def _mem_put_record(record: RecordDict) -> None:
    key = _mem_key(str(record["session_id"]), str(record["path"]))
    if key in _READ_STATE_STORE:
        _READ_STATE_STORE.pop(key)
    _READ_STATE_STORE[key] = record
    while len(_READ_STATE_STORE) > MAX_READ_STATE_RECORDS:
        _READ_STATE_STORE.pop(next(iter(_READ_STATE_STORE)))


def load_read_state(session_id: str, path: str) -> RecordDict | None:
    """读本会话对该文件的登记(优先进程内,miss 回查 Redis 并回填)。无登记 ⇒ None。"""
    sid = (session_id or "").strip()
    if not sid:
        return None
    key = _mem_key(sid, path)
    cached = _READ_STATE_STORE.get(key)
    if cached is not None:
        return cached
    loaded = _redis_get_json(_read_state_redis_key(key[0], key[1]))
    if isinstance(loaded, dict) and loaded.get("fingerprint") is not None:
        _mem_put_record(loaded)
        return loaded
    return None


def _put_read_state(
    session_id: str,
    absolute_path: str,
    fingerprint: str,
    mtime: float | None,
    size: int | None,
    at: float,
    source: str,
) -> RecordDict:
    record: RecordDict = {
        "session_id": session_id,
        "path": absolute_path,
        "fingerprint": fingerprint,
        "mtime": mtime,
        "size": size,
        "at": at,
        "source": source,
    }
    _mem_put_record(record)
    _redis_set_json(_read_state_redis_key(session_id, absolute_path), record)
    return record


def _append_write_ledger(
    session_id: str,
    absolute_path: str,
    fingerprint: str,
    mtime: float | None,
    size: int | None,
    at: float,
) -> int:
    """登记"此刻盘上这份内容由哪个会话经工具写入",供 changed_by 归因。返回在册条数。"""
    lkey = _norm_path(absolute_path)
    entries = _WRITE_LEDGER_STORE.get(lkey)
    if entries is None:
        redis_entries = _redis_get_json(_ledger_redis_key(absolute_path))
        entries = list(redis_entries) if isinstance(redis_entries, list) else []
        _WRITE_LEDGER_STORE[lkey] = entries
    entries.append(
        {
            "session_id": session_id,
            "path": lkey,
            "fingerprint": fingerprint,
            "mtime": mtime,
            "size": size,
            "at": at,
        }
    )
    if len(entries) > MAX_WRITE_LEDGER_ENTRIES:
        del entries[: len(entries) - MAX_WRITE_LEDGER_ENTRIES]
    _redis_set_json(_ledger_redis_key(absolute_path), entries)
    return len(entries)


def load_write_ledger(path: str) -> list[dict[str, Any]] | None:
    """归因账本(旧→新)。None = 取不到输入(≠ "没人写过",那要返回空表)。"""
    lkey = _norm_path(path)
    if lkey in _WRITE_LEDGER_STORE:
        return list(_WRITE_LEDGER_STORE[lkey])
    redis_entries = _redis_get_json(_ledger_redis_key(path))
    if isinstance(redis_entries, list):
        normalized: list[dict[str, Any]] = [dict(e) for e in redis_entries if isinstance(e, dict)]
        _WRITE_LEDGER_STORE[lkey] = normalized
        return list(normalized)
    return None


# ---------------------------------------------------------------------------
# A 格 / C 格:公开登记出口(全部不抛)
# ---------------------------------------------------------------------------


def _register(
    session_id: str | None,
    path: str,
    content: str | bytes | None,
    source: str,
    now: float | None,
    *,
    with_ledger: bool,
) -> dict[str, Any]:
    at = _now(now)
    sid = (session_id or "").strip()
    if not sid:
        # 会话身份拿不到 ⇒ 不登记(登记了也没人能查到),由判定层落 undetermined 点名
        return {"ok": False, "reason": "no_session_identity"}
    try:
        absolute = _norm_path(path)
        stat_now = sample_file(absolute)
        if content is not None:
            fingerprint = content_fingerprint(content)
        elif stat_now["status"] == "ok":
            fingerprint = str(stat_now["fingerprint"])
        else:
            return {"ok": False, "reason": f"unregisterable_disk_state:{stat_now['status']}"}
        mtime = stat_now["mtime"] if stat_now["status"] == "ok" else None
        size = stat_now["size"] if stat_now["status"] == "ok" else None
        record = _put_read_state(sid, absolute, fingerprint, mtime, size, at, source)
        count = (
            _append_write_ledger(sid, absolute, fingerprint, mtime, size, at)
            if with_ledger
            else 0
        )
        return {"ok": True, "record": record, "ledger_entries": count}
    except Exception as e:  # noqa: BLE001 - 登记层失效不冒泡(§0.10),但如实报没登记上
        logger.warning("file_read_state 登记失败(%s/%s): %s", sid, path, e)
        return {"ok": False, "reason": f"register_failed:{type(e).__name__}"}


def record_read(
    session_id: str | None,
    path: str,
    content: str | bytes | None = None,
    *,
    now: float | None = None,
) -> dict[str, Any]:
    """A 格:读成功后登记 (session, path) → 指纹 + mtime + size + 时刻。

    `content` 缺省时按盘上现值取样(调用方已经把内容读进内存时应当传进来,少一次 IO)。
    """
    return _register(session_id, path, content, SOURCE_READ, now, with_ledger=False)


def record_self_write(
    session_id: str | None,
    path: str,
    content: str | bytes | None = None,
    *,
    now: float | None = None,
) -> dict[str, Any]:
    """C 格:本会话写成功后 ① 刷新自己那条读登记(source=self_write)② 追加归因账本。"""
    return _register(session_id, path, content, SOURCE_SELF_WRITE, now, with_ledger=True)


# ---------------------------------------------------------------------------
# 严格档开关(唯一解析出口)
# ---------------------------------------------------------------------------


def _env_truthy(raw: str | None) -> bool:
    return (raw or "").strip().lower() in ("1", "true", "yes", "on")


def strict_mode_requested(arguments: Mapping[str, Any] | None = None) -> bool:
    """严格档 = 调用方显式声明;默认关(默认只点名不拒写,§0.10)。

    优先级只此一处口径(§0.6):入参 `read_state_strict` 给了布尔 ⇒ 认它;
    否则读部署级 env `FILE_READ_STATE_STRICT`(本仓既有 bool-env 惯用法)。
    """
    if arguments is not None:
        raw = arguments.get(STRICT_ARGUMENT_KEY)
        if isinstance(raw, bool):
            return raw
    return _env_truthy(os.environ.get(STRICT_ENV_KEY))


# ---------------------------------------------------------------------------
# B 格:编辑前脏判定
# ---------------------------------------------------------------------------


def _delta(record: RecordDict | None, current: SampleDict, at: float) -> dict[str, Any]:
    size_now = current.get("size")
    mtime_now = current.get("mtime")
    return {
        "size_bytes": None
        if (record is None or size_now is None or record.get("size") is None)
        else int(size_now) - int(record["size"]),
        "mtime_s": None
        if (record is None or mtime_now is None or record.get("mtime") is None)
        else float(mtime_now) - float(record["mtime"]),
        "age_s": None if record is None else at - float(record.get("at", at)),
    }


def _attribute(
    session_id: str, current_fp: str | None, ledger: list[dict[str, Any]] | None
) -> str:
    """changed_by 归因:本席 ⇒ 他席 ⇒ 外部 ⇒ 未知(顺序即优先级,只此一处)。"""
    if ledger is None:
        return CHANGED_BY_UNKNOWN
    if not ledger:
        # 账本取得到且为空 = 该文件从未有会话经工具写过 ⇒ 盘上这份是工具面之外改的
        return CHANGED_BY_EXTERNAL
    for entry in reversed(ledger):
        if current_fp is None:
            # 盘上没了(被删):账本里最后写过这份的人就是动它的那一方
            last = ledger[-1]
            who = str(last.get("session_id") or "")
            return CHANGED_BY_SELF if who == session_id else CHANGED_BY_OTHER
        if entry.get("fingerprint") == current_fp:
            if str(entry.get("session_id") or "") == session_id:
                return CHANGED_BY_SELF
            return CHANGED_BY_OTHER
    return CHANGED_BY_EXTERNAL


_STALE_MESSAGE = "该文件自本次会话读取后已被改动,本次编辑可能覆盖他人内容"
_UNDETERMINED_MESSAGE = (
    "无法判定本会话上次读取后该文件是否被改动(输入取不到:{reason})。"
    "本结果**不等于**「文件没变」:请先 read_file 复核内容后再落改动。"
)
_WHO_LABELS = {
    CHANGED_BY_SELF: "本会话自己的写入(非他席覆盖)",
    CHANGED_BY_OTHER: "另一会话经工具写入",
    CHANGED_BY_EXTERNAL: "工具面之外(编辑器 / git / 脚本等)写入",
    CHANGED_BY_UNKNOWN: "改动来源无法归因",
}


def judge_read_state(
    session_id: str | None,
    path: str,
    *,
    strict: bool | None = None,
    now: float | None = None,
    arguments: Mapping[str, Any] | None = None,
) -> VerdictDict:
    """B 格:编辑前脏判定(四档不并桶;undetermined 与 fresh 结构上不同名)。

    Args:
        session_id: 承载层注入的会话标识(`__session_id`);取不到 ⇒ undetermined
        path: 目标文件(调用方应已完成工作区准入,本函数只判不校验)
        strict: 显式覆盖严格档;缺省按 `strict_mode_requested(arguments)` 解析
        now: 可注入时钟
        arguments: handler 原始入参(只用于开关解析,不重造判据)

    Returns 返回体字段名即契约:
        verdict / reason / strict / blocking / changed_by / message /
        recorded / current / delta
    """
    at = _now(now)
    sid = (session_id or "").strip()
    is_strict = strict_mode_requested(arguments) if strict is None else bool(strict)
    result: VerdictDict = {
        "verdict": VERDICT_UNDETERMINED,
        "reason": "uninitialised",
        "strict": is_strict,
        "blocking": False,
        "changed_by": None,
        "message": "",
        "recorded": None,
        "current": None,
        "delta": None,
    }

    def _finish(
        verdict: str, reason: str, *, message: str = "", changed_by: str | None = None
    ) -> VerdictDict:
        result["verdict"] = verdict
        result["reason"] = reason
        result["message"] = message
        result["changed_by"] = changed_by
        # 拒写只发生在「显式严格档 ∧ stale」。undetermined 的失效方向是"多要一次定向
        # 说明"(§0.10):既不借它塞一道新拦门,也绝不把它渲染成 fresh。
        result["blocking"] = bool(is_strict and verdict == VERDICT_STALE)
        return result

    try:
        if not sid:
            return _finish(
                VERDICT_UNDETERMINED,
                "no_session_identity",
                message=_UNDETERMINED_MESSAGE.format(reason="拿不到承载层注入的会话标识"),
            )
        record = load_read_state(sid, path)
        current = sample_file(path)
        result["recorded"] = None if record is None else dict(record)
        result["current"] = dict(current)
        result["delta"] = _delta(record, current, at)

        if current["status"] == "unreadable":
            return _finish(
                VERDICT_UNDETERMINED,
                "disk_unreadable",
                message=_UNDETERMINED_MESSAGE.format(
                    reason=f"盘上读不到该文件({current.get('error')})"
                ),
            )

        if record is None:
            return _finish(
                VERDICT_NEVER_READ,
                "no_record_for_session",
                message=(
                    "本会话尚未读过该文件(无读登记),本次编辑未经脏判定保护;"
                    "建议先 read_file 取得最新内容。"
                ),
            )

        if current["status"] == "absent":
            # 读过 ⇒ 当时文件在;现在不在 ⇒ 确证的变更(被删),不是"判不出"。
            return _finish(
                VERDICT_STALE,
                "file_removed_since_read",
                message=f"{_STALE_MESSAGE};当前文件已不存在(登记后被他处删除)。",
                changed_by=_attribute(sid, None, load_write_ledger(path)),
            )

        if current["fingerprint"] == record.get("fingerprint"):
            return _finish(
                VERDICT_FRESH,
                "unchanged_since_self_write"
                if record.get("source") == SOURCE_SELF_WRITE
                else "unchanged_since_read",
            )

        changed_by = _attribute(sid, str(current["fingerprint"]), load_write_ledger(path))
        if changed_by == CHANGED_BY_SELF:
            # 兜底归因:本会话自己写的内容(正常路径已由 record_self_write 刷成 fresh,
            # 走到这里说明那次登记没落上 —— 仍不得把本席自己的改动报成他席覆盖)。
            return _finish(
                VERDICT_STALE,
                "changed_by_self_outside_record",
                message=f"{_STALE_MESSAGE};改动归因:{_WHO_LABELS[changed_by]};重读后即可继续。",
                changed_by=changed_by,
            )
        return _finish(
            VERDICT_STALE,
            "disk_differs_from_record",
            message=(
                f"{_STALE_MESSAGE};改动归因:{_WHO_LABELS[changed_by]}"
                f"(登记指纹 {str(record.get('fingerprint'))[:12]}… → 当前指纹 "
                f"{str(current['fingerprint'])[:12]}…,大小差 "
                f"{str((result['delta'] or {}).get('size_bytes'))} 字节)"
            ),
            changed_by=changed_by,
        )
    except Exception as e:  # noqa: BLE001 - 判定层失效 ⇒ undetermined,不冒泡也不当 fresh
        logger.warning("file_read_state.judge_read_state 判定异常(%s): %s", path, e)
        result["verdict"] = VERDICT_UNDETERMINED
        result["reason"] = f"judge_error:{type(e).__name__}"
        result["message"] = _UNDETERMINED_MESSAGE.format(reason=f"{type(e).__name__}: {e}")
        result["blocking"] = False
        return result


def read_state_field(result: Mapping[str, Any]) -> dict[str, Any]:
    """工具返回体里的字段投影(唯一出口:handler 不各拼一份,防字段名漂移)。"""
    recorded = result.get("recorded")
    current = result.get("current")
    return {
        "verdict": result.get("verdict"),
        "reason": result.get("reason"),
        "strict": result.get("strict"),
        "blocking": result.get("blocking"),
        "changed_by": result.get("changed_by"),
        "message": result.get("message"),
        "recorded_fingerprint": recorded.get("fingerprint") if isinstance(recorded, dict) else None,
        "current_fingerprint": current.get("fingerprint") if isinstance(current, dict) else None,
        "delta": result.get("delta"),
    }


# ---------------------------------------------------------------------------
# 测试隔离 / 复位
# ---------------------------------------------------------------------------


def _reset_read_state_store() -> None:
    """清空读登记与归因账本(进程内 + Redis 索引,供测试隔离)。"""
    _READ_STATE_STORE.clear()
    _WRITE_LEDGER_STORE.clear()
    keys = _redis_index_keys()
    r = _redis_string_cmd()
    if r is None:
        return
    try:
        with r.pipeline() as pipe:
            if keys:
                pipe.delete(*keys)
            pipe.delete(_READ_STATE_KEY_INDEX)
            pipe.execute()
    except Exception as e:  # noqa: BLE001
        logger.warning("file_read_state redis 清空失败(静默降级): %s", e)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
