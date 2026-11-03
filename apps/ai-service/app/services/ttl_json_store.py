# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""带保留期限(TTL)的 JSON 落盘小工具(2026-10-03 数据出域合规整改)。

背景:审计发现本仓有一批**磁盘明文 JSON 存用户内容且没有任何保留期限**——
``.data/vector_memory.json``(会话消息原文+向量)、``data/agent_longterm_memory.json``
(跨会话提炼的用户偏好/项目约定)、``data/step_records.json``(工具入参/结果/diff)、
``data/audit_logs.json``、``data/browser_traces.json``。代码侧加上 TTL 只是第一步,
**磁盘上已存在的旧文件本身是无期限的**,所以读取时必须顺带做一次存量清理。

本模块只提供机械件,不含任何业务语义(哪类数据留多久由各调用方用模块级常量定):
  · 原子写:临时文件 + ``os.replace``(与 code_index_consent / vector_memory 既有范式一致)
  · 过期判定:优先取记录内时间戳,取不到回落**文件 mtime**;两者都判不出 ⇒ 判过期
  · 环形上限:超限丢最旧(插入序末尾为最新)
  · fail-closed 读盘:缺失/损坏一律按空处理(返回 None),由调用方决定怎么落日志

为什么过期判定要"记录内时间戳优先、mtime 兜底":
  记录内时间戳(``updated_at`` / ``created_at`` / ``at``)是**逐条**的,能只淘汰真正
  变旧的那几条;mtime 是**整份文件**的 —— 一次新写入会把 mtime 刷新到当下,于是
  "只要还有新记录在写,老记录就永远不会过期"。所以 mtime 只能当兜底(给没有时间戳
  的存量数据一个有限的期限),不能当主判据。

为什么"判不出时间戳"要判过期而不是永久保留:留存期限的目的是"到期就删",一个
既无时间戳又拿不到 mtime 的条目,谁都无法证明它还在期限内 —— fail-closed 意味着
**证明不了新鲜就不留**,而不是"证明不了就无限期留着"。

无第三方依赖(纯标准库),不新增 pip 依赖。
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 一天的秒数(算过期阈值用)
_SECONDS_PER_DAY = 86400.0

# 环境变量里"不设保留期"的合法字面量:置空 ⇒ 永不过期。
# 为什么留这个后门:合规整改要求默认必须有限期,但排障/合规取证时需要临时"冻结时间"
# 观察全量数据。它必须显式写出来,而不是靠把天数设成一个荒谬的大数来变相实现。
_DISABLED_LITERALS = frozenset({"0", "off", "never", "false", "no"})

# 时间戳字段的候选名(按优先级)。各模块的记录时间字段命名不统一,这里给一份公共候选表,
# 调用方也可以自己传更精确的顺序 —— 传入的 fields 优先,这份只是默认兜底。
DEFAULT_TIMESTAMP_FIELDS: tuple[str, ...] = (
    "updated_at",
    "last_accessed_at",
    "created_at",
    "started_at",
    "at",
    "timestamp",
)


def resolve_retention_days(env_name: str, default_days: int) -> int:
    """从环境变量读保留天数,只认"纯数字正整数"或显式的关闭字面量。

    刻意不接受 ``30.0`` / ``1e3`` / ``30 天`` 这类写法:运维手滑写成 ``RETENTION=30d``
    时若被静默解析成 30 反而更危险 —— 让人看见告警、知道这个开关只吃纯数字,比"猜对"
    可靠。非法值一律回落到模块默认值并记 warning。

    Args:
        env_name:    环境变量名(如 ``VECTOR_MEMORY_RETENTION_DAYS``)
        default_days: 非法/未设置时的回落值(必须 > 0)

    Returns:
        保留天数。返回 0 表示"显式关闭 TTL"(永不过期),仅当 env 命中 _DISABLED_LITERALS。
    """
    raw = os.environ.get(env_name, "").strip()
    if not raw:
        return default_days
    lowered = raw.lower()
    if lowered in _DISABLED_LITERALS:
        return 0
    # 刻意只认"纯数字":Python 的 int() 是接受 '1_000' / '  7  ' / '+7' 这类写法的,
    # 而这是一个运维手输的运维开关 —— 宽松解析只会让人以为设成功了。
    # 一旦不是纯数字,一律当非法处理(记 warning + 回落默认)。
    if not raw.isdigit():
        logger.warning(
            "%s=%r 不是合法的正整数,回落默认 %d 天(只接受纯数字或 %s 表示关闭)",
            env_name,
            raw,
            default_days,
            "/".join(sorted(_DISABLED_LITERALS)),
        )
        return default_days
    return int(raw)


def parse_timestamp(value: Any) -> float | None:
    """把记录里的时间字段解析成 epoch 秒;解析不出返回 None(不抛)。

    接受:
      · ISO8601 字符串(``2026-10-03T01:25:00Z`` / 带 ``+08:00`` 偏移 / 空格分隔)
      · epoch 秒的 int/float
    不接受:空串、None、布尔(``True`` 是 int 的子类,显式排除 —— 时间戳没有真假语义)。
    """
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        # 明显不是 epoch 秒的量级(负数 / 1e18 以上)当作解析失败,不猜。
        if value <= 0 or value > 1e11:
            return None
        return float(value)
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    # 本仓运行时是 3.12/3.13(fromisoformat 原生认 "Z"),后面几层手写格式只是
    # 兜底:宁可多认几种写法,也不要因为格式没覆盖到就把一条合法记录判成"无时间戳"
    # —— 那会让它直接落进 fail-closed 分支被当成过期项删掉。
    from datetime import datetime

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()
    except (ValueError, OSError, OverflowError):
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).timestamp()
        except ValueError:
            continue
    return None


def record_timestamp(
    record: Any,
    fields: Sequence[str] = DEFAULT_TIMESTAMP_FIELDS,
) -> float | None:
    """从一条记录里取"最近一次更新时间"(epoch 秒);取不到返回 None。

    字段按 ``fields`` 给的优先级顺序探,第一个能解析出合法时间的胜出。
    """
    if not isinstance(record, Mapping):
        return None
    for key in fields:
        if key not in record:
            continue
        parsed = parse_timestamp(record[key])
        if parsed is not None:
            return parsed
    return None


def file_mtime(path: str | os.PathLike[str]) -> float | None:
    """取文件 mtime;文件不存在或 stat 失败返回 None。"""
    try:
        return os.path.getmtime(path)
    except OSError:
        return None


def is_expired(
    record: Any,
    *,
    retention_days: int,
    mtime: float | None,
    now: float | None = None,
    fields: Sequence[str] = DEFAULT_TIMESTAMP_FIELDS,
) -> bool:
    """判断单条记录是否已超过保留期。

    判据优先级:记录内时间戳 → 文件 mtime → **判过期**(fail-closed)。
    ``retention_days <= 0`` 表示显式关闭 TTL,永不过期。
    """
    if retention_days <= 0:
        return False
    current = time.time() if now is None else now
    stamp = record_timestamp(record, fields)
    if stamp is None:
        stamp = mtime
    if stamp is None:
        return True
    return (current - stamp) > retention_days * _SECONDS_PER_DAY


def sweep_mapping(
    data: Mapping[Any, Any] | None,
    *,
    retention_days: int,
    mtime: float | None = None,
    max_items: int | None = None,
    now: float | None = None,
    fields: Sequence[str] = DEFAULT_TIMESTAMP_FIELDS,
) -> tuple[dict[Any, Any], int]:
    """扫一遍 ``{key: record}`` 形态的数据:先按 TTL 淘汰,再按环形上限截断。

    Args:
        data:           原始映射(None 视为空)
        retention_days: 保留天数;<= 0 表示关闭 TTL
        mtime:          文件 mtime(记录无时间戳时的兜底判据)
        max_items:      环形上限,超出丢最旧(插入序末尾视为最新);None = 不限
        now:            当前时间(测试可注入)
        fields:         时间戳字段候选,按优先级

    Returns:
        (清理后的 dict, 被丢弃条数)。**原 dict 不被修改**。
    """
    if not isinstance(data, Mapping):
        return {}, 0
    current = time.time() if now is None else now
    kept: dict[Any, Any] = {}
    dropped = 0
    for key, record in data.items():
        if is_expired(
            record,
            retention_days=retention_days,
            mtime=mtime,
            now=current,
            fields=fields,
        ):
            dropped += 1
            continue
        kept[key] = record
    if max_items is not None and max_items >= 0 and len(kept) > max_items:
        overflow = len(kept) - max_items
        for key in list(kept.keys())[:overflow]:
            kept.pop(key, None)
        dropped += overflow
    return kept, dropped


def sweep_sequence(
    data: Sequence[Any] | None,
    *,
    retention_days: int,
    mtime: float | None = None,
    max_items: int | None = None,
    now: float | None = None,
    fields: Sequence[str] = DEFAULT_TIMESTAMP_FIELDS,
) -> tuple[list[Any], int]:
    """扫一遍 ``[record, ...]`` 形态的数据(list/JSON 数组),语义同 :func:`sweep_mapping`。

    环形上限按"尾部最新"处理(与各模块 append-only 的写入顺序一致)。
    **原 list 不被修改**;非 list 输入(如损坏后读出 dict)按空处理。
    """
    if not isinstance(data, list):
        return [], 0
    current = time.time() if now is None else now
    kept: list[Any] = []
    dropped = 0
    for record in data:
        if is_expired(
            record,
            retention_days=retention_days,
            mtime=mtime,
            now=current,
            fields=fields,
        ):
            dropped += 1
            continue
        kept.append(record)
    if max_items is not None and max_items >= 0 and len(kept) > max_items:
        overflow = len(kept) - max_items
        del kept[:overflow]
        dropped += overflow
    return kept, dropped


def read_json_file(path: str | os.PathLike[str]) -> Any | None:
    """读 JSON 文件,任何异常(不存在/权限/半截文件/非法 JSON)都返回 None。

    **fail-closed**:读盘失败绝不当成"空但正常",调用方拿到 None 才知道该走
    "存档不可信"那条路(各模块据此记 error/warning 并按空存储起)。
    """
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return None
    except (OSError, ValueError, TypeError, UnicodeDecodeError) as exc:
        logger.warning("TTL JSON 读取失败(按不可信处理): %s: %s", path, exc)
        return None


def write_json_atomic(
    path: str | os.PathLike[str],
    data: Any,
    *,
    indent: int | None = None,
) -> bool:
    """原子写 JSON:先写同目录临时文件再 ``os.replace``。成功返回 True。

    同目录是刻意的:跨文件系统(如 tmp → 挂载盘)的 ``os.replace`` 不是原子的。
    写盘失败只记日志、返回 False —— 存档写不进去不该让主链路崩,内存里的数据仍在,
    下次变更会再试一次(重启后丢这一段,方向上宁可少留,不可假装写成功)。
    """
    target = Path(path)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        logger.warning("TTL JSON 建目录失败(内存保留): %s: %s", target, exc)
        return False
    tmp = target.with_name(target.name + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=indent)
        os.replace(tmp, target)
        return True
    except (OSError, TypeError, ValueError) as exc:
        logger.warning("TTL JSON 写盘失败(内存保留): %s: %s", target, exc)
        # 半截临时文件留在盘上没用,清掉(失败也不追究,原路径的旧文件仍是完整的)。
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        return False


def load_ttl_records(
    path: str | os.PathLike[str],
    *,
    retention_days: int,
    shape: str = "mapping",
    max_items: int | None = None,
    validate: Callable[[Any], bool] | None = None,
    fields: Sequence[str] = DEFAULT_TIMESTAMP_FIELDS,
    now: float | None = None,
    indent: int | None = 2,
) -> tuple[Any, int]:
    """**读取期清理**的唯一入口:读盘 → 结构校验 → 淘汰过期 → 环形截断 → 有丢弃就回写。

    这一步同时承担两件事,所以各模块的 ``_load`` 只需要调它:

      1. **存量清理**(2026-10-03 合规整改的核心诉求)。TTL 代码上线之前,磁盘上的旧
         文件已经躺了很久且不会自己过期。走一遍读取就一次性把它们从内存**和磁盘**
         同时清掉 —— 不需要额外迁移脚本,也不需要运维手动删文件。
      2. **fail-closed 读盘**。文件缺失 / 损坏 / 结构不符,一律返回空结构而不是抛错:
         存档坏了不该让服务起不来,但也绝不能把半截数据当有效记录继续用。

    Args:
        path:           存档路径
        retention_days: 保留天数;<= 0 表示显式关闭 TTL(永不过期)
        shape:          ``"mapping"``(``{id: record}``)或 ``"sequence"``(``[record, ...]``)
        max_items:      环形上限,超出丢最旧(插入序末尾为最新)
        validate:       结构校验谓词,返回 False 的记录**按丢弃计**并从结果里剔除。
                        各模块用它表达"这条记录完不完整"(如缺 memory_id / steps 非列表)
        fields:         时间戳字段候选,按优先级
        now/indent:     透传给 sweep_*(测试可注入 now)与原子写

    Returns:
        ``(清理后的数据, 被丢弃条数)``。``shape`` 不匹配时返回该形态的空值。
    """
    empty: Any = {} if shape == "mapping" else []
    raw = read_json_file(path)
    if raw is None:
        return empty, 0
    # 结构不符 ⇒ 按空处理(fail-closed)。绝不做"尽力而为的部分解析":
    # 半截数据里可能缺关键字段,当有效记录用比不用更危险。
    if shape == "mapping":
        if not isinstance(raw, Mapping):
            logger.warning("TTL JSON 结构异常(期望对象),按空处理: %s", path)
            return empty, 0
    elif not isinstance(raw, list):
        logger.warning("TTL JSON 结构异常(期望数组),按空处理: %s", path)
        return empty, 0

    # 结构校验先做:坏记录即使时间戳新鲜也不该留下(它们本来就是不可用数据)。
    # 先记下校验前的条数,好把"校验丢弃"与"过期/环形丢弃"分别算清 —— 两者都触发回写,
    # 但日志里要能分辨是数据坏了还是数据过期了。
    before = len(raw)
    # 类型收窄按**实际形态**判,不再用 shape 三目(守门 35 的三条红 :374 union-attr /
    # :382 两条 arg-type 根因同一个 —— `Mapping | list` 联合从这里到 sweeper 一路没被
    # 收窄过,mypy 只能看见联合)。这样改与原判据**逐条等价**:上方结构闸(355-366)已保证
    # shape 与 raw 的形态一一对应 —— ``shape == "mapping"`` 而 raw 不是 Mapping 时早已带
    # warning 返回空值,``shape`` 为其它值而 raw 不是 list 时同理。走到这里 ⇒
    # ``isinstance(raw, Mapping)`` ⟺ ``shape == "mapping"``。
    # 禁止用 ``cast`` / ``Any`` 把联合糊掉:那等于宣布"这处类型检查我不想要了"。
    if validate is not None:
        if isinstance(raw, Mapping):
            raw = {k: v for k, v in raw.items() if validate(v)}
        else:
            raw = [v for v in raw if validate(v)]
    invalid = before - len(raw)

    # 清扫器同样按形态分派(与上面同一条等价性依据)。file_mtime 仍只求值一次:
    # 两条分支互斥,不会各摸一次磁盘。
    # 联合在分支**之前**声明:sweep_mapping 回 dict、sweep_sequence 回 list,而两条分支
    # 对 mypy 是同一次绑定的两个来源 —— 不先写出来,它按第一条分支把 cleaned 钉成 dict,
    # 第二条分支的 list 就报 assignment(本票修 :374/:382 时新暴露的那一条,不是掩盖:
    # 这里交代的正是"这一份数据的形态由存档形态决定"的事实)。
    cleaned: dict[Any, Any] | list[Any]
    if isinstance(raw, Mapping):
        cleaned, expired = sweep_mapping(
            raw,
            retention_days=retention_days,
            mtime=file_mtime(path),
            max_items=max_items,
            now=now,
            fields=fields,
        )
    else:
        cleaned, expired = sweep_sequence(
            raw,
            retention_days=retention_days,
            mtime=file_mtime(path),
            max_items=max_items,
            now=now,
            fields=fields,
        )
    if invalid:
        logger.warning("TTL JSON 有 %d 条记录结构不合法已剔除: %s", invalid, path)

    # 有东西被丢弃就立刻把清理结果落盘 —— 否则磁盘上仍留着过期原文,每次启动重算一遍
    dropped = invalid + expired
    if dropped:
        write_json_atomic(path, cleaned, indent=indent)
    return cleaned, dropped


def iso_now() -> str:
    """当前 UTC 时间 ISO8601(秒级)—— 与各模块既有的 ``_now_iso()`` 同格式。

    放在这里是因为本仓所有落盘记录都用这个格式,新写的字段必须能被
    :func:`parse_timestamp` 认出来(否则将来又要加一条解析分支)。
    """
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
