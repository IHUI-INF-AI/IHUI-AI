# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""反风控状态文件路径必须**与进程 cwd 无关**的回归锁(同族缺陷第三维)。

同一线上前两维各有其锁:身份键(`test_publish_identity_key_stability.py`)、
画像根(`test_profile_root_is_cwd_independent.py`)。本文件管的是 5 个**状态文件**:
设备图谱、审计日志、冷却状态、风险事件、Cookie 健康度。

病灶(2026-09-27 实测):这些模块各自写着

    _XXX_FILE = Path(os.environ.get("<ENV>", ".ihui-agent/tmp/xxx.json")).resolve()

`Path(相对).resolve()` 按**进程 cwd** 解析,而 `pnpm --filter @ihui/ai-service dev` 的
cwd 就是 `apps/ai-service` ⇒ 真数据一直长在 `apps/ai-service/.ihui-agent/tmp/`(该处
device_graph.json 2975 B,仓库根那份当时不存在)。换一次启动姿势 = 设备图谱与冷却状态
**从零开始**:联动检测看不见既有关联、冷却看不见刚发过的事 —— 恰好制造本层要防的行为。

判四件事:
1. 各模块的解析结果在**两个不同 cwd** 下逐字相同(经子进程真导入读模块常量,
   只判纯函数会放过"出口写对了、模块没接上"这种半接线);
2. 解析结果落在仓库根之下、且**不在** `apps/ai-service/` 里面("落在端内"即旧形态);
3. 仓库根推导在 `anti_risk/**` 代码面里只有一处实现(源码面锁),`account_profile`
   不得再留自己那份;
4. 变异对照:把模块退回旧的相对默认值写法,判据必红(喂构造文本证明,不改生产代码)。

**模块清单不硬写在本文件里**(清单会腐烂):候选由 `_candidate_modules()` 在 `anti_risk/`
现找"模块级 `*_FILE` 赋值"得出;扫到 0 个不算通过 —— 发现判据自身由
`test_discovery_has_teeth` 双向钉死(真实目录必非空 / 空目录必被判失明)。
"""
from __future__ import annotations

import ast
import io
import json
import os
import subprocess
import sys
import tokenize
from pathlib import Path
from typing import Any

from app.services.publish.anti_risk.state_paths import resolve_state_path

# 仓库根由**本文件自身位置**独立推导,刻意不与实现共用那一次上溯计数:两处一旦互相
# 不一致(例如模块搬家后层数过期),本文件必须当场红,而不是双双漂开还互相印证。
REPO_ROOT = Path(__file__).resolve().parents[3]
AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
ANTI_RISK_DIR = AI_SERVICE_DIR / "app" / "services" / "publish" / "anti_risk"

#: 唯一出口的函数名 —— 任何模块级 `*_FILE` 赋值都必须经它取值。
_EXIT = "resolve_state_path"

#: 发现判据的**下限**,不是权威表:低于它就说明发现逻辑瞎了或模块被改名/删除,
#: 必须人来确认。真实数量一律以现扫为准(本数字只把"静默空扫"变成响的失败)。
_DISCOVERY_FLOOR = 5

#: 子进程探针:导入指定模块并打印其模块级 `*_FILE` 常量的取值(路径推导的真实现场)。
_PROBE = """
import importlib, json, sys
out = {}
for name in json.loads(sys.argv[1]):
    mod = importlib.import_module("app.services.publish.anti_risk." + name)
    for attr in dir(mod):
        if attr.endswith("_FILE"):
            out[f"{name}.{attr}"] = str(getattr(mod, attr))
print(json.dumps(out))
"""


# ---------------------------------------------------------------------------
# 纯文本判据(输入可以是构造面 ⇒ 变异对照不必改生产代码)
# ---------------------------------------------------------------------------
def _masked_code_lines(src: str) -> list[str]:
    """逐行剥掉**注释与 docstring** 的源码副本(字符串字面量必须保留)。

    判据只能看代码面,否则锁会咬到自己写的解释(守门 70/131 同型:说明文字里出现
    执行性字符被误判,后人的处置是删说明 —— 那是把判据换成盲区)。
    """
    masked = src.splitlines()
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type == tokenize.COMMENT:
            row = tok.start[0]
            masked[row - 1] = masked[row - 1][: tok.start[1]]
    for node in ast.walk(ast.parse(src)):
        if (
            isinstance(node, ast.Expr)
            and isinstance(node.value, ast.Constant)
            and isinstance(node.value.value, str)
        ):
            end = node.end_lineno or node.lineno
            for i in range(node.lineno - 1, end):
                masked[i] = ""
    return masked


def _uses_exit(node: ast.AST) -> bool:
    """右值里是否出现"直接调用 `resolve_state_path(...)`"(别名/属性形态不算)。

    只认这个名字:出口的价值在于"全仓一条规则",换个入口判据就不成立了。
    """
    for sub in ast.walk(node):
        if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) and sub.func.id == _EXIT:
            return True
    return False


def _string_literals(node: ast.AST) -> list[str]:
    return [n.value for n in ast.walk(node) if isinstance(n, ast.Constant) and isinstance(n.value, str)]


def _state_file_specs(src: str) -> list[dict[str, Any]]:
    """现读模块源码里的模块级 `*_FILE` 赋值 → `[{name, line, via_exit, env, default}]`。

    `env` / `default` 只是附带信息(把环境变量覆盖喂给子进程探针用),
    违规判据本身不依赖它们存在。
    """
    specs: list[dict[str, Any]] = []
    for stmt in ast.parse(src).body:
        if not isinstance(stmt, ast.Assign):
            continue
        for target in stmt.targets:
            if not (isinstance(target, ast.Name) and target.id.endswith("_FILE")):
                continue
            env: str | None = None
            default: str | None = None
            for lit in _string_literals(stmt.value):
                if lit and lit.replace("_", "").isalnum() and lit.isupper():
                    env = env or lit
                elif ("/" in lit or lit.startswith(".")) and not Path(lit).is_absolute():
                    default = default or lit
            specs.append(
                {
                    "name": target.id,
                    "line": stmt.lineno,
                    "via_exit": _uses_exit(stmt.value),
                    "env": env,
                    "default": default,
                }
            )
    return specs


def _violations(src: str) -> list[str]:
    """未经出口的模块级 `*_FILE` 赋值(= 旧形状复活)。纯文本判据,可喂构造面。"""
    return [f"{s['name']}(L{s['line']})" for s in _state_file_specs(src) if not s["via_exit"]]


def _candidate_modules(directory: Path) -> dict[str, str]:
    """在 `anti_risk/` 里现找含模块级 `*_FILE` 赋值的模块:`{模块名: 源码}`。"""
    found: dict[str, str] = {}
    for py in sorted(directory.rglob("*.py")):
        if py.name == "__init__.py" or "__pycache__" in py.parts:
            continue
        try:
            src = py.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeDecodeError):
            continue
        if _state_file_specs(src):
            found[py.stem] = src
    return found


def _coverage_or_fail(names: list[str]) -> None:
    """覆盖面自证:扫到 0 个(或少于下限)**不是**"无事可做",而是发现判据失明。"""
    assert len(names) >= _DISCOVERY_FLOOR, (
        f"anti_risk/ 只现读到 {len(names)} 个含模块级 *_FILE 赋值的模块(下限 "
        f"{_DISCOVERY_FLOOR}) —— 发现逻辑瞎了或模块被改名/删除，不得当作通过"
    )


def _run_probe(cwd: Path, extra_env: dict[str, str] | None = None) -> dict[str, str]:
    """在指定 cwd(可覆写 ANTI_RISK_* 环境变量)下真导入各状态模块,取回其路径常量。"""
    names = sorted(_candidate_modules(ANTI_RISK_DIR))
    _coverage_or_fail(names)
    env = {k: v for k, v in os.environ.items() if not (k.startswith("ANTI_RISK_") and k.endswith("_FILE"))}
    env["PYTHONPATH"] = str(AI_SERVICE_DIR)
    env["PYTHONIOENCODING"] = "utf-8"
    env.update(extra_env or {})
    proc = subprocess.run(
        [sys.executable, "-c", _PROBE, json.dumps(names)],
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=240,
    )
    assert proc.returncode == 0, f"探针子进程失败 rc={proc.returncode}: {proc.stderr[-800:]}"
    result: dict[str, str] = json.loads(proc.stdout.strip().splitlines()[-1])
    return result


def _two_cwds(tmp_path: Path) -> tuple[Path, Path]:
    a = tmp_path / "cwd-a"
    b = tmp_path / "cwd-b"
    a.mkdir(parents=True, exist_ok=True)
    b.mkdir(parents=True, exist_ok=True)
    return a, b


# ---------------------------------------------------------------------------
# 1) 覆盖面自证 + 每个模块都走唯一出口
# ---------------------------------------------------------------------------
def test_discovery_has_teeth(tmp_path: Path) -> None:
    """双向钉死发现判据:真实目录必非空 / 空目录必被判失明。

    只有"扫到了"这一半的判据,形状一改就静默变成"0 个候选 ⇒ 全绿"。
    """
    real = sorted(_candidate_modules(ANTI_RISK_DIR))
    _coverage_or_fail(real)
    empty = tmp_path / "no-state-here"
    empty.mkdir()
    assert _candidate_modules(empty) == {}, "空目录不该被判出候选(判据过宽会指使搬迁器搬错东西)"
    # 发现 + 判红这条链必须端到端有牙:旧形状落进目录 ⇒ 既被发现、也被判违规
    (empty / "legacy_shape.py").write_text(_OLD_SHAPE, encoding="utf-8")
    discovered = _candidate_modules(empty)
    assert list(discovered) == ["legacy_shape"], "旧形状模块没被发现 = 搬迁/判据两头都会漏它"
    assert _violations(discovered["legacy_shape"]) == ["_GRAPH_FILE(L5)"], "发现到了却不判红 = 只报数不问责"
    try:
        _coverage_or_fail([])
    except AssertionError:
        pass
    else:
        raise AssertionError("覆盖面自证无牙:扫到 0 个候选必须算失败，不得记为通过")


def test_every_state_file_module_uses_the_single_exit() -> None:
    """现读到的每个状态文件模块都必须经 `resolve_state_path` 取值,一处不许例外。"""
    offenders: list[str] = []
    for module, src in sorted(_candidate_modules(ANTI_RISK_DIR).items()):
        hits = _violations(src)
        if hits:
            offenders.append(f"{module}.py: {', '.join(hits)}")
    assert not offenders, (
        "以下状态文件路径未经唯一出口(相对值会按进程 cwd 解析 = 换启动目录就换一张脸):"
        + "; ".join(offenders)
    )


# ---------------------------------------------------------------------------
# 2) 真实解析:两个 cwd 同结果 + 落点在仓库根之下、不在端内
# ---------------------------------------------------------------------------
def test_modules_resolve_identically_across_two_cwds(tmp_path: Path) -> None:
    """本缺陷的判据本体:同一份代码在任何启动目录下都必须指向同一个物理文件。"""
    cwd_a, cwd_b = _two_cwds(tmp_path)
    got_a = _run_probe(cwd_a)
    got_b = _run_probe(cwd_b)
    assert got_a, "探针没取到任何 *_FILE 常量值 = 判据失明"
    assert got_a == got_b, f"状态文件路径随 cwd 漂移:\nA={got_a}\nB={got_b}"


def test_resolved_paths_under_repo_root_and_outside_ai_service(tmp_path: Path) -> None:
    """解析结果必须落在仓库根之下、且**不得**落回 `apps/ai-service/` 里面。

    实测事故里真数据恰好漂在 `apps/ai-service/.ihui-agent/tmp/` —— "落在端内"本身
    就是要防的那一型,本断言不得为过门放宽。
    """
    cwd_a, _ = _two_cwds(tmp_path)
    for key, value in sorted(_run_probe(cwd_a).items()):
        p = Path(value)
        assert p.is_absolute(), f"{key} 解析出相对路径 {value}"
        assert p.is_relative_to(REPO_ROOT), f"{key} = {p} 不在仓库根 {REPO_ROOT} 之下"
        assert not p.is_relative_to(AI_SERVICE_DIR), (
            f"{key} = {p} 落回了 apps/ai-service 内部 —— 正是随启动目录分裂的旧形态"
        )


def test_env_override_is_honoured_and_relative_value_anchors_repo_root(tmp_path: Path) -> None:
    """环境变量语义保持:给了就用它 —— 绝对值原样采用,相对值锚定仓库根(不再按 cwd)。"""
    cwd_a, _ = _two_cwds(tmp_path)
    specs = [(m, s) for m, src in sorted(_candidate_modules(ANTI_RISK_DIR).items()) for s in _state_file_specs(src)]
    with_env = [s["env"] for _, s in specs if s["env"]]
    assert len(set(with_env)) == len(with_env) == len(specs), (
        "有模块的 *_FILE 赋值读不出环境变量名，或多个模块共用同一个环境变量(形状变了?)"
    )

    abs_dir = tmp_path / "env-target"
    extra: dict[str, str] = {}
    expected: dict[str, str] = {}
    for module, spec in specs:
        target = abs_dir / f"{module}.json"
        extra[str(spec["env"])] = str(target)
        expected[f"{module}.{spec['name']}"] = str(target.resolve())
    got = _run_probe(cwd_a, extra)
    assert got == expected, f"绝对环境变量覆盖未被原样采用:\ngot={got}\nwant={expected}"

    first_module, first_spec = specs[0]
    got_rel = _run_probe(cwd_a, {str(first_spec["env"]): "zz-state-anchor-probe/x.json"})
    assert got_rel[f"{first_module}.{first_spec['name']}"] == str(
        (REPO_ROOT / "zz-state-anchor-probe" / "x.json").resolve()
    ), "相对覆盖值仍随 cwd 漂移 = 缺陷换了入口复活"


# ---------------------------------------------------------------------------
# 3) 唯一锚点:仓库根推导在 anti_risk/** 只此一处
# ---------------------------------------------------------------------------
def test_repo_root_derivation_exists_exactly_once() -> None:
    """源码面锁:上溯计数在 `anti_risk/**` 代码面里只许出现一次,且住在 state_paths.py。

    判据不许有第二份 —— 两处各数一次层数,模块搬家时必有一处过期而另一处仍报绿。
    刻意不钉行号:任何一次 append 都会让行号挪位,把"第几行"当证据等于没有证据。
    """
    files: list[str] = []
    for py in sorted(ANTI_RISK_DIR.rglob("*.py")):
        if "__pycache__" in py.parts or py.name == "__init__.py":
            continue
        hits = [ln for ln in _masked_code_lines(py.read_text(encoding="utf-8-sig")) if "parents[" in ln]
        if hits:
            files.append(f"{py.relative_to(REPO_ROOT).as_posix()}({len(hits)} 处)")
    assert len(files) == 1 and files[0].endswith("state_paths.py(1 处)"), (
        f"仓库根推导必须只有 state_paths.py 一处实现，现测 {files}"
    )


def test_account_profile_has_no_own_root_derivation() -> None:
    """`account_profile` 不得再留自己那份仓库根推导(第二处真相正是本票要收的)。"""
    src = (ANTI_RISK_DIR / "account_profile.py").read_text(encoding="utf-8-sig")
    hits = [i for i, ln in enumerate(_masked_code_lines(src), start=1) if "parents[" in ln]
    assert not hits, f"account_profile.py 代码面仍有仓库根推导(行 {hits})，改走 state_paths 出口"
    assert _EXIT in src, "account_profile 必须复用新出口"


# ---------------------------------------------------------------------------
# 4) 变异对照:退回旧写法判据必红(构造文本,不动生产代码)
# ---------------------------------------------------------------------------
_OLD_SHAPE = '''"""构造面:旧的相对默认值形状(本缺陷本体)。"""
import os
from pathlib import Path

_GRAPH_FILE = Path(os.environ.get(
    "ANTI_RISK_MUTATION_FILE",
    ".ihui-agent/tmp/mutation.json",
)).resolve()
'''

_FIXED_SHAPE = '''"""构造面:经唯一出口的新形状。"""
import os
from .state_paths import resolve_state_path

_GRAPH_FILE = resolve_state_path(
    os.environ.get("ANTI_RISK_MUTATION_FILE"),
    ".ihui-agent/tmp/mutation.json",
)
'''

_SIDE_DOOR_SHAPE = '''"""构造面:既不读 env 也没走出口的第三形状。"""
from pathlib import Path

_OTHER_FILE = Path("/tmp/mutation.json")
'''


def test_mutation_control_old_relative_shape_is_red() -> None:
    """把任一模块退回旧的相对默认值 ⇒ 判据必须红(否则它只是对本型全盲的描述文字)。"""
    assert _violations(_OLD_SHAPE) == ["_GRAPH_FILE(L5)"], "旧形状未被点名 = 判据对这一型全盲"
    assert _violations(_FIXED_SHAPE) == [], "新形状被误判 = 判据严到把合规写法报成违规,后人只好跳判据"
    assert _violations(_SIDE_DOOR_SHAPE) == ["_OTHER_FILE(L4)"], "旁门形状未点名 = 判据只认那一种写法"
    exit_src = (ANTI_RISK_DIR / "state_paths.py").read_text(encoding="utf-8-sig")
    assert _violations(exit_src) == [], "出口自身实现不该被算作违规候选(它没有 *_FILE 赋值)"


def test_exit_rejects_absolute_default_value() -> None:
    """默认值给绝对路径必须报错 —— 锚点不得被藏进各调用方(那等于回到两处真相)。"""
    try:
        resolve_state_path(None, str(REPO_ROOT / "sneaky.json"))
    except ValueError:
        pass
    else:
        raise AssertionError("resolve_state_path 接受了绝对默认值 = 第二处锚点的合法通道没堵住")


def test_exit_purity_and_three_states(tmp_path: Path, monkeypatch) -> None:
    """三态规则与零副作用:默认/相对锚仓库根、绝对原样、空白归默认、解析不建目录。"""
    cwd_a, cwd_b = _two_cwds(tmp_path)
    monkeypatch.chdir(cwd_a)
    default = resolve_state_path(None, ".ihui-agent/tmp/probe.json")
    monkeypatch.chdir(cwd_b)
    assert resolve_state_path(None, ".ihui-agent/tmp/probe.json") == default, "默认档随 cwd 漂移"
    assert default == REPO_ROOT / ".ihui-agent" / "tmp" / "probe.json"
    monkeypatch.chdir(cwd_a)
    assert resolve_state_path("", ".ihui-agent/tmp/probe.json") == default, "空串必须归默认档"
    assert resolve_state_path("   ", ".ihui-agent/tmp/probe.json") == default, "纯空白必须归默认档"
    assert resolve_state_path("zz-probe-rel/x.json", ".ihui-agent/tmp/probe.json") == (
        REPO_ROOT / "zz-probe-rel" / "x.json"
    )
    target = tmp_path / "abs.json"
    assert resolve_state_path(str(target), ".ihui-agent/tmp/probe.json") == target.resolve()
    assert not (REPO_ROOT / "zz-probe-rel").exists(), "解析不得 mkdir(模块导入期与调用期都保持零副作用)"
