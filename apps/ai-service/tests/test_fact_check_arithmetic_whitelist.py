# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""计算类声明求值的白名单出口(2026-10-31 立,替代 eval)。

现读缺陷(app/skills/content_engine/lib/fact_check.py 模式3):

    result = eval(calc, {"__builtins__": {}}, {})

`calc` 取自 article['claims_registry'] 里 category=='calculation' 条目的 calculation 字段,
而那份注册表由 LLM 从**外部文章内容**抽取 ⇒ 这是一条"外部输入直达求值器"的路径。
空 builtins 不是沙箱:靠属性链的逃逸一个 builtins 都不需要
(`().__class__.__mro__[-1].__subclasses__()`),`2**9**9**9` 这类形态还能把进程拖死。
原实现用 `except Exception: pass` 把一切都咽掉,所以既不会报也不会拦 —— 只有后果。

修法:换成结构上只认「数字字面量 + + - * / // %」的 AST 白名单求值器,其余节点当场 ValueError。

钉法(每档都有对面,防"恒拒绝"式假绿):
  ① 正常算术仍算得对(正向对照,摘掉白名单里的某个运算符本条即翻红);
  ② 属性链/函数调用/名字/幂/超长 一律 ValueError;
  ③ 最硬的一条: hostile 表达式不得产生任何副作用(文件没被创建);
  ④ 形状锁:本模块源码里不得再出现 eval( / exec( —— 防止"改完又被改回去"。
"""

from __future__ import annotations

import ast
import importlib.util
from pathlib import Path

import pytest

_MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / 'app'
    / 'skills'
    / 'content_engine'
    / 'lib'
    / 'fact_check.py'
)


def _load_module() -> object:
    spec = importlib.util.spec_from_file_location('fact_check_under_test', _MODULE_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_mod = _load_module()
_arithmetic = _mod.arithmetic_from_expression  # type: ignore[attr-defined]


def test_plain_arithmetic_still_computes() -> None:
    """① 正向对照:常规算术表达式的值必须与 Python 一致。"""
    assert _arithmetic('12 + 3 * 4') == 24
    assert _arithmetic('(2 + 3) / 5') == 1.0
    assert _arithmetic('-7 % 3') == -7 % 3
    assert _arithmetic('10 // 4') == 2


@pytest.mark.parametrize(
    'expr',
    [
        '().__class__.__mro__[-1].__subclasses__()',
        '__import__("os").system("whoami")',
        'open("/etc/passwd").read()',
        '2 ** 9 ** 9 ** 9',  # 幂不在白名单:DoS 形态
        'lambda: 1',
        '[x for x in (1,2)]',
        'a + 1',  # Name 一律拒
    ],
)
def test_hostile_or_out_of_scope_expressions_rejected(expr: str) -> None:
    """② 越界形态一律 ValueError(不是静默算出某个值)。"""
    with pytest.raises(ValueError):
        _arithmetic(expr)


def test_no_side_effect_even_when_swallowed(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """③ 副作用没发生:被拒的表达式不得留下任何痕迹。"""
    monkeypatch.chdir(tmp_path)
    markers = ['pwned.txt']

    for expr in (
        "open('pwned.txt','w').write('x')",
        "__import__('os').popen('type > pwned.txt')",
        'exec("open(chr(112)+chr(119)+chr(110)+chr(101)+chr(100))")',
    ):
        with pytest.raises(ValueError):
            _arithmetic(expr)

    assert not any((tmp_path / m).exists() for m in markers)


def test_rejects_empty_and_oversized() -> None:
    with pytest.raises(ValueError):
        _arithmetic('   ')
    with pytest.raises(ValueError):
        _arithmetic('1+' * 200)


def test_module_source_has_no_eval_or_exec() -> None:
    """④ 形状锁:求值器不许被改回 eval/exec。

    判据按 AST 的调用节点找,不按文本子串找 —— 文本档会把散文里提到的 `eval(` 当成违规
    (本文件第一版就自伤在这里),也会漏掉 `builtins.eval(` 之外的间接形态;而 `model.eval()`
    这类张量库用法是 Attribute 调用,不在本判据射程(它不是求值器)。

    这一枚住在每次提交都会跑的那一层(tests/),不是模块自检档 —— 按本仓纪律,
    回归锁只住在那里才算数。
    """
    tree = ast.parse(_MODULE_PATH.read_text(encoding='utf-8'))
    offenders: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in {'eval', 'exec'}:
                offenders.append(f'line {node.lineno}: {node.func.id}()')
    assert not offenders, f'fact_check 又出现了求值器调用: {offenders}'


def test_rejects_bool_as_number() -> None:
    """bool 是 int 的子类:不显式挡掉的话 True 会被当成 1 参与计算并"算对"。"""
    with pytest.raises(ValueError):
        _arithmetic('True + 1')
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
