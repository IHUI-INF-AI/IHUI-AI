# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""``context://`` 统一虚拟路径抽象(round 8 能力复现,对照 Trae ContextFS)。

立因:对照程序把工作区/会话/产物/技能等资源统一挂到 ``context://`` 虚拟命名空间下,
      调用方只认虚拟路径、不认宿主 FS 路径。本仓此前读零命中,故用本仓现有栈
      (Python 标准库 + 结构化 verdict 惯例)复现「行为与设计」,写自己的代码,
      不粘对方专有源码原文/反编译伪代码/凭据(AGENTS §0.12)。

判据(解析与鉴权合一,一次调用同时产出 canonical_path + namespace + verdict + reason):
      - 形状不认或输入取不到 ⇒ 显式 unjudged 并点名原因(§0.3),绝不回落到宿主 FS 路径拼接;
      - 八类安全判据命中 ⇒ denied + 枚举 reason;
      - 唯一成功出口才产出 canonical_path(恒为 ``context://`` 虚拟 URI,绝非宿主 FS 路径)。

一轴超越(对照只有「虚拟路径概念」):
      ① 解析与鉴权用同一把尺子、同一次调用完成,不存在「解析成功但鉴权没跑」的中间态;
      ② 半态显式拒绝:唯一返回出口 ``_emit`` 强制 allowed⇔规范路径齐备,任何半态一律改判
         unjudged / half_state_rejected,绝不把半成品当放行,也不当静默拒绝漏出去;
      ③ 每条拒绝都带可审计 reason 机器码 + 点名 detail,失效方向恒为「多要一次定向说明」(§0.10)。

刻意不做什么:不 import os.path / pathlib / 不读磁盘 / 不 realpath / 不解符号链接 /
      不把裸字符串当相对 FS 路径拼接(§0.3「绝不静默放行」);不引入任何第三方依赖;
      canonical_path 恒为 ``context://`` 前缀的虚拟 URI,调用方不得拿它当宿主 FS 路径用。
"""

from __future__ import annotations

import re
from enum import StrEnum


class Verdict(StrEnum):
    """结构化 verdict 三态:放行 / 拒绝 / 未判定。"""

    ALLOWED = "allowed"
    DENIED = "denied"
    UNJUDGED = "unjudged"


class Reason(StrEnum):
    """可审计 reason 机器码(单一真相源:测试 import 本枚举,不复制字面量,§0.6)。"""

    OK = "ok"
    NON_STRING_INPUT = "non_string_input"
    POLICY_SHAPE_INVALID = "policy_shape_invalid"
    WRONG_SCHEME = "wrong_scheme"
    MALFORMED_URI = "malformed_uri"
    MISSING_NAMESPACE_ROOT = "missing_namespace_root"
    TRAVERSAL = "traversal"
    ABSOLUTE_PATH = "absolute_path"
    EMPTY_SEGMENT = "empty_segment"
    URL_ENCODED = "url_encoded_bypass"
    CASE_VARIANT = "case_variant"
    CONTROL_CHAR = "control_char"
    SYMLINK_ESCAPE = "symlink_escape"
    UNREGISTERED_NAMESPACE = "unregistered_namespace"
    HALF_STATE = "half_state_rejected"


# 合法 reason 全集(唯一来源 = Reason 枚举;不手写第二份清单,§0.6)。
REASONS: frozenset[str] = frozenset(r.value for r in Reason)

# 默认四档白名单(可配置:调用方用 policy["allowed_namespaces"] 覆盖)。
DEFAULT_NAMESPACES: tuple[str, ...] = ("workspace", "session", "artifact", "skill")

_SCHEME = "context://"
_PERCENT_ENC = re.compile(r"%[0-9A-Fa-f]{2}")
_DRIVE_PREFIX = re.compile(r"^[A-Za-z]:([\\/]|$)")


def _emit(verdict: str, namespace: str | None, canonical_path: str | None,
          reason: str, detail: str) -> dict:
    """唯一返回出口(§0.6):把 verdict 与 canonical_path/reason 的一致性钉死。

    立因:对照允许「解析成功但鉴权没跑」的半态;本仓显式拒绝半态(超越轴②)。
    判据:allowed ⇒ canonical_path 必须是 ``context://`` 虚拟 URI 且 reason==OK;
          denied/unjudged ⇒ canonical_path 必须 None 且 reason 在枚举内且非 OK;
          任一不成立 ⇒ 改判 unjudged / half_state_rejected 并点名 detail。
    刻意不做什么:不在这里做二次解析/鉴权(解析与鉴权已在调用方一次完成),
          本出口只负责「结构化 verdict 不变量」这一件事,不碰文件系统。
    """
    def _half(why: str) -> dict:
        return {
            "verdict": Verdict.UNJUDGED.value,
            "namespace": namespace,
            "canonical_path": None,
            "reason": Reason.HALF_STATE.value,
            "detail": why,
        }

    if reason not in REASONS:
        return _half("reason 不在枚举内(半态显式拒绝,点名:需合法 reason 机器码)")
    if verdict == Verdict.ALLOWED.value:
        if canonical_path is None or not canonical_path.startswith(_SCHEME) or reason != Reason.OK.value:
            return _half("allowed 缺规范路径或原因非 OK(半态显式拒绝,点名:鉴权未齐不得放行)")
    else:
        if canonical_path is not None or reason == Reason.OK.value:
            return _half("denied/unjudged 却带规范路径或原因为 OK(半态显式拒绝)")
    return {
        "verdict": verdict,
        "namespace": namespace,
        "canonical_path": canonical_path,
        "reason": reason,
        "detail": detail,
    }


def _allowed_namespaces(policy: dict) -> frozenset[str] | None:
    """从 policy 取白名单;形状不认/取不到返回 None(§0.3 不默认放行)。"""
    allowed = policy.get("allowed_namespaces")
    if not isinstance(allowed, (list, tuple, set, frozenset)) or not allowed:
        return None
    if not all(isinstance(x, str) and x for x in allowed):
        return None
    return frozenset(allowed)


def _has_control_char(text: str) -> bool:
    """NUL/控制字符判定:任一码元 <0x20 或 ==0x7f 即命中(空格 0x20 不算)。"""
    return any(ord(ch) < 32 or ord(ch) == 127 for ch in text)


def _has_percent_encoding(text: str) -> bool:
    """URL 编码绕过判定:出现 %HH 形态即命中(含 %2e/%2f/%5c/%00)。"""
    return bool(_PERCENT_ENC.search(text))


def _is_absolute_injection(path: str) -> bool:
    """绝对路径注入判定:反斜杠(Windows/UNC)、盘符(C:\\ 或 C:/)、或以 / 开头注入绝对路径。"""
    return "\\" in path or bool(_DRIVE_PREFIX.match(path)) or path.startswith("/")


def _is_symlink_escape_segment(seg: str) -> bool:
    """符号链接逃逸意图判定:. 单段 / ~ 主目录 / -> 链接箭头 / .lnk / symlink 关键字。"""
    return seg in (".", "~") or "->" in seg or seg.endswith(".lnk") or "symlink" in seg.lower()


def resolve_context_uri(uri: object, roots: object, policy: object) -> dict:
    """解析并鉴权 ``context://`` 虚拟 URI(纯函数,一次调用产出结构化 verdict)。

    立因:对照的虚拟路径只解决「统一命名空间」,解析与鉴权分两步且允许半态。
          本仓用同一把尺子一次收口,并把半态显式拒绝(超越轴①②③)。

    判据(顺序 = 先认形状,再跑内容安全判据;命中即经 ``_emit`` 返回,绝不回落宿主 FS):
      1  uri 非 str                          ⇒ unjudged / non_string_input
      2  roots/policy 形状不认或缺白名单     ⇒ unjudged / policy_shape_invalid(§0.3 取不到)
      3  scheme 不认(裸路径/别的 scheme)     ⇒ unjudged / wrong_scheme;
         scheme 大小写变体                  ⇒ denied / case_variant
      4  rest 含 NUL/控制字符               ⇒ denied / control_char
      5  rest 含 %HH 编码                   ⇒ denied / url_encoded_bypass
      6  缺 namespace/path 分隔或空 ns      ⇒ unjudged / malformed_uri
      7  ns 大小写变体 / 未登记             ⇒ denied / case_variant / unregistered_namespace
      8  roots 缺该 ns(输入取不到)          ⇒ unjudged / missing_namespace_root(半态显式拒绝)
      9  path 绝对路径注入/空段/.. 穿越/符号链接逃逸 ⇒ denied 对应 reason
      10 全部通过                           ⇒ allowed + canonical_path(虚拟 URI) + reason=ok

    刻意不做什么:不 os.path.join / 不 pathlib / 不读磁盘 / 不 realpath / 不解符号链接;
          不把裸字符串当相对 FS 路径拼接(§0.3「绝不静默放行」);canonical_path 恒为
          ``context://`` 前缀的虚拟 URI,调用方不得拿它直接当宿主 FS 路径用。
    """
    # 1/2 输入形状面:取不到/不认一律 unjudged 并点名(§0.3),绝不回落到宿主 FS。
    if not isinstance(uri, str):
        return _emit(Verdict.UNJUDGED.value, None, None, Reason.NON_STRING_INPUT.value,
                     "uri 不是 str(输入形状不认),点名:需 context://<namespace>/<path> 字符串")
    if not isinstance(roots, dict) or not isinstance(policy, dict):
        return _emit(Verdict.UNJUDGED.value, None, None, Reason.POLICY_SHAPE_INVALID.value,
                     "roots/policy 不是 dict(配置形状不认),点名:需显式传入注册表与白名单")
    allowed = _allowed_namespaces(policy)
    if allowed is None:
        return _emit(Verdict.UNJUDGED.value, None, None, Reason.POLICY_SHAPE_INVALID.value,
                     "policy.allowed_namespaces 缺失/空/非字符串序列(取不到),点名:需显式白名单,不默认放行")

    # 3 scheme 形状(先认形状,才谈内容安全;§0.3「形状不认 ⇒ unjudged」)。
    if not uri.startswith(_SCHEME):
        if uri.lower().startswith(_SCHEME):
            return _emit(Verdict.DENIED.value, None, None, Reason.CASE_VARIANT.value,
                         "scheme 大小写变体,拒绝绕过 context:// 白名单")
        return _emit(Verdict.UNJUDGED.value, None, None, Reason.WRONG_SCHEME.value,
                     "非 context:// 形状(裸路径/其它 scheme),点名:绝不回落宿主 FS 路径拼接")
    rest = uri[len(_SCHEME):]

    # 4/5 整段内容面:控制字符与 URL 编码绕过(形状已认,内容脏 ⇒ denied)。
    if _has_control_char(rest):
        return _emit(Verdict.DENIED.value, None, None, Reason.CONTROL_CHAR.value,
                     "rest 含 NUL/控制字符,拒绝")
    if _has_percent_encoding(rest):
        return _emit(Verdict.DENIED.value, None, None, Reason.URL_ENCODED.value,
                     "rest 含 %HH 百分号编码,拒绝解码绕过")

    # 6 拆 namespace / path(形状骨架)。
    ns, sep, path = rest.partition("/")
    if not sep or not ns:
        return _emit(Verdict.UNJUDGED.value, None, None, Reason.MALFORMED_URI.value,
                     "缺 namespace/path 分隔或 namespace 为空(形状不认),点名:需 context://<ns>/<path>")

    # 7 namespace 白名单(精确大小写);大小写变体与真未登记分别点名。
    if ns not in allowed:
        if ns.lower() in {a.lower() for a in allowed}:
            return _emit(Verdict.DENIED.value, ns, None, Reason.CASE_VARIANT.value,
                         "namespace 大小写变体,拒绝绕过登记白名单")
        return _emit(Verdict.DENIED.value, ns, None, Reason.UNREGISTERED_NAMESPACE.value,
                     "namespace 未登记在 policy.allowed_namespaces,拒绝")

    # 8 取虚拟根(§0.3 + 半态显式拒绝):解析出 ns 但拿不到根 ⇒ 不出 canonical_path。
    root = roots.get(ns)
    if not isinstance(root, str) or not root.strip("/"):
        return _emit(Verdict.UNJUDGED.value, ns, None, Reason.MISSING_NAMESPACE_ROOT.value,
                     "roots 缺该 namespace 的虚拟根(输入取不到),点名:解析已跑但鉴权未齐,显式拒绝半态")

    # 9 path 逐段安全判据(解析与鉴权同一把尺子的收口处)。
    if _is_absolute_injection(path):
        return _emit(Verdict.DENIED.value, ns, None, Reason.ABSOLUTE_PATH.value,
                     "path 注入绝对路径(反斜杠/盘符/以 / 开头),拒绝")
    segments = path.split("/")
    for seg in segments:
        if seg == "":
            return _emit(Verdict.DENIED.value, ns, None, Reason.EMPTY_SEGMENT.value,
                         "path 出现空段(双斜杠/首尾斜杠),拒绝")
        # [MUTATION-ANCHOR:traversal] 反向变异验证用:注释掉下面整块,.. 穿越用例必须转红。
        if seg == "..":
            return _emit(Verdict.DENIED.value, ns, None, Reason.TRAVERSAL.value, "path 段 '..' 目录穿越")
        if _is_symlink_escape_segment(seg):
            return _emit(Verdict.DENIED.value, ns, None, Reason.SYMLINK_ESCAPE.value,
                         "path 段含符号链接逃逸意图(./~/->/.lnk/symlink),拒绝")

    # 10 唯一成功出口:产出虚拟规范 URI(绝非宿主 FS 路径)。
    canonical = _SCHEME + ns + "/" + root.strip("/") + "/" + "/".join(segments)
    return _emit(Verdict.ALLOWED.value, ns, canonical, Reason.OK.value,
                 "解析与鉴权合一完成:形状认、白名单命中、八类安全判据全通过")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
