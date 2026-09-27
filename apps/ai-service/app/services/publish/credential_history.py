# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""凭据覆盖的「先压历史、再落新值」唯一出口(2026-09-27 从 scan_login 抽出并扩到全部写点)。

分工,与"该不该覆盖"那条防线不重叠:
- `scan_login.should_overwrite_existing_credentials` 管「这次**该不该**覆盖」;
- 本模块管「**已经覆盖了以后还能不能恢复**」。两者不同层,都要有 —— 只有前一条时,
  一旦裁决放行(verify 通过)或走了首建分支,旧密文依然是**一次性**的。

立因是当轮一次真实破坏:csdn id=12 的 38 字段密文被 11 字段失效集换掉,而**密文没有备份
⇒ 不可回滚**,损失无法弥补。表里已有 `extra jsonb` 可用,所以不新增表、不加迁移。

抽成唯一出口的理由:HEAD 上曾有三处**无条件覆盖** `credentials_enc` 的写点 ——
扫码/画像导入落库(`scan_login._save_account_to_db`)、保活守护轮换回写
(`cookie_refresh_daemon.refresh_single`)、前台编辑(`routers/publish` 的 PUT
`/accounts/{account_id}`)。旧版只有第一处接了历史层,另两处照旧把旧密文盖成一次性。
两处实现必漂移,所以语句与判据只留这一份;除本模块外,`app/**` 不得再出现写
`credentials_enc` 的 UPDATE,也不得再出现历史键的字面量(由
`tests/test_credential_history_all_write_sites.py` 的源码面锁钉住)。

密文不进日志:本模块只报数量/类型名,任何路径都不打 `enc` 内容。
"""
from __future__ import annotations

import json
import time
from collections.abc import Mapping
from typing import Any, NamedTuple

from ...core.logging import get_logger

logger = get_logger(__name__)

#: 旧凭据在 `publish_accounts.extra` 里的唯一键名;恢复侧只认这一个名字,不得有第二个
CREDENTIALS_HISTORY_KEY = "credentialsHistory"
#: 历史条数上限,超出丢最旧。**有界是硬要求**:extra 是共享列,无界增长迟早把别人的键挤出包
CREDENTIALS_HISTORY_MAX = 3
#: 「库里这份算不算有内容」—— 与 `scan_login._existing_account_row` 的 SQL 判据同形
#: (`credentials_enc IS NOT NULL AND length(credentials_enc) > 2`),两处必须一起改。
_MIN_MEANINGFUL_ENC_LEN = 3


class CredentialsHistoryPlan(NamedTuple):
    """`build_credentials_history_extra` 的结论(纯数据,不碰 DB)。

    - `extra is None` ⇒ 本次**不动 extra 列**,走原写入。两种来路由 `degraded` 区分:
      `False` = 库里没有可留的旧密文(正常,不许往历史里塞垃圾);
      `True` = 历史准备失败/输入不可信 ⇒ 调用方必须吼(见 `_save_account_to_db`)。
    - `extra` 非 None ⇒ 用它整体写回该列;别人的键已逐字带在这个对象里,不是"清掉重建"。
    """

    extra: dict[str, Any] | None
    degraded: bool
    note: str


def build_credentials_history_extra(
    raw_extra: object | None,
    previous_enc: object | None,
    source_note: str | None,
    *,
    at: str,
    limit: int = CREDENTIALS_HISTORY_MAX,
) -> CredentialsHistoryPlan:
    """给定「旧 extra + 旧密文 + 本次来源」⇒ 新 extra 对象,或降级标记。**不依赖 DB**。

    三条判据次序是设计前提,不要重排:
    1. 旧密文空/过短 ⇒ 直接放过(`extra` 给 None,不降级)。留一条空串进历史等于把"可回滚"
       写成假账,而且每次覆盖都多一条垃圾。
    2. 旧 extra 解不出**对象** ⇒ **降级**。这不是"没有别人的键",而是"读不懂别人的键" ——
       在这种前提下写 extra 有覆盖掉他人数据的风险,所以宁可少一层保险。
    3. 合法对象 ⇒ 只在原字典上增/换 `credentialsHistory` 这一个键,其余键**逐字不动**。

    `credentialsHistory` 自身若不是列表,按空历史重建:该键是本函数独占的,非列表值本来就
    不可读,保留它只会让恢复侧读到脏结构;别人的键不受影响。
    """
    if not isinstance(previous_enc, str) or len(previous_enc) < _MIN_MEANINGFUL_ENC_LEN:
        return CredentialsHistoryPlan(None, False, "库里没有可留的旧密文,本次不建历史")

    base: dict[str, Any]
    if raw_extra is None:
        base = {}
    elif isinstance(raw_extra, dict):
        base = dict(raw_extra)
    elif isinstance(raw_extra, str):
        text = raw_extra.strip()
        if not text:
            base = {}
        else:
            try:
                parsed = json.loads(text)
            except Exception as e:  # noqa: BLE001 — 坏 JSON 只是"读不懂别人的键",不是导入失败
                return CredentialsHistoryPlan(
                    None, True, f"旧 extra 不是合法 JSON({type(e).__name__})"
                )
            if not isinstance(parsed, dict):
                return CredentialsHistoryPlan(
                    None, True, f"旧 extra 解出来不是对象而是 {type(parsed).__name__}"
                )
            base = parsed
    else:
        return CredentialsHistoryPlan(
            None, True, f"旧 extra 类型不认识({type(raw_extra).__name__})"
        )

    prior_raw = base.get(CREDENTIALS_HISTORY_KEY)
    prior = [e for e in prior_raw if isinstance(e, dict)] if isinstance(prior_raw, list) else []

    entry: dict[str, Any] = {
        "enc": previous_enc,
        "at": at,
        "reason": (str(source_note).strip() if source_note else "") or "未知来源",
    }
    base[CREDENTIALS_HISTORY_KEY] = ([entry] + prior)[:limit]
    return CredentialsHistoryPlan(base, False, "")


async def _load_overwrite_preimage(conn: Any, account_id: Any) -> tuple[object, object, str]:
    """读回这一行**当前**的 `credentials_enc` / `extra`(覆盖前的镜像)。

    刻意与"找行"那条 SELECT 分开,并且**自己吞异常返回说明串**:这一层是附加保险,结构上
    不许把原写入拖下水(列不存在、行落空、连接抖动都只意味着"这次少一层保险")。
    只报异常**类型名**不打消息 —— 消息里可能带上列内容,而日志不是密文的存放处。
    """
    try:
        prev = await conn.fetchrow(
            "SELECT credentials_enc, extra FROM publish_accounts WHERE id=$1",
            account_id,
        )
    except Exception as e:  # noqa: BLE001
        return "", None, f"读取覆盖前镜像失败({type(e).__name__})"
    if prev is None:
        return "", None, "读取覆盖前镜像落空(该行已不在)"
    enc: object = prev["credentials_enc"]
    extra: object = prev["extra"]
    return enc, extra, ""


async def apply_credentials_update(
    conn: Any,
    account_id: Any,
    new_enc: str,
    *,
    source_note: str | None,
    display_name: str | None = None,
    mark_verified: bool = False,
    merge_extra: Mapping[str, Any] | None = None,
) -> None:
    """写 `credentials_enc` 的**唯一**语句:一条 UPDATE 同时落新密文与新 extra。

    读旧行(镜像)→ `build_credentials_history_extra` 算新 extra → 一条 UPDATE 落库。
    历史准备失败(镜像读不到 / 旧 extra 解不出对象)⇒ **退回不含 extra 的原语句并喊 error**
    —— 失效方向是「宁可少一层保险,也不弄坏原写入」,但不得静默(§5e 失败必须响)。

    一条语句的硬要求:不得先写密文再写 extra(那会给并发读者留一个"新凭据 + 无历史"的
    空窗,而且抹掉别人的键)。

    三个既有写点的参数形状(语义各自一字未改):
    - 扫码/画像导入:`display_name=<新展示名>` + `mark_verified=True` + `source_note=verify_msg`
      —— 即历史版那条 UPDATE 的逐位同形(`$1` 密文、`$2` 展示名、`$3` 行 id、`$4` 验证说明);
    - 保活守护轮换:只传 `source_note` ⇒ 仅 credentials_enc / extra / updated_at;
    - 前台 PUT 编辑:传 `merge_extra=body.extra`(可空)⇒ 调用方给的新 extra 键合进来,
      但历史键归本出口独占(客户端回传的旧历史不得覆盖本轮刚压进去的那一条)。

    `merge_extra` 的两格如实登记:正常档 ⇒ 在(旧 extra ⊕ 新历史)之上逐键覆盖,历史键除外;
    降级/无需历史档 ⇒ 整体按 `merge_extra` 落库 —— 那正是本机制存在之前各写点对 extra 的
    原有行为,降级不得让调用方**少**写掉它本来要写的内容。
    """
    try:
        prev_enc, prev_extra, preimage_note = await _load_overwrite_preimage(conn, account_id)
        plan = (
            CredentialsHistoryPlan(None, True, preimage_note)
            if preimage_note
            else build_credentials_history_extra(
                prev_extra,
                prev_enc,
                source_note,
                at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )
        )
    except Exception as e:  # noqa: BLE001 — 历史这一层的任何异常都不许毁掉原写入
        plan = CredentialsHistoryPlan(None, True, f"准备覆盖历史时抛异常({type(e).__name__})")
    if plan.degraded:
        logger.error(
            f"[credential_history] 账号 {account_id} 本次覆盖**未能建立回滚历史**({plan.note})"
            "⇒ 退回不带历史的原写入,旧密文自此不可恢复,请随后单独排查"
        )

    extra_obj: dict[str, Any] | None = plan.extra
    if extra_obj is not None:
        if merge_extra is not None:
            for key, value in merge_extra.items():
                if key != CREDENTIALS_HISTORY_KEY:
                    extra_obj[key] = value
    elif merge_extra is not None:
        extra_obj = dict(merge_extra)

    sets: list[str] = ["credentials_enc=$1"]
    args: list[Any] = [new_enc]
    idx = 2
    if display_name is not None:
        sets.append(f"display_name=${idx}")
        args.append(display_name)
        idx += 1
    id_ph = idx
    args.append(account_id)
    idx += 1
    if mark_verified:
        sets.append("status='active'")
        sets.append("last_verified_at=NOW()")
        sets.append(f"last_verify_msg=${idx}")
        args.append("" if source_note is None else str(source_note))
        idx += 1
    if extra_obj is not None:
        sets.append(f"extra=${idx}::jsonb")
        args.append(json.dumps(extra_obj, ensure_ascii=False))
        idx += 1
    sets.append("updated_at=NOW()")
    await conn.execute(
        f"UPDATE publish_accounts SET {', '.join(sets)} WHERE id=${id_ph}",
        *args,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
