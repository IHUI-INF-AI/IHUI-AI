# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""双半插件宿主运行时(node:vm 沙箱),遵循统一工程规范
2026-11-15 R12 独立实现。

为什么要有这一份:IHUI 的插件是 F 类 `PluginViewManifest`(`plugin-view-runtime`)——
**声明式视图清单**,不是可执行代码,宿主从不运行插件写的函数。而 dsh-cordis-host-runner
(104837 字节,取证见 .archify/deepseek-agent-core-src/dsh-cordis-host-runner__index.js)
支持**动态包**(dynamic package):模型自己写一段宿主半(host half)源码,宿主在一个
**全新 node:vm realm** 里求值它,插件靠 `harness.defineTool` / `harness.registerTool` /
`harness.handle` 把工具注册回真实运行时。这是 IHUI 完全没有的能力维度。

本模块用 IHUI 的 Python 栈复刻这套执行模型的核心安全边界。刻意**不做**:
  - 不做完整 cordis 服务容器 / scope / Service 依赖注入(@deepseek-ai/cordis 是另一套
    框架,超出单一模块射程);
  - 不做 Human-in-the-loop Client 激活审批流(run lifecycle 的一部分);
  - 不真跑模型代码(本模块提供**沙箱构造与求值边界**,Python 侧无 node:vm,求值用
    受控占位 + 语义等价的守卫;真接 JS 求值由 Node 宿主侧接线,见 REA 目录 target)。
  - 不碰网络/不 spawn(纯构造 + 校验,零副作用)。

复刻的三条硬边界(取证 :48995-49657 createSandbox / :510 node:vm import / :54214 信任立场):
  1. **扣留 Node API**:沙箱故意不给 require/fetch/计时器,调用即抛带重定向指引的
     错误(告诉插件"用 inject:['fs'] / ['web'] / ['bash'] 走 cordis 服务")。
     这是"能力经服务中转"的沙箱哲学——插件不能直接摸宿主资源。
  2. **vm 超时只限同步段**:`timeout` 包不住 async 体(异步逃逸是接受的信任立场),
     文档必须如实声明,不能谎称"全程限时"。
  3. **跨 realm instanceof 陷阱**:vm 里抛的 SyntaxError 构造在沙箱 realm,宿主
     `instanceof SyntaxError` 静默为 false;必须用 `error.name === 'SyntaxError'`
     做 realm 安全判定。这是最易踩的坑,单独成函数钉住。

超越点(§0.12 第④步):本仓把"沙箱构造"做成纯数据 + 纯函数(`build_vm_sandbox` /
`classify_host_half_error`),宿主侧接线与策略层完全解耦可单测;外部实现 的构造嵌在类里、
要 mock 整个 cordis 容器才能测。且本仓把"扣留表"显式数据化(NODE_API_REDIRECTS),
重定向指引可枚举可审计。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

__all__ = [
    "WithheldApi",
    "HostHalfErrorKind",
    "HostHalfVerdict",
    "NODE_API_REDIRECTS",
    "TIMER_REDIRECT",
    "WITHHELD_APIS",
    "build_vm_sandbox",
    "is_cross_realm_syntax_error",
    "classify_host_half_error",
    "assert_host_half_returns_plugin",
    "sync_timeout_caveat",
]

# 沙箱扣留的 Node 全局 API 名(取证 NODE_API_REDIRECTS :49291 前的表)
WithheldApi = Literal[
    "require", "setTimeout", "setInterval", "setImmediate",
    "clearTimeout", "clearInterval", "fetch",
]

# 计时器统一重定向文案(外部实现 的 TIMER_REDIRECT 常量语义)
TIMER_REDIRECT = (
    "Timers are unavailable in the dynamic package sandbox — "
    "host halves must not spawn deferred work; return the result synchronously "
    "or use the cordis run lifecycle."
)

# 扣留表:每个被扣 API -> 调用时的重定向指引(能力经 cordis 服务中转)
NODE_API_REDIRECTS: dict[str, str] = {
    "require": (
        "Node modules are unavailable. Use the cordis services on ctx instead — "
        "e.g. inject: ['fs'] for files, ['web'] for HTTP, ['bash'] for processes; "
        "query Service.listService with cordis_inspect_query first."
    ),
    "setTimeout": TIMER_REDIRECT,
    "setInterval": TIMER_REDIRECT,
    "setImmediate": TIMER_REDIRECT,
    "clearTimeout": TIMER_REDIRECT,
    "clearInterval": TIMER_REDIRECT,
    "fetch": (
        "Network access goes through the cordis web service: "
        "declare inject: ['web'] and call ctx.web "
        "(query Host Service.listService with cordis_inspect_query for its methods)."
    ),
}
WITHHELD_APIS: tuple[str, ...] = tuple(NODE_API_REDIRECTS.keys())


@dataclass(frozen=True)
class VmSandbox:
    """一个 host half 求值所在的沙箱描述(纯数据,不真建 realm)。"""

    package_id: str  # dyn-<n>,用作 console tag 与 filename stem
    withheld: tuple[str, ...] = field(default_factory=lambda: WITHHELD_APIS)
    # 沙箱内**故意保留**的原语(编码必备,外部实现 createSandbox 显式注入)
    granted: tuple[str, ...] = ("console(tagged)", "harness", "btoa", "atob", "TextEncoder", "TextDecoder")
    has_dual_realm_instanceof_patch: bool = True
    sync_timeout_ms: int | None = None  # 仅限同步段,见 sync_timeout_caveat


def build_vm_sandbox(package_id: str, *, sync_timeout_ms: int | None = None) -> VmSandbox:
    """构造 host half 求值用的沙箱描述(对齐 外部实现 createSandbox :48995)。

    沙箱故意扣留 require/fetch/计时器,只保留 tagged console、harness 注册对、
    编码原语;并打双 realm instanceof 补丁。
    """
    if not package_id:
        raise ValueError("package_id 必填(用作 console tag / filename stem)")
    return VmSandbox(package_id=package_id, sync_timeout_ms=sync_timeout_ms)


def redirect_for(api: str) -> str:
    """返回调用被扣 API 时应抛的重定向指引(不存在则视为未扣留)。"""
    return NODE_API_REDIRECTS.get(api, "")


# 宿主半求值的失败归类
HostHalfErrorKind = Literal[
    "syntax_error",   # 编译失败 —— 需带源码行 + caret 让模型自纠
    "undefined_return",  # host half 返回 undefined —— 大概率漏了 return
    "bad_plugin_shape",  # 返回了非 Plugin 函数/无 apply(ctx) 对象
    "withheld_api",   # 调用了被扣留的 Node API
    "runtime_error",  # 其它运行时错误
    "ok",
]


@dataclass(frozen=True)
class HostHalfVerdict:
    kind: HostHalfErrorKind
    message: str
    withheld_api: str | None = None  # 若 kind==withheld_api,命中的 API 名
    redirect: str | None = None  # 对应重定向指引
    realm_safe: bool = True  # 是否用了 realm 安全判定(name 而非 instanceof)


def is_cross_realm_syntax_error(error_name: str | None) -> bool:
    """跨 realm SyntaxError 安全判定(取证 isSyntaxError :49657 语义)。

    vm 里抛的 SyntaxError 构造在沙箱 realm,宿主 `instanceof SyntaxError` 静默为
    false;唯一 realm 安全的 tag 是 `error.name`。这里用 name 判,并显式声明
    为什么不用 isinstance。
    """
    return error_name == "SyntaxError"


def classify_host_half_error(
    *,
    error_name: str | None = None,
    error_message: str = "",
    returned_undefined: bool = False,
) -> HostHalfVerdict:
    """归类一次 host half 求值的失败(纯函数,不真跑代码)。

    优先级对齐 外部实现 run lifecycle(:92236 evaluateHostCode + isPlugin 检查):
      1. 跨 realm SyntaxError(name 判定) ⇒ syntax_error,带源码上下文提示。
      2. 返回 undefined ⇒ undefined_return("did you forget return?")。
      3. 返回非 plugin 形状 ⇒ bad_plugin_shape。
      4. 错误信息命中被扣 API 的重定向 ⇒ withheld_api(带重定向指引)。
      5. 其它 ⇒ runtime_error。
    """
    # 1. 跨 realm SyntaxError(必须用 name,realm 安全)
    if is_cross_realm_syntax_error(error_name):
        return HostHalfVerdict(
            kind="syntax_error",
            message=(error_message or "SyntaxError").strip(),
            realm_safe=True,
        )
    # 2/3. 返回值形状(外部实现 evaluateHostCode 后 isPlugin 检查)
    if returned_undefined:
        return HostHalfVerdict(
            kind="undefined_return",
            message="the Host half returned `undefined` — did you forget `return`?",
        )
    # 4. 命中被扣 API
    msg = error_message or ""
    for api in WITHHELD_APIS:
        if re.search(rf"\b{re.escape(api)}\b", msg):
            return HostHalfVerdict(
                kind="withheld_api",
                message=msg.strip(),
                withheld_api=api,
                redirect=NODE_API_REDIRECTS[api],
            )
    # 5. 其它运行时错误
    if error_name or msg:
        return HostHalfVerdict(kind="runtime_error", message=(error_message or error_name or "").strip())
    return HostHalfVerdict(kind="ok", message="")


def assert_host_half_returns_plugin(returned_shape: Literal["undefined", "plugin_fn", "apply_object", "other"]) -> HostHalfVerdict:
    """校验 host half 返回值形状(外部实现 isPlugin 语义 :92236)。

    合法:返回 Plugin 函数,或带 apply(ctx) 的对象。undefined / 其它形状报错,
    错误文案对齐 外部实现 的 teaching error(帮模型自纠)。
    """
    if returned_shape == "undefined":
        return classify_host_half_error(returned_undefined=True)
    if returned_shape in ("plugin_fn", "apply_object"):
        return HostHalfVerdict(kind="ok", message="")
    return HostHalfVerdict(
        kind="bad_plugin_shape",
        message="the Host half must return a Plugin function or an object with apply(ctx)",
    )


def sync_timeout_caveat(timeout_ms: int | None) -> str:
    """如实声明 vm timeout 的边界(取证 :54214 信任立场)。

    `timeout` 只包同步段;async 体逃逸是接受的信任立场。禁止谎称"全程限时"。
    """
    if timeout_ms is None:
        return "未设同步超时:宿主半求值无同步段上限(不推荐用于不可信代码)。"
    return (
        f"vm timeout={timeout_ms}ms 仅约束**同步段**;async 体可逃逸此上限 —— "
        "这是接受的信任立场(动态包由人工审批激活,非零信任)。"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
