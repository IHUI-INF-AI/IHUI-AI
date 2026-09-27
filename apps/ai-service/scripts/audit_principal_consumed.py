# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审计:哪些 FastAPI 端点"取到已验证身份却一次都没用它"(认证不等于授权)。

**这是一把只读尺子,不是守门** —— 它既没接 guardian-runner 也没接 CI(所以本文件刻意
不写"已接 pre-commit / 第 N 项"那种话,守门 89 会判"声称已接线而零命中")。升 blocking
的前置条件写在下面"定级"一段,不满足之前它就是手动问责档。

为什么用 ast 而不是正则(实测换来的):第一版普查按行拼签名/切函数体,报出 **106** 条,
里面把 helper 的一跳委托(`_update_owned` / `_owner_filter(request)` 那类)全算成漏洞,
真假混杂、不能当判据。换成 `ast` 遍历后真值 **53** 条,再逐条读体定性才有 A/B/C/D 分组
(账在 PROJECT_PLAN 的 G-258)。**"扫到很多"必须先怀疑尺子,再相信世界。**

判据一(保守到"宁可漏报"):
  函数签名里有参数的默认值调用了身份依赖(`get_current_user_id` 等),
  而**整个函数体内没有任何一处 Name/Attribute 引用该参数名** ⇒ 候选"未消费"。

判据二(G-261 补;与判据一在 `_collect` 的**同一次**遍历里收齐,不各起一遍):
  判据一命中的函数,若体内存在下列任何一条 ⇒ "身份确实被消费",不再判:
    a) `<request形参>.state.user_id` 属性链读取;
    b) `getattr(<request形参>.state, "user_id", …)` 同形读取;
    c) 把 `<request形参>` 作为实参调用一个**一跳可解析到定义处**的函数(本地 def、
       `from <本仓模块> import f`、`import m` 后 `m.f(…)`、`from pkg import sub` 后
       `sub.f(…)`),且该函数**自己的体内**按 a/b 读了它自己 request 形参的
       `.state.user_id`。典型:`_owner_filter(request)` → 体内
       `getattr(request.state, "user_id", None)`。
  "什么算本仓已知身份 helper"**不是名字表也不是"看起来像委托"**:唯一判据 =
  被调函数的定义体命中 a/b(`identity_reads`)。名字清单只有一份 =
  `IDENTITY_STATE_ATTRS = ("user_id",)`;`role_id` **刻意不在清单里**(角色分档与
  "主体被用于归属"是两条轴,并进来等于给"只查角色的公共面"发合格证)。
  三态分流是防洗白的关键 ——
    * 解析到定义处而确认不读身份 ⇒ **判红**(委托≠消费);
    * 绑定指向被审仓但到不了定义处(模块没被审到 / `import *` 遮蔽 / 相对导入越界 /
      多段链式调用)⇒ **未判定**,逐条点名,既不冒红也不记绿;
    * 绑定明确是仓外(`logging`、`fastapi`、内建 `print`)或被调实体不是函数
      (`hook_engine` 这类实例上的方法)⇒ 不在"本仓身份 helper"候选集:不给记账、
      不计未判定、**仍然判红**。
  所以判据二**绝不**把"函数体里出现过 request 字样"当消费:`logging.info(…, request)`
  / `logger.info(request)` / `print(request)` 必须仍判红(变异取证①钉死)。
  引用面含**嵌套 def**(与判据一落地时的既有语义逐字同形):"闭包里的引用不算消费"
  是独立的收紧提案 —— 实测会把 `execute_agent_stream` 这类经嵌套生成器消费主体的端点
  翻成第 19 条新红,改存量口径不属 G-261 范围,须单独立票(§12f:修红不得顺手改判据)。

三态出口(绝不并桶):
  findings     —— 两判据都不认的"未消费"(逐条定性 A/B/C;C 走显式豁免登记);
  exempted     —— 判红但持 `PRINCIPAL_EXEMPTIONS` 条目者(键 file+func,**每条必须带理由**,
                  禁止按目录/前缀整片放行;条目不再对应任何判红 ⇒ `stale_exemptions` 点名);
  undetermined —— 委托目标在仓内解析不到定义处 + 整文件不可审(逐条点名;
                  `--strict` 下有任何一条 ⇒ **exit 2**,拒绝出具合格证);
  unauditable  —— 读不到/parse 不掉的文件(同上计 strict,不静默跳过)。

定级(升档前置,别跳步):
  ① 判红逐条清偿,或按"确属公共面"显式登记豁免(带理由);
  ② 存量(判红 − 豁免)清零前挂 blocking = 与任何提交无关的恒红门,唯一结局是各会话
     `--no-verify` 连带全部守门作废(AGENTS §12e 同型);
  ③ 委托假阳性(`request.state.user_id` 通道)由判据二自动认出 —— **已落地**(G-261)。
  现读定性账(2026-09-27,G-261,改前 18 条):真缺陷 0 / 委托已消费 11(判据二认出)/
  公共面无归属轴 7(逐条登记进 `PRINCIPAL_EXEMPTIONS`,每条带理由)。

用法:
    python apps/ai-service/scripts/audit_principal_consumed.py [--json] [--strict]
        [--fail-on-findings] [--root <dir>]
退出码:缺省恒 0(审计档);`--strict` 有未判定/不可审 ⇒ exit 2(拒绝出合格证),其下若仍有
判红 ⇒ exit 1;`--fail-on-findings` 判红(豁免后)非空 ⇒ exit 1。
"""

from __future__ import annotations

import argparse
import ast
import json
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# 身份依赖的函数名。**加名字之前先问**:多一个名字就多一类被判的端点;
# 少一个名字则是漏报(与 AGENTS §5"身份只能从承载层显式入参进来"同一条禁令)。
AUTH_DEPS = ("get_current_user_id", "require_request_user_id", "get_current_user")

# 判据二的唯一名字清单:落在 request.state 上、算"主体被消费"的键名。
# 唯一来源实测 = app/core/jwt_auth.py:151 `request.state.user_id = user_id`。
# **刻意不含 role_id**(见模块 docstring);加名字必须同笔补配对正反用例。
IDENTITY_STATE_ATTRS = ("user_id",)

# 调用位上以 Name 形态出现、按构造不可能等于"本仓顶层身份 helper"的名字。
# 它们判"external ⇒ 不记债",不是豁免:这类调用不会把 request 交给任何仓内定义处。
_BUILTIN_NAMES = frozenset(
    {
        "print",
        "len",
        "str",
        "int",
        "float",
        "bool",
        "dict",
        "list",
        "set",
        "tuple",
        "sorted",
        "enumerate",
        "range",
        "isinstance",
        "getattr",
        "setattr",
        "hasattr",
        "delattr",
        "globals",
        "locals",
        "vars",
        "open",
        "any",
        "all",
        "min",
        "max",
        "sum",
        "map",
        "filter",
        "zip",
        "reversed",
        "type",
        "super",
        "id",
        "hash",
        "abs",
        "round",
        "repr",
        "format",
        "Exception",
        "ValueError",
        "TypeError",
        "RuntimeError",
        "TimeoutError",
        "KeyError",
        "Depends",
        "Security",
        "Query",
        "Path",
        "Body",
        "File",
        "Form",
        "HTTPException",
    }
)

# —— 显式豁免登记(G-261 逐条定性为 C 的 7 条:该端点**没有按人归属的资源**,归属是错的轴)。
# 键 = file + func(不用行号 —— 行号在任何一次上游改动后挪位,AGENTS §1 同一条禁令)。
# 每条必须带理由;禁止按目录/前缀整片放行。判红形态一变(比如这些端点日后真的开始读写
# 按人记录),该条目应随修复**删除**,或由 `stale_exemptions` 反向暴露成"清单腐烂"。
PRINCIPAL_EXEMPTIONS: list[dict[str, str]] = [
    {
        "file": "app/routers/hooks.py",
        "func": "auto_orchestrate",
        "reason": "只读生成:LLM 按入参文本产出 Hook+DAG 草案并原样返回"
        "(hook_engine.auto_orchestrate 不落盘、不读任何按人记录);登录门槛是 O19 的"
        "计费/滥用闸门,不是归属判定 —— 没有可归属的资源。",
    },
    {
        "file": "app/routers/hooks.py",
        "func": "list_hook_templates",
        "reason": "资源是 hook_engine.HOOK_TEMPLATES 全局预置常量,对所有用户同值,"
        "无 owner_id 维度;归属是错的轴。",
    },
    {
        "file": "app/core/capability_matrix.py",
        "func": "get_capabilities",
        "reason": "资源是全局能力台账;闸门是 role_id>=1(读 request.state.role_id),"
        "属角色轴不是归属轴 —— 判据二刻意不认 role_id(见 IDENTITY_STATE_ATTRS 旁注释),"
        "故在此逐条显式登记。require_request_user_id 保证生产缺身份即 401。",
    },
    {
        "file": "app/routers/agents.py",
        "func": "get_agent_security_config",
        "reason": "资源是进程级安全配置(get_security_config),全站单份、无按人副本;"
        "端点级'必须登录'是 O19 记录在案的设计(中间件白名单配错时的兜底),"
        "更细的管理员档位归 apps/api 侧授权模型。",
    },
    {
        "file": "app/routers/agents.py",
        "func": "trigger_skill_evolution",
        "reason": "产物落**共享**技能库(app/skills/auto/,无 owner 维度),"
        "body 里的 taskId/sessionId 是客户端自述且服务端无属主索引 —— 端点 docstring"
        "明文登记'Skill 归属维度属后续改造'。今天不存在可比对的属主,判'未消费'无资源"
        "可救济;该后续改造落地时删除本条并给 evaluate 补归属实参。",
    },
    {
        "file": "app/routers/agents.py",
        "func": "agent_debate",
        "reason": "纯编排计算(debate/vote/critique),不读写任何按人持久记录;"
        "body.sessionId 只是编排器会话标签,无属主索引(端点 docstring 同款登记)。",
    },
    {
        "file": "app/routers/prompt_guard_api.py",
        "func": "signatures",
        "reason": "静态目录(HIT_TYPES/策略/来源/语言常量表),零资源访问;"
        "登录是 /prompt-guard 组的统一门槛,不是归属判定。",
    },
]


def auth_params(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> list[str]:
    """签名里默认值调用了身份依赖的参数名(含 `Security(...)` 同族形态)。"""
    args = fn.args
    positioned = [*args.args, *args.kwonlyargs]
    defaults = [*args.defaults, *args.kw_defaults]
    if not defaults or not positioned:
        return []
    # 位置默认值对齐**尾部**参数;kwonly 的默认值按自身顺序对齐(两者长度不等的情况由
    # min() 收口 —— 宁可少判,绝不把不相干的名字当成身份参数)
    pairs: list[tuple[str, ast.expr | None]] = []
    tail = positioned[len(positioned) - min(len(defaults), len(positioned)) :]
    for i, arg in enumerate(tail):
        d = defaults[i] if i < len(defaults) else None
        pairs.append((arg.arg, d))
    for i, arg in enumerate(args.kwonlyargs):
        d = args.kw_defaults[i] if i < len(args.kw_defaults) else None
        pairs.append((arg.arg, d))
    names: list[str] = []
    for name, default in pairs:
        if default is None:
            continue
        for node in ast.walk(default):
            if isinstance(node, ast.Name) and node.id in AUTH_DEPS:
                names.append(name)
                break
    return names


def _fn_params(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> list[ast.arg]:
    return [*fn.args.posonlyargs, *fn.args.args, *fn.args.kwonlyargs]


def _is_request_arg(arg: ast.arg) -> bool:
    """形参是否"像一个 Request 对象" —— 判据二唯一的取值口。

    以标注为准(`Request` / `fastapi.Request`):FastAPI 只把带此标注的形参注入成
    Request 对象,仓内实测被委托的形参全部带标注。真正的门槛在 IDENTITY_STATE_ATTRS
    —— 必须经这个口读到 **user_id** 这一档才算消费;"碰过 request"不算。
    """
    ann = arg.annotation
    if isinstance(ann, ast.Name) and ann.id == "Request":
        return True
    if isinstance(ann, ast.Attribute) and ann.attr == "Request":
        return True
    return False


def _state_chain_owner(node: ast.Attribute) -> str | None:
    """`X.state.user_id`(node 即最外层 Attribute)⇒ 返回 X 的名字;否则 None。"""
    if node.attr not in IDENTITY_STATE_ATTRS:
        return None
    inner = node.value
    if (
        isinstance(inner, ast.Attribute)
        and inner.attr == "state"
        and isinstance(inner.value, ast.Name)
    ):
        return inner.value.id
    return None


def _getattr_identity_owner(node: ast.Call) -> str | None:
    """`getattr(X.state, "user_id", …)` ⇒ 返回 X 的名字;否则 None。"""
    if not (isinstance(node.func, ast.Name) and node.func.id == "getattr"):
        return None
    if len(node.args) < 2:
        return None
    base, key = node.args[0], node.args[1]
    if (
        not isinstance(key, ast.Constant)
        or not isinstance(key.value, str)
        or key.value not in IDENTITY_STATE_ATTRS
    ):
        return None
    if (
        isinstance(base, ast.Attribute)
        and base.attr == "state"
        and isinstance(base.value, ast.Name)
    ):
        return base.value.id
    return None


def _callee_key(func: ast.expr) -> tuple[Any, ...]:
    """调用目标形状,交给 `_resolve_callee` 一跳解析。

    - ("name", f)            f(request)
    - ("attr", base, g)      base.g(request),base 是个 Name
    - ("chain", <inner key>, g)  更深链式:`f(...).g(request)` / `a.b.c(request)` ——
      单跳口径覆盖不到它的归属,如实未判定(不猜)。
    - ("opaque",)             其余形态(lambda 调用、下标…)不参与解析,也不记债。
    """
    if isinstance(func, ast.Name):
        return ("name", func.id)
    if isinstance(func, ast.Attribute):
        base = func.value
        if isinstance(base, ast.Name):
            return ("attr", base.id, func.attr)
        inner = _callee_key(base)
        if inner[0] in ("name", "attr", "chain"):
            return ("chain", inner, func.attr)
    return ("opaque",)


@dataclass
class _Facts:
    """一个函数体在**一次**遍历里收齐的全部判据输入(判据一/二共用同一遍,不各走一遍)。"""

    refs: set[str] = field(default_factory=set)
    req_params: set[str] = field(default_factory=set)
    direct: bool = False
    # 把 request 形参当实参交出去的调用:[(callee_key, lineno)]
    req_calls: list[tuple[tuple[Any, ...], int]] = field(default_factory=list)


def _collect(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> _Facts:
    """单次遍历(显式栈,深函数体不吃递归上限)。

    引用面 = **整个 fn**(含嵌套 def)—— 与判据一落地时的既有语义逐字同形。
    "闭包里的引用不算消费"是一个独立的收紧提案,不属 G-261 的范围:它会新增判红、
    改动存量口径(实测 `execute_agent_stream` 一类经嵌套生成器消费的端点会被翻红),
    那属于"改判据"的决策,须由持有人单独立票并先清偿存量(§12f 同型)。
    """
    f = _Facts()
    f.req_params = {a.arg for a in _fn_params(fn) if _is_request_arg(a)}
    stack: list[ast.AST] = [fn]
    while stack:
        node = stack.pop()
        if isinstance(node, ast.Name):
            f.refs.add(node.id)
        elif isinstance(node, ast.Attribute):
            f.refs.add(node.attr)
            if isinstance(node.ctx, ast.Load) and _state_chain_owner(node) in f.req_params:
                f.direct = True
        elif isinstance(node, ast.Call):
            if _getattr_identity_owner(node) in f.req_params:
                f.direct = True
            if f.req_params:
                has_req = any(
                    isinstance(a, ast.Name) and a.id in f.req_params for a in node.args
                ) or any(
                    isinstance(kw.value, ast.Name) and kw.value.id in f.req_params
                    for kw in node.keywords
                )
                if has_req:
                    f.req_calls.append((_callee_key(node.func), node.lineno))
        stack.extend(ast.iter_child_nodes(node))
    return f


def identity_reads(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    """一跳 helper 的"身份消费"定义:它自己的 request 形参被按 user_id 通道读过(a/b)。"""
    return _collect(fn).direct


def functions_in(source: str) -> list[ast.FunctionDef | ast.AsyncFunctionDef]:
    tree = ast.parse(source)
    return [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]


# ---------------------------------------------------------------------------
# 仓级索引:模块 → 顶层 def/class,供委托调用的"沿 import 一跳解析"
# ---------------------------------------------------------------------------


def module_of(rel: str) -> str:
    parts = rel.split("/")
    if parts[-1] == "__init__.py":
        parts[-1] = "__init__"
    elif parts[-1].endswith(".py"):
        parts[-1] = parts[-1][:-3]
    return ".".join(parts)


def _top_level_fns(tree: ast.Module) -> dict[str, ast.FunctionDef | ast.AsyncFunctionDef]:
    return {
        n.name: n
        for n in tree.body
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
    }


class _Index:
    def __init__(self) -> None:
        self.trees: dict[str, ast.Module] = {}
        self.rel_of_module: dict[str, str] = {}
        self.defs: dict[str, dict[str, ast.FunctionDef | ast.AsyncFunctionDef]] = {}
        self.classes: dict[str, set[str]] = {}
        self.roots: set[str] = set()  # 被审仓的顶层包名(app / scripts / tests /…)
        self.identity_cache: dict[tuple[str | None, str], bool] = {}
        self.unauditable: list[dict[str, str]] = []

    def is_repo_module(self, mod: str) -> bool:
        """模块路径是否属于被审仓(按当次索引的顶层包判,不写死 'app')。"""
        head = mod.split(".", 1)[0]
        return head in self.roots


def build_index(sources: dict[str, str]) -> _Index:
    idx = _Index()
    for rel, src in sources.items():
        try:
            tree = ast.parse(src)
        except (SyntaxError, ValueError, RecursionError) as e:
            idx.unauditable.append({"file": rel, "reason": f"解析失败:{type(e).__name__}"})
            continue
        idx.trees[rel] = tree
        mod = module_of(rel)
        idx.rel_of_module[mod] = rel
        idx.roots.add(mod.split(".", 1)[0])
        idx.defs[mod] = _top_level_fns(tree)
        idx.classes[mod] = {n.name for n in tree.body if isinstance(n, ast.ClassDef)}
    return idx


class _FileImports:
    def __init__(self) -> None:
        self.module_alias: dict[str, str] = {}  # `import a.b [as m]` → m(或 'a')→ 'a.b'
        self.aliases_from: dict[str, str] = {}  # `from m import x [as y]` → y → m
        self.star_modules: list[str] = []
        self.star_unresolved = False


def _collect_imports(tree: ast.Module, mod_parts: list[str], idx: _Index) -> _FileImports:
    imps = _FileImports()
    pkg_parts = mod_parts[:-1]
    for node in tree.body:
        if isinstance(node, ast.Import):
            for a in node.names:
                imps.module_alias[a.asname or a.name.split(".")[0]] = a.name
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                keep = len(pkg_parts) - (node.level - 1)
                if keep < 0:
                    # 相对导入越出被审根 ⇒ 本文件的未知调用名无从断言(未判定)
                    imps.star_unresolved = True
                    continue
                base = pkg_parts[:keep]
                mods = base + (node.module.split(".") if node.module else [])
            else:
                if not node.module:
                    imps.star_unresolved = True
                    continue
                mods = node.module.split(".")
            target = ".".join(mods)
            for a in node.names:
                if a.name == "*":
                    if target in idx.rel_of_module:
                        imps.star_modules.append(target)
                    else:
                        imps.star_unresolved = True
                    continue
                bound = a.asname or a.name
                imps.aliases_from[bound] = target
                if not node.module and node.level:
                    # `from . import x` 的 x 可能是同包模块 —— 双通道绑定,解析端各自再核
                    imps.module_alias.setdefault(bound, f"{target}.{a.name}")
    return imps


def _display(key: tuple[Any, ...]) -> str:
    kind = key[0]
    if kind == "name":
        return str(key[1])
    if kind == "attr":
        return f"{key[1]}.{key[2]}"
    if kind == "chain":
        return f"{_display(key[1])}.{key[2]}"
    return "opaque"


def _resolve_callee(
    key: tuple[Any, ...],
    local_defs: dict[str, ast.FunctionDef | ast.AsyncFunctionDef],
    imps: _FileImports,
    idx: _Index,
) -> tuple[str, str | None, str]:
    """一跳解析。返回 (kind, module, display):

    - def         解析到本仓顶层函数定义(委托判定的输入)
    - cls/nonfunc 解析到但按构造不是"本仓顶层函数"(类、实例上的方法、模块本体)⇒ 不记债
    - external    绑定明确指向仓外(logging / 内建)⇒ 不记债
    - unknown     无任何导入绑定(self.foo、局部变量)⇒ 不记债(候选集之外)
    - repo-missing/unresolved/opaque 本仓语境但到不了定义处 ⇒ **未判定**
    """
    kind = key[0]
    if kind == "chain":
        # 多段链:一跳判据覆盖不到 —— 若根名字有仓内绑定则如实未判定,否则不记债。
        root_key = key[1]
        root_display = _display(key)
        root_name = root_key[1] if root_key[0] in ("name", "attr", "chain") else None
        if isinstance(root_name, str):
            if root_name in imps.module_alias:
                m = imps.module_alias[root_name]
                return ("unresolved", None, root_display) if idx.is_repo_module(m) else ("unknown", None, root_display)
            if root_name in imps.aliases_from:
                src = imps.aliases_from[root_name]
                return ("unresolved", None, root_display) if idx.is_repo_module(src) else ("unknown", None, root_display)
        return ("unresolved" if (imps.star_unresolved or imps.star_modules) else "unknown", None, root_display)
    if kind != "name" and kind != "attr":
        return ("opaque", None, _display(key))

    if kind == "name":
        name = str(key[1])
        if name in local_defs:
            return ("def", None, name)
        if name in imps.aliases_from:
            mod = imps.aliases_from[name]
            if name in idx.defs.get(mod, {}):
                return ("def", mod, name)
            if name in idx.classes.get(mod, set()):
                return ("cls", mod, name)
            if mod in idx.rel_of_module:
                return ("nonfunc", mod, name)  # 被审模块里的变量/实例:不是本仓函数
            return ("repo-missing", mod, name) if idx.is_repo_module(mod) else ("external", None, name)
        for smod in imps.star_modules:
            if name in idx.defs.get(smod, {}):
                return ("def", smod, name)
            if name in idx.classes.get(smod, set()):
                return ("cls", smod, name)
        if imps.star_unresolved:
            return ("unresolved", None, name)
        if name in imps.module_alias:
            return ("nonfunc", imps.module_alias[name], name)
        if name in _BUILTIN_NAMES:
            return ("external", None, name)
        return ("unknown", None, name)

    # attr: base.g(request)
    base = str(key[1])
    g = str(key[2])
    dotted = f"{base}.{g}"
    mod = imps.module_alias.get(base)
    if mod is None and base in imps.aliases_from:
        src = imps.aliases_from[base]
        sub = f"{src}.{base}"
        if sub in idx.rel_of_module:
            mod = sub  # `from pkg import sub`(子模块)⇒ sub.g 一跳可解
        elif base in idx.classes.get(src, set()) or base in idx.defs.get(src, {}):
            return ("nonfunc", src, dotted)  # 导入实体(类/函数对象)上的方法:非顶层函数
        elif src in idx.rel_of_module:
            return ("nonfunc", src, dotted)  # 实例/变量:仓内但不是函数(如 hook_engine)
        else:
            return ("repo-missing", src, dotted) if idx.is_repo_module(src) else ("external", None, dotted)
    if mod is None:
        for smod in imps.star_modules:
            if f"{smod}.{base}" in idx.rel_of_module:
                mod = f"{smod}.{base}"
                break
        else:
            if imps.star_unresolved:
                return ("unresolved", None, dotted)
            return ("unknown", None, dotted)
    if g in idx.defs.get(mod, {}):
        return ("def", mod, g)
    if g in idx.classes.get(mod, set()):
        return ("cls", mod, g)
    if mod in idx.rel_of_module:
        return ("nonfunc", mod, dotted)
    return ("repo-missing", mod, dotted) if idx.is_repo_module(mod) else ("external", None, dotted)


def _helper_identity(
    mod: str | None,
    name: str,
    local_defs: dict[str, ast.FunctionDef | ast.AsyncFunctionDef],
    idx: _Index,
) -> bool:
    cache_key = (mod, name)
    hit = idx.identity_cache.get(cache_key)
    if hit is not None:
        return hit
    holder = local_defs if mod is None else idx.defs.get(mod or "", {})
    hdef = holder.get(name)
    val = hdef is not None and identity_reads(hdef)
    idx.identity_cache[cache_key] = val
    return val


def audit_text(rel: str, source: str, index: _Index | None = None) -> list[dict[str, Any]]:
    """一个文件 → 判据行(纯函数,构造面取证)。行带 status:

    ``unused``(判红)或 ``undetermined``(未判定,逐条点名 callee+reason)。
    跨文件委托解析需要整仓 index;不传 ⇒ 只看得到本文件(其余"from 本仓模块 import"落未判定)。
    """
    idx = index if index is not None else build_index({rel: source})
    tree = idx.trees.get(rel)
    if tree is None:
        return []  # 本文件解析失败:已进 idx.unauditable,由 CLI 点名,不当"没有问题"
    imps = _collect_imports(tree, rel.split("/"), idx)
    local_defs = _top_level_fns(tree)
    rows: list[dict[str, Any]] = []
    for fn in [
        n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]:
        params = auth_params(fn)
        if not params:
            continue
        facts = _collect(fn)
        unused = [p for p in params if p not in facts.refs]
        if not unused or len(unused) != len(params):
            continue  # 部分消费仍算消费(口径与判据一落地时一致,不顺手加严)
        if facts.direct:
            continue  # 判据二 a/b 直接成立
        debts: list[dict[str, Any]] = []
        consumed = False
        for key, line in facts.req_calls:
            kind, mod, name = _resolve_callee(key, local_defs, imps, idx)
            if kind == "def":
                if _helper_identity(mod, name, local_defs, idx):
                    consumed = True  # 判据二 c:一跳委托到"自己读 request.state.user_id"的函数
                    break
                continue  # 解析到定义处且确认不读身份 ⇒ 判红,不记债
            if kind in ("repo-missing", "unresolved", "opaque"):
                reason = (
                    "定义处不可得:绑定指向被审仓的模块,但顶层找不到该函数(不猜它读不读身份)"
                    if kind == "repo-missing"
                    else "目标解析不出(星号导入遮蔽/相对导入越界/多段调用链),不猜结论"
                )
                debts.append(
                    {
                        "file": rel,
                        "line": line,
                        "func": fn.name,
                        "callee": _display(key),
                        "reason": reason,
                        "status": "undetermined",
                    }
                )
            # external / cls / nonfunc / unknown ⇒ 不在"本仓身份 helper"候选集:
            # 不给消费记账、也不计未判定(打日志/取 header 洗不成已消费)
        if consumed:
            continue
        if debts:
            rows.extend(debts)
            continue
        rows.append(
            {
                "file": rel,
                "line": fn.lineno,
                "func": fn.name,
                "params": sorted(set(unused)),
                "status": "unused",
            }
        )
    return rows


def partition_findings(
    rows: list[dict[str, Any]],
    ledger: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """判据行 → findings / exempted / undetermined / stale_exemptions(纯函数,构造面可测)。

    豁免条目缺 file/func/reason 任一 ⇒ 直接抛错:**无理由的豁免不存在**,
    也不允许按目录前缀整片放行(键恒为 file+func 全等)。
    """
    entries = PRINCIPAL_EXEMPTIONS if ledger is None else ledger
    ledger_map: dict[str, str] = {}
    for e in entries:
        if not (e.get("file") and e.get("func") and (e.get("reason") or "").strip()):
            raise ValueError(f"豁免条目必须 file+func+reason 齐备且理由非空:{e}")
        ledger_map[f"{e['file']}:{e['func']}"] = e["reason"]
    raw = [r for r in rows if r["status"] == "unused"]
    undetermined = [r for r in rows if r["status"] == "undetermined"]
    findings: list[dict[str, Any]] = []
    exempted: list[dict[str, Any]] = []
    for r in raw:
        key = f"{r['file']}:{r['func']}"
        if key in ledger_map:
            exempted.append({**r, "reason": ledger_map[key]})
        else:
            findings.append(r)
    hit_keys = {f"{r['file']}:{r['func']}" for r in raw}
    stale = sorted(k for k in ledger_map if k not in hit_keys)
    return {
        "findings": findings,
        "exempted": exempted,
        "undetermined": undetermined,
        "stale_exemptions": stale,
    }


def tracked_py(root: Path) -> list[Path]:
    out = subprocess.run(
        ["git", "-c", "safe.directory=*", "ls-files", "*.py"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if out.returncode != 0:
        return []
    return [root / p for p in out.stdout.splitlines() if p.strip()]


def harden_stdout_for_console_codepage() -> None:
    """把 stdout 的编码错误策略换成 replace,让**输出面**不可能把结论面打死。

    实测踩到的形态:本机控制台代码页是 GBK,而"枚举到 0 个"那一行里有个 `⇒`,
    于是这条"拒绝出具合格证"的分支自己先抛 `UnicodeEncodeError` —— 退出码从 2 变成 1
    (崩溃),拿它当判据的下一步就会把"尺子打不开口"读成"仓里有别的毛病"。
    编码本身不变(GBK 控制台下中文照样出得去),只把不可编码的符号降级成 `?`。
    """
    try:
        sys.stdout.reconfigure(errors="replace")  # type: ignore[union-attr]
    except (AttributeError, OSError, ValueError):
        pass


def scan_repo(root: Path) -> dict[str, Any]:
    files = tracked_py(root)
    if not files:
        return {"empty": True}
    sources: dict[str, str] = {}
    unreadable: list[dict[str, str]] = []
    for path in files:
        rel = path.relative_to(root).as_posix()
        try:
            sources[rel] = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            unreadable.append({"file": rel, "reason": f"读取失败:{type(e).__name__}"})
    idx = build_index(sources)
    rows: list[dict[str, Any]] = []
    for rel in sources:
        rows.extend(audit_text(rel, sources[rel], idx))
    parts = partition_findings(rows)
    return {
        "empty": False,
        "scanned": len(sources),
        "files_total": len(files),
        "findings": parts["findings"],
        "exempted": parts["exempted"],
        "undetermined": parts["undetermined"],
        "unauditable": idx.unauditable + unreadable,
        "stale_exemptions": parts["stale_exemptions"],
    }


def main(argv: list[str] | None = None) -> int:
    harden_stdout_for_console_codepage()
    ap = argparse.ArgumentParser(description="审计:身份依赖未被消费的端点(只读)")
    ap.add_argument("--root", default=None, help="被审仓根(缺省 = 本脚本所在仓根)")
    ap.add_argument("--json", action="store_true")
    ap.add_argument(
        "--strict",
        action="store_true",
        help="有未判定/不可审文件 ⇒ exit 2(拒绝出具合格证);其下仍有判红 ⇒ exit 1",
    )
    ap.add_argument("--fail-on-findings", action="store_true")
    ns = ap.parse_args(argv)
    # 缺省只审**本 FastAPI 应用**(`apps/ai-service`)—— 判据的射程由"身份依赖的函数名表"
    # 决定,把它扩到别的语言/别的进程要另立一条判据,不是把 root 放宽就完事。
    root = Path(ns.root).resolve() if ns.root else Path(__file__).resolve().parents[1]
    result = scan_repo(root)
    if result["empty"]:
        # 枚举为空 = 尺子没跑到东西,不当"没有问题"报(本仓"空枚举判死"同一条口径)。
        print(json.dumps({"error": "枚举到 0 个 .py ⇒ 判据失明,不记为通过"}, ensure_ascii=True))
        return 2
    findings = result["findings"]
    undet = result["undetermined"]
    unaud = result["unauditable"]
    if ns.json:
        payload = {
            k: result[k]
            for k in (
                "scanned",
                "files_total",
                "findings",
                "exempted",
                "undetermined",
                "unauditable",
                "stale_exemptions",
            )
        }
        # JSON 恒纯 ASCII 转义输出:重定向到文件时 stdout 编码随控制台码页(本机 GBK),
        # ensure_ascii=False 的中文理由会让**下游解析**先炸在解码上 —— 结论面又会被
        # "取不到输出"伪装(与上面 harden 挡的是同一条崩溃的两半)。
        print(json.dumps(payload, ensure_ascii=True, indent=2))
    else:
        print(
            f"扫描 {result['scanned']} 个 .py:判红 {len(findings)} 处 / 显式豁免 "
            f"{len(result['exempted'])} 处 / 未判定 {len(undet)} 处 / 不可审文件 {len(unaud)} 个"
        )
        for r in findings:
            print(f"  [红] {r['file']}:{r['line']} {r['func']} :: {','.join(r['params'])}")
        for r in result["exempted"]:
            print(f"  [豁免] {r['file']}:{r['line']} {r['func']} —— {r['reason']}")
        for r in undet:
            print(f"  [未判定] {r['file']}:{r['line']} {r['func']} → {r['callee']}:{r['reason']}")
        for r in unaud:
            print(f"  [不可审] {r['file']}:{r['reason']}")
        for k in result["stale_exemptions"]:
            print(f"  [清单腐烂] 豁免条目已无对应判红,应删:{k}")
        print(
            "  (审计档;判红=两判据都不认的候选,逐条定性的分组账见 PROJECT_PLAN 的"
            " G-258/G-261)"
        )
    if ns.strict and (undet or unaud):
        return 2
    if (ns.strict or ns.fail_on_findings) and findings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
