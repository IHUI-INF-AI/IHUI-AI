# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""代码索引出域同意闸(2026-10-03 数据出域合规整改立)。

为什么存在这个文件
------------------
语义代码索引必须把**源码切片**送外部 embedding 服务计算向量
(`codebase_indexer._generate_embeddings_batch` → `llm_gateway.embed` →
`litellm.aembedding`,默认模型 `text-embedding-3-small`)。而在此之前,这条外发
路径**没有任何同意闸**:用户没做任何动作,agent 一次 `search_codebase` 语义通道
空结果就会触发懒索引,把整个仓库的代码切片发往外部 —— 与 2026-09 智谱 ZCode
「未经知情把用户仓库数据传上 MaaS」同型,且隐蔽得多(用户甚至看不到"上传"字样)。

本模块提供**显式 opt-in 同意闸**的三件事:
  1. 判定:某个用户(或全局默认)是否已同意代码出域;
  2. 登记:同意/撤销,并原子落盘(进程重启不丢);
  3. 留痕:记录同意发生的时间与来源,便于事后审计与举证。

设计取舍(刻意为之,勿随意简化)
--------------------------------
- **默认不同意**(`IHUI_CODE_INDEX_EGRESS=1` 可全局开)。理由同上:代码出域是
  高敏感动作,不能用"缺省即允许"。
- **零新依赖**:沿用本仓 vector_memory 等模块既有的 `.data/*.json` + 临时文件
  rename 原子写范式,不引入 DB/Redis 依赖(同意记录量级极小,一个 JSON 足够)。
- **全局默认 ≠ 逐用户同意**:两者分开存。全局开关是部署方在已履行告知义务后的
  默认值;per-user 记录是用户自己的决定。全局开着时用户仍可单独关闭(本模块以
  per-user 的显式 False 覆盖全局 True —— 逐用户决定永远更强,与 2026-10-03
  wiki 闸的 "显式 false > env" 同一条纪律)。
- **fail-closed**:读盘失败一律按"未同意"处理。任何"存不下就读不到"的降级方向,
  都必须倒向"不出域",而不是倒向"出域"。

对外接口(全部同步、纯本地,便于在热路径上无阻塞调用)
--------------------------------------------------------
    has_consent(user_id) -> bool
    grant(user_id, source=...) -> None
    revoke(user_id) -> None
    apply_user_opt_out(user_id, opted_out, source=...) -> None   ← 2026-10-03 新增
    get_state(user_id) -> ConsentState
    global_default() -> bool
    set_global_default(value: bool) -> None

唯一的 IO 例外(启动期,不在热路径):
    await preload_opt_outs_from_db() -> int                ← 2026-10-03 新增
"""

from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger("code_index_consent")


# ---------------------------------------------------------------------------
# 常量与路径
# ---------------------------------------------------------------------------

#: 全局默认开关的环境变量名。置 "1" 表示部署方已在隐私政策中披露并取得用户
#: 授权(如私有化部署、企业内部环境),此时**未逐用户登记**的用户也视为同意。
ENV_GLOBAL_DEFAULT = "IHUI_CODE_INDEX_EGRESS"

_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".data")
_PERSIST_PATH = os.path.join(_DATA_DIR, "code_index_consent.json")

#: 单文件 consent 记录的形状版本号。为将来字段增删留出迁移判据。
_SCHEMA_VERSION = 1


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------


@dataclass
class ConsentState:
    """某一维度(用户或全局)的同意状态快照。"""

    #: 用户是否已同意代码出域。None = 从未表态(即未同意,默认拒绝)。
    granted: bool | None = None
    #: 表态发生时间(ISO8601);None = 从未表态。
    decided_at: str | None = None
    #: 表态来源标识(如 "user_settings" / "cli_flag" / "global_default"),便于审计。
    source: str | None = None
    #: 全局默认值(仅 global_default() 返回时非 None)。
    global_default: bool | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "granted": self.granted,
            "decided_at": self.decided_at,
            "source": self.source,
            "global_default": self.global_default,
        }


@dataclass
class _Store:
    """进程内状态 + 落盘载荷。"""

    #: user_id -> ConsentState(仅存已表态的;从未表态的不落条目,读时按未同意)
    users: dict[str, ConsentState] = field(default_factory=dict)
    #: 部署方设置的全局默认值;None = 未设置(走 env)
    global_default: bool | None = None


# ---------------------------------------------------------------------------
# 读写(进程内 + 原子落盘)
# ---------------------------------------------------------------------------

_lock = threading.RLock()
_store = _Store()
_hydrated = False


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _env_global_default() -> bool:
    """从 env 读全局默认。只有字面量 "1" 为真(与全仓其它 env 开关同一口径)。"""
    return os.environ.get(ENV_GLOBAL_DEFAULT, "").strip() == "1"


def _load() -> None:
    """从磁盘载入(进程内只做一次)。读盘失败 = 不 hydrated = 全部按未同意。

    这里刻意不吞异常后回退成"同意":读不到同意记录就当没同意,是 fail-closed。
    """
    global _hydrated
    with _lock:
        if _hydrated:
            return
        _hydrated = True  # 无论成败只尝试一次,避免热路径反复 IO
        try:
            with open(_PERSIST_PATH, encoding="utf-8") as fh:
                raw = json.load(fh)
        except FileNotFoundError:
            return  # 首次运行:空的,正常
        except (OSError, json.JSONDecodeError, TypeError) as exc:
            # 损坏 ≠ 可信。记 error(不是 warning:这是需要人介入的异常态),
            # 但不抛 —— 热路径不能因同意存储坏掉而崩。
            logger.error("代码索引同意记录读取失败,本进程按『未同意』处理: %s", exc)
            return
        if not isinstance(raw, dict):
            logger.error("代码索引同意记录格式异常(非对象),按『未同意』处理")
            return
        users = raw.get("users")
        if isinstance(users, dict):
            for uid, item in users.items():
                if not isinstance(uid, str) or not isinstance(item, dict):
                    continue
                granted = item.get("granted")
                if not isinstance(granted, bool):
                    continue  # 非法值当作没表态
                _store.users[uid] = ConsentState(
                    granted=granted,
                    decided_at=item.get("decided_at") if isinstance(item.get("decided_at"), str) else None,
                    source=item.get("source") if isinstance(item.get("source"), str) else None,
                )
        gd = raw.get("global_default")
        if isinstance(gd, bool):
            _store.global_default = gd


def _persist_locked() -> None:
    """原子落盘(调用方须已持锁)。写盘失败只记 error,不抛。

    落盘失败的后果:该次表态在本进程内仍然有效(内存表已改),但重启后丢失,
    即回到 fail-closed 的"未同意"—— 这正是我们希望的方向(宁可少索引,不可偷跑)。
    """
    payload = {
        "version": _SCHEMA_VERSION,
        "global_default": _store.global_default,
        "users": {uid: st.as_dict() for uid, st in _store.users.items()},
    }
    try:
        os.makedirs(_DATA_DIR, exist_ok=True)
        tmp = _PERSIST_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, _PERSIST_PATH)  # 原子替换,避免半截文件
    except OSError as exc:
        logger.error("代码索引同意记录落盘失败(本进程内仍生效,重启后需重新授权): %s", exc)


def reset_for_tests() -> None:
    """清空进程内状态并重置 hydrated 标记(仅测试用)。"""
    global _hydrated
    with _lock:
        _store.users.clear()
        _store.global_default = None
        _hydrated = False


# ---------------------------------------------------------------------------
# 对外接口
# ---------------------------------------------------------------------------


def global_default() -> bool:
    """部署方设置的全局默认值(优先持久化记录,其次 env)。"""
    _load()
    with _lock:
        if _store.global_default is not None:
            return _store.global_default
        return _env_global_default()


def set_global_default(value: bool, *, persist: bool = True) -> None:
    """设置全局默认值。部署方 API/运维入口使用。"""
    _load()
    with _lock:
        _store.global_default = bool(value)
        if persist:
            _persist_locked()


def get_state(user_id: str | None) -> ConsentState:
    """取某用户的同意状态快照(不改变任何状态)。"""
    _load()
    with _lock:
        st = _store.users.get((user_id or "").strip()) if user_id else None
        gdef = _store.global_default if _store.global_default is not None else _env_global_default()
        if st is None:
            return ConsentState(granted=None, global_default=gdef)
        return ConsentState(
            granted=st.granted,
            decided_at=st.decided_at,
            source=st.source,
            global_default=gdef,
        )


def has_consent(user_id: str | None) -> bool:
    """用户是否已同意"代码内容发往外部 embedding 服务"。

    判定优先级(从强到弱,**显式拒绝永远压过全局允许**):
      1. 该用户显式 False ⇒ 否(即便全局开着);
      2. 该用户显式 True  ⇒ 是;
      3. 未表态 + 全局默认 True ⇒ 是(部署方已履行告知义务);
      4. 其余(未表态 + 无全局默认)⇒ 否 ← **默认拒绝**。
    """
    _load()
    uid = (user_id or "").strip()
    with _lock:
        st = _store.users.get(uid) if uid else None
        if st is not None and st.granted is not None:
            return bool(st.granted)
        gdef = _store.global_default if _store.global_default is not None else _env_global_default()
        return bool(gdef)


def grant(user_id: str, *, source: str = "user_settings", persist: bool = True) -> None:
    """登记用户同意。user_id 为空时拒绝登记(无法归属的同意没有意义)。"""
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("grant 需要非空 user_id:无法归属的同意不得登记")
    _load()
    with _lock:
        _store.users[uid] = ConsentState(granted=True, decided_at=_now_iso(), source=source)
        if persist:
            _persist_locked()
    logger.info("已登记代码索引出域同意:user=%s source=%s", uid, source)


def revoke(user_id: str, *, source: str = "user_settings", persist: bool = True) -> None:
    """撤销用户同意(显式 False)。user_id 为空时按"清掉全局"处理,防误伤。"""
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("revoke 需要非空 user_id")
    _load()
    with _lock:
        _store.users[uid] = ConsentState(granted=False, decided_at=_now_iso(), source=source)
        if persist:
            _persist_locked()
    logger.info("已撤销代码索引出域同意:user=%s source=%s", uid, source)


def clear_statement(user_id: str, *, persist: bool = True) -> None:
    """清除某用户的**表态**,让他回到"从未表态"状态(而非"显式拒绝")。

    为什么需要"清除"这个动作(而不是第三种存法)
    ------------------------------------------
    隐私页那个键 `codeIndexEgressOptOut` 是 **opt-out** 语义:`false` 的意思是
    "用户没有要求阻止",而**不是**"用户已授权代码出域"。这两句话在合规上差得极远:
    前者是"我没反对",后者是"我同意把源码发到外部 embedding 服务"。

    所以当用户把开关拨回"不阻止"时,正确落法是**删掉自己的表态**,让判定链回到
    第 3/4 档(未表态 ⇒ 看 `IHUI_CODE_INDEX_EGRESS` ⇒ 默认仍是"否")。
    若在这里图省事写成 `grant()`,后果是:用户 merely 表达过"我不想阻止"这件事,
    就被当成"他授权了代码出域" —— 这是把缺省当同意,方向恰好与本模块的
    fail-closed 第一原则相反,也与 `auto_memory_optout` 里"opt-out=false ⇒ 开启"
    那种"回到默认"语义不同(那里默认是**开**,这里是默认**不开**)。

    落库形态:直接删除该用户的键(而不是存 `granted=None`)。`_load` 逐条只接受
    bool 型的 `granted`,`None` 会被当作非法值跳过 —— 即"存了也读不出来",是
    一个骗人的落库形态。删除是唯一让"未表态"真正可表达的动作。
    """
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("clear_statement 需要非空 user_id")
    _load()
    with _lock:
        if _store.users.pop(uid, None) is None:
            # 本来就没表态过:是幂等的成功,不是错误(重放同一份设置不该报错)
            return
        if persist:
            _persist_locked()
    logger.info("已清除代码索引出域表态(回到未表态):user=%s", uid)


def apply_user_opt_out(
    user_id: str,
    opted_out: bool,
    *,
    source: str = "user_settings",
    persist: bool = True,
) -> None:
    """把隐私页的 `codeIndexEgressOptOut` 开关落成 per-user 表态(2026-10-03)。

    这是**设置写入的语义入口**:`apps/api` 的 `PUT /settings/privacy` 收到这个键
    后经内部服务通道调到这里(`routers/code_index_consent_api.py`),`mcp_server`
    的两处闸门继续只读 `has_consent`,不需要知道设置从哪来。

    映射(极性在这一处集中,别处不再重复推导):

    ==================  ==========================  =====================
    ``codeIndexEgressOptOut``  本模块的动作            判定结果
    ==================  ==========================  =====================
    ``True``(阻止)          ``revoke``(显式 False)   **恒为"否"**,压过全局开启
    ``False``(不阻止)        ``clear_statement``      回到未表态 ⇒ 看全局 ⇒ 默认"否"
    ==================  ==========================  =====================

    两种落法都**不会**产生"同意":用户在这个界面里没有任何一个动作能被解释为
    "我授权把源码发往外部服务"(那需要一次单独的、显式的授权动作 = `grant`)。
    这不是保守,这是 `code_index_consent` 存在的理由 —— 开关上线不该顺手把
    "缺省拒绝"改写成"缺省允许"。

    因此"默认行为不变"这条要求在实现上是**恒等式**:缺省(用户从没碰过这个开关)
    根本不会调到这里,`has_consent` 继续按未表态处理。
    """
    if opted_out:
        revoke(user_id, source=source, persist=persist)
    else:
        clear_statement(user_id, persist=persist)


# ---------------------------------------------------------------------------
# 启动自愈(直读 user_preferences)
# ---------------------------------------------------------------------------

#: 隐私设置分组(该列在表里叫 `group`,不是 `category` —— 与
#: apps/api/src/services/raw-retention-optout.ts 的 GROUP_PRIVACY 同值)。
GROUP_PRIVACY = "privacy"

#: 隐私页那个键(**opt-out** 语义,'true' = 用户要求阻止代码出域)。
KEY_CODE_INDEX_EGRESS_OPT_OUT = "codeIndexEgressOptOut"


async def preload_opt_outs_from_db() -> int:
    """启动时从 `user_preferences` 读回已 opt-out 的用户,补上丢失的同意表。

    为什么需要这一步(这是本模块唯一的 IO,值得说清)
    ----------------------------------------------
    同意表落在**本进程**的 `.data/code_index_consent.json`。容器被重建(发版、
    扩缩容、`docker compose down -v`)⇒ 那份文件没了 ⇒ 本进程回到"全部未表态"。
    对没 opt-out 的用户无害(未表态 = 默认拒绝 = 与其现状一致);但对**已 opt-out
    的用户**是"闸门被静默重置成从未表态"—— 在全局 `IHUI_CODE_INDEX_EGRESS=1`
    的部署上会**恢复代码出域**,正是这次整改要消除的行为。

    所以本函数让闸门状态跨容器重建存活,不依赖"用户必须再点一次开关"。

    为什么放在这里(启动期 async)而不是每次判定时
    --------------------------------------------
    `has_consent` 刻意是同步纯本地(见文件头"对外接口"),不能改成每次查库。
    启动期读一次是"批量一次 + 之后纯本地",与 `auto_memory_optout` 同一个权衡
    (它选择每次读、因为调用点在每轮对话一次;本闸在 MCP 工具的关键路径上,
    且已有"默认拒绝"兜底,不需要每次付 IO)。

    方向:读库失败**不**把已登记的表态清掉,只保留现状(可能偏"拒绝"),并记 error。
    这与本模块 fail-closed 原则一致:任何降级都倒向"不出域"。
    """
    from .memory_service import _get_pool  # 延迟导入:避免与 memory_service 成环

    try:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT user_id, value FROM user_preferences
                   WHERE "group" = $1 AND key = $2""",
                GROUP_PRIVACY,
                KEY_CODE_INDEX_EGRESS_OPT_OUT,
            )
    except Exception as exc:  # noqa: BLE001 - 启动期自愈失败不得阻断服务启动
        logger.error(
            "代码索引同意表启动自愈失败,已 opt-out 的用户可能退回『未表态』"
            "(方向:偏拒绝,不恢复出域。降级理由见本函数 docstring): %s",
            exc,
        )
        return 0

    # 只认字面量 "true"(与全仓其它布尔开关同一口径):库里存的是 opt-out 键,
    # 'true' ⇒ 用户要求阻止 ⇒ 登记为显式拒绝。其余值一律不当成"已阻止"。
    blocked = 0
    for row in rows:
        try:
            uid = str(row["user_id"]).strip()
            value = row["value"]
        except (KeyError, IndexError, TypeError):
            continue
        if not uid or value is None:
            continue
        if str(value).strip().lower() != "true":
            continue
        revoke(uid, source="startup_rehydrate", persist=False)
        blocked += 1

    if blocked:
        # 一次性落盘即可:上面用 persist=False 是为了避免每行一次 rename。
        _load()
        with _lock:
            _persist_locked()
    logger.info("代码索引同意表启动自愈完成:已阻止出域的用户=%d", blocked)
    return blocked
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
