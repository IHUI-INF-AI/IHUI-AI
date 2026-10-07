# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""票 G-1058650 残格补件:Python 侧**常驻**复核双端 parity 夹具里的 `reasoningCases` 数值。

背景(为什么这是真缺口):
`819a31b5b` 往 `packages/context-compaction/tests/fixtures/parity.json` 追加了
`reasoningCases` + `reverseLock` 两个键,并新增 TS 端 spec
`packages/context-compaction/tests/reasoning-parity.test.ts`。票面判定是**分支 B**
(Python 镜像端"少算 reasoning"这一型**不可达** ⇒ 不给 Python 加投机对齐分支),
但当时写进夹具的三个 Python 数值(`tokensPyAsShipped`)是一次性现跑冻结的:
"Python 侧没有常驻读取器读 `reasoningCases` 的数值 ⇒ 源码改了不会被自动复核"。
本文件就是把这一格补成常驻件:每次跑测试都调**生产估算出口**
`app.core.context_compaction.estimate_messages_tokens` 现场重算,并与夹具逐值对账。

本件**证什么 / 不证什么**:
- 证:Python 现场值 == 夹具钉住的 `tokensPyAsShipped`;由它派生的 `crossEndGap` /
  `blindSkew` 两个登记数值也逐值不变(现场重算一遍算式)。
- 证:两端**不等**这个状态本身(跨端差严格 > 0 且被显式登记),以及"Python 对
  reasoning 键完全盲"这个不变量(摘掉 reasoning 后 Python 值一字不变)。
- **不**证"两端相等":Python 按设计不计 reasoning,把两端做相等是错的,
  所以本文件绝不改 `app/core/context_compaction.py`,也不复刻 TS 判据
  (不 import JS、不在 Python 里重写 `projectForEstimation` / BPE 估算)。
- TS 侧数值(`tokensTs` / `tokensTsReasoningBlind` / `reasoningContributionTs`)由
  `reasoning-parity.test.ts` 各端自测;本件只把它们当**夹具原文**参与算式核对。

隔离(AGENTS §5):纯读夹具 + 纯函数调用;不连 PostgreSQL / Redis,不写任何文件。
`app.core.context_compaction` 的 import 链实测只拉 `app.core.tunables` + `tiktoken`
(无 asyncpg/sqlalchemy/redis),故**不需要** `monkeypatch`;`tests/conftest.py` 的
autouse 隔离(`_isolate_ab_test_db` 等)仍照常兜底。
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.context_compaction import estimate_messages_tokens

# ==================== 夹具读取(相对 __file__ 推仓库根,禁硬编码盘符) ====================

_FIXTURE_REL = Path("packages") / "context-compaction" / "tests" / "fixtures" / "parity.json"
# 本件要现场重算的那个出口所在的生产文件(同时也是"Python 不认识 reasoning"的源码证据)
_ESTIMATOR_REL = Path("apps") / "ai-service" / "app" / "core" / "context_compaction.py"


def _find_repo_root() -> Path:
    """从 __file__ 往上找真正含该夹具的目录当仓库根(不猜层数、不写盘符)。"""
    here = Path(__file__).resolve()
    for candidate in here.parents:
        if (candidate / _FIXTURE_REL).is_file():
            return candidate
    raise AssertionError(
        f"未能在 {here} 的上溯目录里找到 {_FIXTURE_REL.as_posix()};仓库根推不出来 ⇒ 本件无法复核"
    )


REPO_ROOT = _find_repo_root()


@lru_cache(maxsize=1)
def _fixture() -> dict[str, Any]:
    path = REPO_ROOT / _FIXTURE_REL
    if not path.is_file():
        raise AssertionError(f"夹具文件不存在: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise AssertionError(f"夹具顶层不是对象: {type(data).__name__}")
    return data


def _reasoning_cases() -> list[dict[str, Any]]:
    block = _fixture().get("reasoningCases")
    if not isinstance(block, dict):
        raise AssertionError("夹具里没有顶层 `reasoningCases` 键 ⇒ 本件要复核的那一格不存在(原文被删?)")
    cases = block.get("cases")
    if not isinstance(cases, list):
        raise AssertionError(f"`reasoningCases.cases` 不是数组而是 {type(cases).__name__}")
    return cases


def _reasoning_key_names() -> list[str]:
    names = _fixture()["reasoningCases"].get("reachabilitySentinel", {}).get("reasoningKeyNames")
    if not isinstance(names, list) or not names:
        raise AssertionError("`reachabilitySentinel.reasoningKeyNames` 缺失或为空 ⇒ 哨兵没有键名可枚举")
    return [str(n) for n in names]


def _reverse_lock() -> dict[str, Any]:
    lock = _fixture().get("reverseLock")
    if not isinstance(lock, dict):
        raise AssertionError("夹具里没有顶层 `reverseLock` 键 ⇒ 反向锁那一格不存在(原文被删?)")
    return lock


# ==================== 现场重算出口(唯一 seam,便于反向锁自证"真的调了") ====================

#: 记录每一次对生产出口的真实调用结果,供反向锁自证"本件确实调用了被测函数"。
LIVE_CALL_LOG: list[int] = []


def _live_py_estimate(messages: list[dict[str, Any]]) -> int:
    """现场重算:直调生产估算出口 **本身**(不在测试里重写任何估算规则)。"""
    result = estimate_messages_tokens(messages)
    LIVE_CALL_LOG.append(result)
    return result


def _strip_reasoning_keys(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """摘掉 reasoning 键的同一批消息(= Python 端实际看得到的信息量,与 TS spec 同语义)。"""
    names = set(_reasoning_key_names())
    return [{k: v for k, v in msg.items() if k not in names} for msg in messages]


# ==================== 字段分类(逐值对账范围由夹具原文决定,不靠记忆) ====================

#: 夹具 `expect` 里**由 Python 现场重算决定**的数值字段(名字照抄夹具原文)。
PY_OWNED_FIELDS = ("tokensPyAsShipped", "crossEndGap", "blindSkew")
#: 夹具 `expect` 里属于 TS 端、本件只当原文常数参与算式的数值字段。
TS_OWNED_FIELDS = ("tokensTs", "tokensTsReasoningBlind", "reasoningContributionTs")


def _mismatch(case_id: str, field: str, pinned: Any, live: Any) -> str:
    return f"[{case_id}] 字段名={field} 夹具值={pinned} 现场值={live}"


# ==================== 反向锁(防 no-op / 防假绿):证明本件真的读、真的算 ====================

# 两段与夹具无关的探针输入:任何"返回夹具里那个常数"的假实现都会在下面两条断言里露馅
# (常数桩对两段不同输入给出同一个返回值)。
_PROBE_SHORT: list[dict[str, Any]] = [{"role": "user", "content": "a"}]
_PROBE_LONG: list[dict[str, Any]] = [
    {"role": "user", "content": "a b c d e f g h i j k l m n o p q r s t u v w x y z"}
]


def test_reverse_lock_fixture_actually_exposes_python_values():
    """反向锁①:夹具必须真的给出**可复核的 Python 值**;读到 0 条 ⇒ 主动 fail,绝不 skip。"""
    cases = _reasoning_cases()
    assert cases, "夹具里没有可复核的 Python 值:reasoningCases.cases 读到 0 条用例"

    checked_any = False
    for case in cases:
        case_id = str(case.get("id", "<无 id>"))
        expect = case.get("expect")
        assert isinstance(expect, dict), f"[{case_id}] 夹具用例缺 expect 对象 ⇒ 没有可对账的数值"
        py_fields = [f for f in PY_OWNED_FIELDS if f in expect]
        assert py_fields, (
            f"夹具里没有可复核的 Python 值:用例 [{case_id}] 的 expect 里一个 Python 侧数值字段"
            f"({'/'.join(PY_OWNED_FIELDS)})都没有;现有键={sorted(expect)}"
        )
        for field in py_fields:
            assert isinstance(expect[field], int) and not isinstance(expect[field], bool), (
                f"[{case_id}] 字段名={field} 夹具值={expect[field]!r} 不是整数 ⇒ 无法逐值对账"
            )
        checked_any = True
    assert checked_any

    # 夹具原文若新增了本件未登记的数值字段,必须显式失败(否则"逐值"会静默缩水)
    known = set(PY_OWNED_FIELDS) | set(TS_OWNED_FIELDS)
    for case in cases:
        case_id = str(case.get("id", "<无 id>"))
        unexpected = sorted(set(case["expect"]) - known)
        assert not unexpected, (
            f"[{case_id}] 夹具 expect 出现本常驻件未登记的字段 {unexpected} ⇒ "
            f"必须先判它属于 Python 侧还是 TS 侧再纳入逐值对账"
        )


def test_reverse_lock_live_seam_delegates_to_production_estimator():
    """反向锁②:现场重算 seam 必须**真的委托**给生产估算函数,不许退化成"回显夹具常数"。"""
    assert estimate_messages_tokens.__module__ == "app.core.context_compaction", (
        f"被测出口不是生产函数: __module__={estimate_messages_tokens.__module__}"
    )

    before = len(LIVE_CALL_LOG)
    short_live = _live_py_estimate(_PROBE_SHORT)
    long_live = _live_py_estimate(_PROBE_LONG)
    assert len(LIVE_CALL_LOG) - before == 2, "现场重算 seam 未真实调用生产估算出口(记账为空)"

    # ①委托保真:seam 的返回值必须等于直接调生产出口
    assert short_live == estimate_messages_tokens(_PROBE_SHORT), "seam 未忠实委托生产估算出口(短探针)"
    assert long_live == estimate_messages_tokens(_PROBE_LONG), "seam 未忠实委托生产估算出口(长探针)"
    # ②反常数桩:真估算随内容变长而变大;返回夹具常数的假实现对两段输入给同一个值
    assert long_live > short_live, (
        f"现场重算疑似「回显常数」的假实现:长短探针同值 long={long_live} short={short_live}"
    )

    pinned = {
        int(c["expect"]["tokensPyAsShipped"]) for c in _reasoning_cases()
    } | {int(_reverse_lock()["tokensPyAsShipped"])}
    assert long_live not in pinned and short_live not in pinned, (
        f"探针输入与夹具无关,现场值却撞上夹具钉住的常数 {sorted(pinned)} ⇒ 现场重算被写成了夹具常数"
    )


# ==================== 主用例:reasoningCases 的 Python 侧数值逐值对账 ====================


def test_reasoning_cases_python_values_match_live_recomputation():
    """每条用例的每个 Python 侧数值字段:现场重算 vs 夹具钉值,不等即红并给三要素。"""
    cases = _reasoning_cases()
    assert cases, "夹具里没有可复核的 Python 值:reasoningCases.cases 读到 0 条用例"

    mismatches: list[str] = []
    for case in cases:
        case_id = str(case.get("id", "<无 id>"))
        expect = case["expect"]
        messages = case["input"]["messages"]

        before = len(LIVE_CALL_LOG)
        live = _live_py_estimate(messages)
        _live_py_estimate(_strip_reasoning_keys(messages))  # 返回值弃用;调用本身的记账副作用被下方断言钉住
        assert len(LIVE_CALL_LOG) - before == 2, (
            f"[{case_id}] 未对夹具消息列表现场重算两次(含 reasoning / 摘 reasoning)"
        )

        # tokensPyAsShipped:Python 端 shipped 消息的现场值
        if live != expect["tokensPyAsShipped"]:
            mismatches.append(_mismatch(case_id, "tokensPyAsShipped", expect["tokensPyAsShipped"], live))
        # crossEndGap / blindSkew:由 Python 现场值重新算一遍登记的算式
        live_gap = expect["tokensTs"] - live
        if live_gap != expect["crossEndGap"]:
            mismatches.append(
                _mismatch(
                    case_id,
                    "crossEndGap(算式 tokensTs - tokensPyAsShipped)",
                    expect["crossEndGap"],
                    live_gap,
                )
            )
        live_skew = expect["tokensTsReasoningBlind"] - live
        if live_skew != expect["blindSkew"]:
            mismatches.append(
                _mismatch(
                    case_id,
                    "blindSkew(算式 tokensTsReasoningBlind - tokensPyAsShipped)",
                    expect["blindSkew"],
                    live_skew,
                )
            )

    assert not mismatches, (
        "reasoningCases 的 Python 侧数值与现场重算不等(逐字段给「字段名 + 夹具值 + 现场值」):\n  "
        + "\n  ".join(mismatches)
    )


def test_python_reasoning_blind_and_cross_end_inequality_is_registered():
    """按设计不计 reasoning:摘掉 reasoning 后 Python 值一字不变,跨端差被显式钉成 > 0。"""
    mismatches: list[str] = []
    for case in _reasoning_cases():
        case_id = str(case.get("id", "<无 id>"))
        expect = case["expect"]
        messages = case["input"]["messages"]
        py_counts_reasoning = case.get("pyCountsReasoning")
        carriers = [
            m for m in messages if any(k in _reasoning_key_names() for k in m)
        ]
        assert carriers, f"[{case_id}] 夹具消息里没有任何 reasoning 键 ⇒ 这一格已静默退化成普通用例"

        live = _live_py_estimate(messages)
        live_blind = _live_py_estimate(_strip_reasoning_keys(messages))

        if py_counts_reasoning is True:
            # 唯一合法前提:生产面真的出现了带 reasoning 的消息写入点(见哨兵用例),届时两端同值
            same = live == expect["tokensTs"]
            if not same:
                mismatches.append(_mismatch(case_id, "tokensTs(Python 已计 reasoning)", expect["tokensTs"], live))
        else:
            # 登记的是"Python 不计":含/不含 reasoning 两种输入必须给同一个 Python 值
            if live != live_blind:
                mismatches.append(
                    _mismatch(
                        case_id,
                        "reasoningBlind 不变量(Python 对 reasoning 键必须完全盲)",
                        live_blind,
                        live,
                    )
                )
            gap = expect["tokensTs"] - live
            if gap <= 0:
                mismatches.append(
                    _mismatch(case_id, "crossEndGap(必须严格 > 0,不等才是本票登记的现状)",
                              expect["crossEndGap"], gap)
                )

        # 源码证据:Python 估算面至今不认识任何 reasoning 键名
        estimator_text = (REPO_ROOT / _ESTIMATOR_REL).read_text(encoding="utf-8")
        mentioned = [n for n in _reasoning_key_names() if re.search(rf"""['"]{re.escape(n)}['"]""", estimator_text)]
        if py_counts_reasoning is not True:
            assert not mentioned, (
                f"生产估算源码 {_ESTIMATOR_REL.as_posix()} 开始引用 reasoning 键名 {mentioned},"
                f"而夹具用例 [{case_id}] 仍登记 pyCountsReasoning=false ⇒ 判据与夹具漂移,必须先改票面判定"
            )

    assert not mismatches, "Python 侧 reasoning-blind / 跨端差值登记被打破:\n  " + "\n  ".join(mismatches)


def test_reverse_lock_baseline_slice_is_still_cross_end_equal():
    """反向锁③a(`reverseLock.baseline` 切片格):既有 24 条纯 ASCII 消息,Python 值不动。

    这一格「两端同值」**仍然为真**(CJK 只追加在下标 24/25,没动过前 24 条),所以仍按
    「同值」判 —— 与整列格(③b)不同,那里两端**不再**相等,按差值判。
    """
    lock = _reverse_lock()
    messages = _fixture()["input"]["messages"]
    baseline = lock["baseline"]
    base = messages[: int(lock["baselineMessageCount"])]
    assert len(base) == int(baseline["messageCount"]), (
        f"切片长度与夹具登记不符:取到 {len(base)} 条,登记 messageCount={baseline['messageCount']}"
    )
    live = _live_py_estimate(base)
    assert live == baseline["tokensPyAsShipped"], _mismatch(
        "reverseLock.baseline", "tokensPyAsShipped(前 24 条)", baseline["tokensPyAsShipped"], live
    )
    # 前 24 条两端同值:TS 侧那一半由 reasoning-parity.test.ts 现场重算自查,
    # 本件只核对「Python 现场值 == 登记的 Python 值」并确认两端登记值确实相等。
    assert baseline["tokensTs"] == baseline["tokensPyAsShipped"], _mismatch(
        "reverseLock.baseline", "tokensTs vs tokensPyAsShipped(两端登记值应同值)",
        baseline["tokensTs"], baseline["tokensPyAsShipped"],
    )
    # 切片锁的前提:整列确实比切片更长(CJK 只追加在尾部,不改前 24 条)。
    assert len(messages) > int(lock["baselineMessageCount"]), (
        f"整列 {len(messages)} 条未长于切片 {lock['baselineMessageCount']} 条 ⇒ "
        "「CJK 只追加在尾部」这条前提不成立,切片锁失去意义"
    )


def test_reverse_lock_full_column_gap_is_nailed_not_equality():
    """反向锁③b(整列格):Python 现场值不动,且跨端**差值**逐值钉死。

    ⚠️ 判据为什么从「两端必须同值」换成「差值 == 夹具登记值」(这条判据原先锚在一个
    **已失效的前提**上,而失效是正确状态):
      · 夹具 `input.messages` 尾部追加了 2 条 CJK 消息(下标 24/25),既有 24 条未动。
      · 追加后整列(26 条)两端**不再相等**:TS=29500 / Python=29558,差 -58。
      · 根因是两端**不是同一套 BPE 词表**:TS 侧 `packages/context-compaction/src/token-estimate.ts`
        的 `import { encode } from 'gpt-tokenizer'` 默认走 o200k_base,Python 侧
        `tiktoken.get_encoding("cl100k_base")`;差在 CJK 上被放大。
      · 所以「两端同值」这个前提**曾经为真、现在为假,且为假是正确状态**。
        继续拿「必须同值」当判据,就是**逼人改 29558 去保绿** —— 一条把真相判红的尺子
        教出来的就是谎报。故这一格改按**差值逐值钉死**:量的是「哪把尺子在量什么」,
        不是量出来的数(29500 / 29558 / -58 三个读数一个都不许动)。
    """
    lock = _reverse_lock()
    messages = _fixture()["input"]["messages"]
    live = _live_py_estimate(messages)
    assert live == lock["tokensPyAsShipped"], _mismatch(
        "reverseLock", "tokensPyAsShipped(整列 Python 现场值)", lock["tokensPyAsShipped"], live
    )
    # 差值逐值钉死:算式 tokensTs - tokensPyAsShipped == crossEndGapFullColumn
    live_gap = lock["tokensTs"] - live
    assert live_gap == lock["crossEndGapFullColumn"], _mismatch(
        "reverseLock",
        "crossEndGapFullColumn(算式 tokensTs - tokensPyAsShipped)",
        lock["crossEndGapFullColumn"],
        live_gap,
    )
    # 两端「不等」是本票登记的**正确现状**(词表分歧未修),不是待修的漂移。
    # 显式钉住它:若哪天两端真的同值(gap==0),说明词表已统一,这一格必须改判而不是继续绿。
    assert live_gap != 0, (
        f"整列两端算出了同值(gap=0,夹具登记 crossEndGapFullColumn={lock['crossEndGapFullColumn']})"
        "⇒ 词表可能已统一,本格的判据与登记值必须一起改,不许靠改数字保绿"
    )


# ==================== 可达性哨兵(按键名枚举;门牙由合成源码自证) ====================
#
# 与 TS 侧 `packages/context-compaction/tests/reasoning-parity.test.ts` 的
# `scanSourceTextForReasoningMessageWriteForms` **同判据、同四形态**(同语义不是同实现:
# 本件不 import JS,也不在 Python 里复刻 TS 的估算面)。
#
# 四形的判据**完全是同一条**:同一条语句内既有 `role` 键又有 reasoning 键。
# 扩的只是"语句边界怎么圈出来",不是"什么算命中"。
#
# | 形态 | 锚点(只确认这一行是候选) | 块边界怎么圈 |
# |---|---|---|
# | `append-call` | `.append(` | 从 `(` 起配平 `()` |
# | `update-call` | `.update(` | 从 `(` 起配平 `()` |
# | `spread-dict` | `**` | 回溯到包裹它的未配平 `{`,再从那里配平 `{}` |
# | `helper-kwargs` | `role=`(kwargs 写法) | 回溯到包裹它的未配平 `(`,再从那里配平 `()` |
#
# 为什么 `.update({...})` 也要求 role 键在**同一个块**里(而不是"块外某处已有 role"):
# 一旦允许跨语句追数据流,判据就退化成"这个文件里某处有 role、某处有 reasoning",
# 现状树里 603 个文件处处是 `role=`,那样的门谁都喊、等于没门(仓规:宁可漏报不可误报)。
# 代价是**已知盲区**(msg 早先构造好 role、随后单独 `msg.update({"reasoning": ...})`
# 不报),此处显式登记而不是假装覆盖。

_APPEND_START_RE = re.compile(r"\.append\(")
_UPDATE_START_RE = re.compile(r"\.update\(")
#: `{**base, "reasoning": ...}` 展开形 —— 锚点直接落在 `**` 这个**展开记号**上,
#: 再回溯到包裹它的 `{`,所以单行形(`x = {**a, ...}`)与多行形(`= {` 换行后 `**a, ...}`)
#: 走的是同一条代码路径。
_SPREAD_RE = re.compile(r"\*\*")
#: helper / SDK 的间接构造:`role=` 是**关键字实参**而不是 `"role":` 字面量键。
#: 用**后顾断言**而非前缀字符组,是为了让 `search()` 返回的列号**正好落在 `role` 词首** ——
#: 下面的 `_enclosing_open()` 要从那儿往回找未配平的 `(`。
#: `(?<![\w"])` 排除两种误报:更长标识符(`my_role=`)、字符串里的 `role=`(f-string / 字面量键)。
_ROLE_KWARG_RE = re.compile(r"""(?<![\w"])role\s*=\s*(?!=)""")
_APPEND_ROLE_RE = re.compile(r"""['"]role['"]\s*:""")

#: 写入面形态名(变异对照与台账登记用,不是判据的一部分)。
WRITE_FORMS = ("append-call", "update-call", "spread-dict", "helper-kwargs")


def _append_key_re(key_names: list[str]) -> re.Pattern[str]:
    alt = "|".join(re.escape(k) for k in key_names)
    return re.compile(rf"""['"](?:{alt})['"]\s*:""")


def _reasoning_kwarg_re(key_names: list[str]) -> re.Pattern[str]:
    """reasoning 键的 **kwargs 写法**(`reasoning=...`)—— 形④ 判"块内有 reasoning"用。"""
    alt = "|".join(re.escape(k) for k in key_names)
    return re.compile(rf"""(?<![\w"])(?:{alt})\s*=\s*(?!=)""")


def _item_write_re(key_names: list[str]) -> re.Pattern[str]:
    alt = "|".join(re.escape(k) for k in key_names)
    return re.compile(
        rf"""\b(?:msg|message|m|assistant_msg|new_msg|messages\[-1\])\s*\[\s*['"](?:{alt})['"]\s*\]\s*=(?!=)"""
    )


def _block_scan_max_lines() -> int:
    """块边界扫描上限(行)。

    与 TS 侧 `BLOCK_SCAN_MAX_LINES` **同一口径 12 行**,并按Python 侧真实树实测取依据
    (不是照抄;探针见 `.ihui-agent/tmp/probe-py-forms.py`)。`apps/ai-service/app`
    现读 603 个 `.py`,四形态锚点规模与配平情况:

    | 形态 | 锚点 | 文件 | 块最长 | 12 行内配不平 |
    |---|---|---|---|---|
    | `append-call` | 2806 | 335 | 12 | 36 |
    | `update-call` | 91 | 51 | **9** | 0 |
    | `spread-dict` | 2915(`**`) / 114(`{**`) | 315 / 48 | 12 | 185 |
    | `helper-kwargs` | 123 | 49 | **7** | 3 |

    取 12 的理由:两种新形态的实参/展开块最长 9 / 7 行,都 <= 12 ⇒ 12 行**够用**;
    而放宽的代价是实的 —— append 面那 2806 处锚点里已有 36 处(长追加/跨语句)
    在 12 行内配不平,上限一放宽它们就被纳入判断 ⇒ 误报风险上升。
    本门宁可漏报不可误报,故**不动**这个上限(与 TS 侧同结论、同依据)。
    """
    return 12


def _balanced_block(
    lines: list[str],
    start_line: int,
    start_col: int,
    open_ch: str,
    close_ch: str,
) -> str | None:
    """从 (行号, 列号) 起做括号配平,返回配平的块文本。

    超上限仍未配平 ⇒ 返回 None(保守不计,避免把邻块切进来)。
    **刻意不用 `slice(at ± N)` 那种固定字符窗口**:本仓踩过那个坑
    (`def heal(opts={}):` 的默认值里就有 `{}`,从声明处直接找第一个 `{`
    会把函数体切成 2 字符)。这里一律从**确切的锚点列**起、按配平取到闭符号。
    """
    depth = 0
    opened = False
    parts: list[str] = []
    last = min(len(lines), start_line + _block_scan_max_lines())
    for i in range(start_line, last):
        seg = lines[i][start_col:] if i == start_line else lines[i]
        parts.append(seg)
        for ch in seg:
            if ch == open_ch:
                depth += 1
                opened = True
            elif ch == close_ch:
                depth -= 1
        if opened and depth <= 0:
            return "\n".join(parts)
    return None


def _enclosing_open(
    lines: list[str],
    line: int,
    col: int,
    open_ch: str,
    close_ch: str,
) -> tuple[int, int] | None:
    """从 (行号, 列号) 往回溯,找**包裹它的那对括号里尚未配平的开括号**的位置;找不到返回 None。

    `role=` / `**` 可能出现在多行调用的中间行
    (`SessionMessage(\\n    role=..., \\n    reasoning=...)`、`= {\\n    **base, ...}`),
    所以块起点必须能往回走,不能只看本行有没有开括号。
    """
    depth = 0
    for i in range(line, -1, -1):
        seg = lines[i][:col] if i == line else lines[i]
        for k in range(len(seg) - 1, -1, -1):
            ch = seg[k]
            if ch == close_ch:
                depth += 1
            elif ch == open_ch:
                if depth == 0:
                    return (i, k)
                depth -= 1
    return None


def scan_python_reasoning_message_write_forms(rel: str, text: str) -> list[dict[str, Any]]:
    """扫一份 Python 源码,返回"消息 dict 携带 reasoning 键"的写入点(`{行号, 形态}`)。

    判据(四形态统一,见上表):**同一条语句内既有 `role` 键又有 reasoning 键**。
    取块一律靠括号配平:调用形先配平 `()`、dict 字面量形先配平 `{}`;
    `role=`/reasoning kwarg 形则先回溯到未配平的 `(` 再配平 `()`。
    `_block_scan_max_lines()`(=12)行内不配平则不计。

    ⚠️ 块内配平是**字符级**的:字符串字面量里的括号也会计入深度。本仓踩过这个坑
    (`"("` 之类),但它的失效方向是"多配平几行 ⇒ 块变大 ⇒ 更可能误报",而误报面已由
    下面每形态的阴性用例盯着;Python 侧真实树现读 0 写入点(见常驻哨兵用例)。
    """
    key_names = _reasoning_key_names()
    key_re = _append_key_re(key_names)
    reasoning_kwarg_re = _reasoning_kwarg_re(key_names)
    item_re = _item_write_re(key_names)
    found: dict[int, str] = {}
    # 与 TS 侧 `text.split(/\r?\n/)` 同一口径(不把 CRLF 的 `\r` 留在行尾)
    lines = re.split(r"\r?\n", text)

    def claim(line_idx: int, form: str) -> None:
        # 同一行命中多形态时保留**形态序最靠前**的那个:一行只算一个写入点,
        # 否则 `messages.append(msg.update({...}))` 这种嵌套会被重复计数。
        if line_idx not in found:
            found[line_idx] = form

    for i, line in enumerate(lines):
        # 形①:事后下标补键 `msg["reasoning"] = ...`
        if item_re.search(line):
            claim(i, "append-call")
            continue

        # 形②:`xxx.append(...)` —— 从 `(` 起配平 `()`
        at = _APPEND_START_RE.search(line)
        if at is not None:
            open_col = at.start() + line[at.start():].index("(")
            block = _balanced_block(lines, i, open_col, "(", ")")
            if block is not None and _APPEND_ROLE_RE.search(block) and key_re.search(block):
                claim(i, "append-call")

        # 形③:`xxx.update({...})` —— 同样从 `(` 起配平 `()`
        at = _UPDATE_START_RE.search(line)
        if at is not None:
            open_col = at.start() + line[at.start():].index("(")
            block = _balanced_block(lines, i, open_col, "(", ")")
            if block is not None and _APPEND_ROLE_RE.search(block) and key_re.search(block):
                claim(i, "update-call")

        # 形④:`{**base, "reasoning": ...}` 展开形 —— 锚点落在 `**` 上,再回溯到包裹它的 `{`。
        # 单行形(`x = {**base, ...}`)与多行形(`= {` 换行后 `**base, ...}`)走同一条路径。
        at = _SPREAD_RE.search(line)
        if at is not None:
            open_pos = _enclosing_open(lines, i, at.start(), "{", "}")
            if open_pos is not None:
                block = _balanced_block(lines, open_pos[0], open_pos[1], "{", "}")
                if (
                    block is not None
                    and "**" in block
                    and _APPEND_ROLE_RE.search(block)
                    and key_re.search(block)
                ):
                    claim(i, "spread-dict")

        # 形⑤:helper / SDK 间接构造 `SessionMessage(role=..., reasoning=...)`。
        # role 以 **kwargs** 写法出现 ⇒ 回溯到包裹它的未配平 `(` 再配平 `()`。
        at = _ROLE_KWARG_RE.search(line)
        if at is not None:
            open_pos = _enclosing_open(lines, i, at.start(), "(", ")")
            if open_pos is not None:
                block = _balanced_block(lines, open_pos[0], open_pos[1], "(", ")")
                if block is not None and reasoning_kwarg_re.search(block):
                    claim(i, "helper-kwargs")

    return [
        {"line": line_idx + 1, "form": form}
        for line_idx, form in sorted(found.items())
    ]


def scan_python_reasoning_message_write_points(rel: str, text: str) -> list[str]:
    """`scan_python_reasoning_message_write_forms` 的 `rel:行号` 视图(既有调用方不变)。"""
    return [f"{rel}:{h['line']}" for h in scan_python_reasoning_message_write_forms(rel, text)]


def _walk_py_files(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*.py") if p.is_file())


def _scan_app_tree() -> list[str]:
    scanned_root = str(_fixture()["reasoningCases"]["reachabilitySentinel"]["scannedRoot"])
    base = REPO_ROOT / scanned_root
    if not base.is_dir():
        raise AssertionError(f"哨兵扫描根不存在: {base}(scannedRoot 原文=`{scanned_root}`)")
    files = _walk_py_files(base)
    assert files, f"哨兵扫描根 {scanned_root} 里一个 .py 文件都没有 ⇒ 哨兵是空跑的假门"
    hits: list[str] = []
    for path in files:
        rel = path.relative_to(REPO_ROOT).as_posix()
        hits.extend(scan_python_reasoning_message_write_points(rel, path.read_text(encoding="utf-8")))
    return sorted(hits)


def test_sentinel_has_teeth_three_synthetic_sources():
    """哨兵自证:三段合成源码做正反对照,证明这条门既喊得出来也不误报。"""
    # (1) messages.append 里同时出现 role + reasoning ⇒ 必须报出
    append_snippet = "\n".join(
        [
            "def _append_assistant(messages: list[dict[str, Any]], content: str, thinking: str) -> None:",
            "    messages.append({",
            '        "role": "assistant",',
            '        "content": content,',
            '        "reasoning": thinking,',
            "    })",
        ]
    )
    assert scan_python_reasoning_message_write_points("fake/writer.py", append_snippet) == [
        "fake/writer.py:2"
    ], "哨兵漏报:带 role 的 messages.append 里出现 reasoning 键却没被喊出"

    # (2) 事后往消息 dict 补 reasoning 键 ⇒ 必须报出
    item_snippet = "\n".join(
        [
            'msg = {"role": "assistant", "content": text}',
            'msg["reasoning_content"] = thinking',
        ]
    )
    assert scan_python_reasoning_message_write_points("fake/writer2.py", item_snippet) == [
        "fake/writer2.py:2"
    ], "哨兵漏报:事后补 reasoning 键的写入点没被喊出"

    # (3) 现状形态:只有响应/事件字典带 reasoning ⇒ 不得报(否则哨兵谁都喊,等于没门)
    response_snippet = "\n".join(
        [
            'result: dict[str, Any] = {"content": c, "model": m}',
            'reasoning = getattr(response.choices[0].message, "reasoning_content", None)',
            "if reasoning:",
            '    result["reasoning"] = reasoning',
            'accumulated: dict[str, Any] = {"content": "", "reasoning": ""}',
        ]
    )
    assert scan_python_reasoning_message_write_points("fake/current-shape.py", response_snippet) == [], (
        "哨兵误报:响应/事件字典的 reasoning 被判成了消息写入点"
    )


# ==================== 四形态各配阳性/阴性双向用例(证明扩出来的判据有牙) ====================
#
# 每形态两条:**阳性**(该形态真的携带 reasoning ⇒ 必须报出写入点)+ **阴性**(形态像但不含
# reasoning ⇒ 必须不报)。缺任一条即"证明不了有牙",故成对写死。
# 这套用例与 TS 侧 `reasoning-parity.test.ts` 的「残余③ 四形态双向用例」逐条对等。

#: 夹具原文里没有 `crossEndGapFullColumn` 之外的语义 ——
#: 哨兵的形态枚举本身被登记(新增形态必须同时改这里和台账)。
def _forms_of(lines: list[str]) -> list[str]:
    return [h["form"] for h in scan_python_reasoning_message_write_forms("fake/x.py", "\n".join(lines))]


def _hits_of(lines: list[str]) -> list[dict[str, Any]]:
    return scan_python_reasoning_message_write_forms("fake/x.py", "\n".join(lines))


# ---- 形① `append-call`:既有面(原两形之一),补一条阴性把「同块」钉住 ----
def test_append_form_positive_and_negative():
    """阳性:append 块内 role + reasoning ⇒ 报出。阴性:块内只有 role ⇒ 不报。"""
    positive = [
        "def _append_assistant(messages: list[dict[str, Any]], content: str, thinking: str) -> None:",
        "    messages.append({",
        '        "role": "assistant",',
        '        "content": content,',
        '        "reasoning": thinking,',
        "    })",
    ]
    assert _hits_of(positive) == [{"line": 2, "form": "append-call"}], (
        "哨兵漏报:带 role 的 messages.append 里出现 reasoning 键却没被喊出"
    )
    negative = [
        "    messages.append({",
        '        "role": "assistant",',
        '        "content": content,',
        "    })",
    ]
    assert _hits_of(negative) == [], "哨兵误报:append 块内只有 role、无 reasoning 却被判成写入点"


def test_append_form_negative_reasoning_without_role():
    """阴性:append 块内有 reasoning 但无 role ⇒ 不报(不变式要求 role 与 reasoning 同块)。"""
    lines = [
        "    iterations.append({",
        '        "reasoning": note,',
        '        "tool_calls": calls,',
        "    })",
    ]
    assert _hits_of(lines) == [], (
        "哨兵误报:无 role 的自评记录 append 被判成了消息写入点"
        "(那正是现状树里 skill_scheduler.py:240 那一类,不能算消息写入点)"
    )


# ---- 形② `update-call` ----
def test_update_form_positive_role_and_reasoning_in_same_block():
    """阳性:.update 块内带 role + reasoning ⇒ 必须报出写入点。"""
    lines = [
        "def _patch(messages: list[dict[str, Any]], thinking: str) -> None:",
        "    msg = messages[-1]",
        "    msg.update({",
        '        "role": "assistant",',
        '        "content": text,',
        '        "reasoning_content": thinking,',
        "    })",
    ]
    assert _hits_of(lines) == [{"line": 3, "form": "update-call"}], (
        "哨兵漏报:.update 块内 role + reasoning 同现却没被喊出"
    )


def test_update_form_negative_only_role_no_reasoning():
    """阴性:同样的 update 块但只有 role、无 reasoning ⇒ 必须不报。"""
    lines = [
        "    msg.update({",
        '        "role": "assistant",',
        '        "content": text,',
        "    })",
    ]
    assert _hits_of(lines) == [], "哨兵误报:.update 块内只有 role、无 reasoning 却被判成写入点"


def test_update_form_negative_reasoning_without_role():
    """阴性:块内有 reasoning 但无 role ⇒ 必须不报(不变式要求 role 与 reasoning 同块)。

    ⚠️ 键名用**逐名**匹配的 `reasoning`(不是 `reasoning_effort` 这类更长标识符):
    后者压根不在 `reachabilitySentinel.reasoningKeyNames` 里,拿它当阴性样例的话,
    这条用例在 reasoning 键正则整个坏掉时**照样绿** —— 证明不了有牙。
    """
    lines = [
        "    cfg.update({",
        '        "model": name,',
        '        "reasoning": effort,',
        "    })",
    ]
    assert _hits_of(lines) == [], (
        "哨兵误报:配置字典的 reasoning 被判成了消息写入点(块内无 role ⇒ 不该命中)"
    )


def test_longer_identifier_is_not_a_reasoning_key():
    """阴性:`reasoning_effort` 这类**更长标识符**不是 reasoning 键(键名逐名匹配,非前缀匹配)。

    这条独立于上面那条:即便块里带了 role,也不该命中 —— 否则哨兵会把
    `{"role": "assistant", "reasoning_effort": "high"}` 这种配置写误当消息写入点。
    """
    lines = [
        "    cfg.update({",
        '        "role": "assistant",',
        '        "reasoning_effort": "high",',
        "    })",
    ]
    assert _hits_of(lines) == [], (
        "哨兵误报:reasoning_effort 被当成了 reasoning 键(键名判定必须是逐名匹配,不是前缀匹配)"
    )


# ---- 形③ `spread-dict`(`{**base, ...}`) ----
def test_spread_form_positive_single_line():
    """阳性:** 展开后同块内出现 role 键 + reasoning 键 ⇒ 必须报出写入点。"""
    lines = [
        "def _merge_reasoning(base: dict[str, Any], thinking: str) -> dict[str, Any]:",
        '    return {**base, "role": "assistant", "reasoning": thinking}',
    ]
    assert _hits_of(lines) == [{"line": 2, "form": "spread-dict"}], (
        "哨兵漏报:单行 ** 展开里 role + reasoning 同现却没被喊出"
    )


def test_spread_form_positive_multiline_needs_backtrack_to_open_brace():
    """阳性:多行展开,`{` 与 `**` 分落两行 ⇒ 必须报出(证明回溯到未配平 `{` 生效)。"""
    lines = [
        "    new_messages[0] = {",
        "        **new_messages[0],",
        '        "role": "assistant",',
        '        "reasoning_content": block,',
        "    }",
    ]
    # 报出行号 = `**` 锚点所在行(=2),不是 `{` 所在行:锚点落在展开记号上,定位更精确。
    assert _hits_of(lines) == [{"line": 2, "form": "spread-dict"}], (
        "哨兵漏报:多行 ** 展开(需回溯到未配平 `{`)里 role + reasoning 同现却没被喊出"
    )


def test_spread_form_negative_only_content_no_role_no_reasoning():
    """阴性:展开块里只有 content、没有 role 与 reasoning ⇒ 必须不报。

    这正是真实树里 `routers/llm.py` `new_messages[0] = {**new_messages[0], "content": merged}` 的形态。
    """
    lines = ['    new_messages[0] = {**new_messages[0], "content": merged}']
    assert _hits_of(lines) == [], "哨兵误报:只改 content 的 ** 展开被当成了消息写入点"


def test_spread_form_negative_role_in_one_block_reasoning_in_another():
    """阴性:展开块里有 role 但 reasoning 在**另一个块** ⇒ 必须不报(同块不变式)。"""
    lines = ['    msg = {**base, "role": "assistant"}', '    other = {"reasoning": t}']
    assert _hits_of(lines) == [], (
        "哨兵误报:role 与 reasoning 分处两块也被判成同一条语句(跨语句追数据流会让门谁都喊)"
    )


# ---- 形④ `helper-kwargs`(第三方 helper / SDK 的 kwargs 写法) ----
def test_helper_form_positive_single_line():
    """阳性:构造消息对象的调用里 role= 与 reasoning= 同现 ⇒ 必须报出写入点。"""
    lines = [
        "from openai.types.chat import ChatCompletionMessage",
        '    msg = ChatCompletionMessage(role="assistant", content=c, reasoning=thinking)',
    ]
    assert _hits_of(lines) == [{"line": 2, "form": "helper-kwargs"}], (
        "哨兵漏报:helper kwargs 里 role= 与 reasoning= 同现却没被喊出"
    )


def test_helper_form_positive_multiline_needs_backtrack_to_open_paren():
    """阳性:多行 kwargs,reasoning= 落在后续行 ⇒ 必须报出(须能回溯到未配平的 `(`)。"""
    lines = [
        "    messages.append(",
        "        SessionMessage(",
        '            role="assistant",',
        "            content=c,",
        "            reasoning=thinking,",
        "        )",
        "    )",
    ]
    assert _hits_of(lines) == [{"line": 3, "form": "helper-kwargs"}], (
        "哨兵漏报:多行 helper kwargs(须回溯到未配平 `(`)里 reasoning= 却没被喊出"
    )


def test_helper_form_negative_no_reasoning_kwarg():
    """阴性:同一个 helper 调用但没有 reasoning= ⇒ 必须不报。"""
    lines = ['    msg = SessionMessage(role="assistant", content=c)']
    assert _hits_of(lines) == [], "哨兵误报:没有 reasoning= 的 helper 调用被当成了写入点"


def test_helper_form_negative_fstring_role_brace():
    """阴性:f-string 里的 role={role} 与别处的 reasoning 不构成同一条语句 ⇒ 必须不报。"""
    lines = [
        '    reasons.append(f"移除空 content(role={role})")',
        '    reasoning = getattr(resp.choices[0].message, "reasoning_content", None)',
    ]
    assert _hits_of(lines) == [], "哨兵误报:f-string 文本里的 role={role} 被当成了实参"


def test_helper_form_negative_fstring_with_both_words():
    """阴性:role= 与 reasoning= 都出现在 f-string 文本里 ⇒ 必须不报。"""
    lines = ['    log.info(f"role={role} reasoning={reasoning}")']
    assert _hits_of(lines) == [], "哨兵误报:f-string 文本里的 role=/reasoning= 被当成了同一条语句的实参"


# ---- 取块正确性:禁固定字符窗口(本仓踩过的坑) ----
def test_block_extraction_trap_empty_dict_in_default_arg():
    """取块阳性:形参默认值里的空 `{}` 不得把体切成 2 字符(必须从锚点列起配平)。"""
    # 若用「从声明处找第一个 `{`」的老写法,这里会切到 `{}` 而漏报;
    # 正解是从 `.append(` 的 `(` 起配平。
    lines = [
        "def heal_unresponsive_services(opts={}, messages=[]) -> None:",
        "    messages.append({",
        '        "role": "assistant",',
        '        "reasoning": t,',
        "    })",
    ]
    assert _hits_of(lines) == [{"line": 2, "form": "append-call"}], (
        "哨兵漏报:形参默认值里的空 {} 把块切坏了(退回固定字符窗口的老写法了)"
    )


def test_one_line_counts_once_for_nested_calls():
    """取块:同一行只算一个写入点(嵌套调用不重复计数)。"""
    lines = ['    messages.append(msg.update({"role": "a", "reasoning": t}))']
    assert _forms_of(lines) == ["append-call"], "同一行的嵌套调用被重复计数了"


def test_four_forms_do_not_cross_contaminate():
    """四形态互不串味:每种形态只认自己那一条语句。"""
    lines = [
        'a.update({"role": "assistant", "thinking": t})',        # 形② update
        'b = {**base, "role": "assistant", "reasoning": t}',     # 形③ spread
        'c = SessionMessage(role="assistant", reasoning=t)',     # 形④ helper
        'd.append({"role": "assistant", "reasoning": t})',       # 形① append
    ]
    assert _hits_of(lines) == [
        {"line": 1, "form": "update-call"},
        {"line": 2, "form": "spread-dict"},
        {"line": 3, "form": "helper-kwargs"},
        {"line": 4, "form": "append-call"},
    ], "四形态的判据串味了(某个形态认错了形态的语句)"


def test_write_forms_enumeration_is_registered():
    """形态枚举本身被登记(四形态都在册,新增形态必须同时改这里和台账)。"""
    assert list(WRITE_FORMS) == ["append-call", "update-call", "spread-dict", "helper-kwargs"]


def test_scan_upper_limit_is_twelve_lines_within_same_ruler_as_ts():
    """块扫描上限与 TS 侧同口径 12 行(放宽会引入误报,见 `_block_scan_max_lines` 的实测依据)。"""
    assert _block_scan_max_lines() == 12


def test_reachability_sentinel_app_tree_write_points_still_match_ledger():
    """常驻哨兵:重扫 `apps/ai-service/app` 整棵树,写入点数必须仍等于夹具登记的数目。"""
    registered = _fixture()["reasoningCases"]["reachabilitySentinel"][
        "pythonReasoningMessageWritePointsAtAuthoringTime"
    ]
    hits = _scan_app_tree()
    assert len(hits) == registered, (
        f"不可达前提已失效,本票要翻成分支 A:生产面出现 {len(hits)} 处"
        f"「带 role 的消息写入点携带 reasoning 键」(夹具登记={registered})。\n"
        f"  写入点: {hits}\n"
        f"  ⇒ 需给 app/core/context_compaction.py 补 reasoning 对齐分支,"
        f"并把各用例的 pyCountsReasoning 翻 true 走同值对账(届时 tokensTs 必须等于 Python 现场值)。"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
