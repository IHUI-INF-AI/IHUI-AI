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
    } | {int(_fixture()["reverseLock"]["tokensPyAsShipped"])}
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
        live_blind = _live_py_estimate(_strip_reasoning_keys(messages))
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


def test_reverse_lock_key_number_without_reasoning_is_still_live():
    """反向锁③(夹具 `reverseLock` 格):不含 reasoning 的既有 24 条消息,Python 值不动。"""
    lock = _fixture().get("reverseLock")
    assert isinstance(lock, dict), "夹具里没有顶层 `reverseLock` 键"
    messages = _fixture()["input"]["messages"]
    live = _live_py_estimate(messages)
    assert live == lock["tokensPyAsShipped"], _mismatch("reverseLock", "tokensPyAsShipped", lock["tokensPyAsShipped"], live)
    # 这一格两端本就同值:TS 原文值必须仍等于 Python 现场值(跨端零漂移)
    assert live == lock["tokensTs"], _mismatch("reverseLock", "tokensTs(TS 原文) vs Python 现场值", lock["tokensTs"], live)


# ==================== 可达性哨兵(按键名枚举;门牙由合成源码自证) ====================

_APPEND_START_RE = re.compile(r"\.append\(")
_APPEND_ROLE_RE = re.compile(r"""['"]role['"]\s*:""")


def _append_key_re(key_names: list[str]) -> re.Pattern[str]:
    alt = "|".join(re.escape(k) for k in key_names)
    return re.compile(rf"""['"](?:{alt})['"]\s*:""")


def _item_write_re(key_names: list[str]) -> re.Pattern[str]:
    alt = "|".join(re.escape(k) for k in key_names)
    return re.compile(
        rf"""\b(?:msg|message|m|assistant_msg|new_msg|messages\[-1\])\s*\[\s*['"](?:{alt})['"]\s*\]\s*=(?!=)"""
    )


def scan_python_reasoning_message_write_points(rel: str, text: str) -> list[str]:
    """扫一份 Python 源码,返回"带 role 的消息写入点携带 reasoning 键"的位置(`rel:行号`)。

    与 TS spec 的哨兵同语义(不是同实现):
    - `xxx.append({..., "role": ..., "reasoning": ...})`:同一条 append 语句里既有 `role`
      键又有 reasoning 键才算消息写入点;靠括号配平界定语句体,12 行内不配平则不计(保守)。
    - `msg["reasoning_content"] = ...`:事后往消息 dict 补键的写入面。
    只有响应/事件字典带 reasoning(`result["reasoning"]`、`accumulated = {... "reasoning": ...}`)
    **不算**消息写入点。
    """
    key_re = _append_key_re(_reasoning_key_names())
    item_re = _item_write_re(_reasoning_key_names())
    hits: list[str] = []
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if item_re.search(line):
            hits.append(f"{rel}:{i + 1}")
        if not _APPEND_START_RE.search(line):
            continue
        depth = 0
        started = False
        block = ""
        for j in range(i, min(len(lines), i + 12)):
            block += lines[j] + "\n"
            for ch in lines[j]:
                if ch == "(":
                    depth += 1
                    started = True
                elif ch == ")":
                    depth -= 1
            if started and depth <= 0:
                break
        if started and depth <= 0 and _APPEND_ROLE_RE.search(block) and key_re.search(block):
            hits.append(f"{rel}:{i + 1}")
    return sorted(hits)


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
