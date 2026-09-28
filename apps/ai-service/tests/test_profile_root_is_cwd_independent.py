# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""画像根目录必须**与进程 cwd 无关**的反风控回归锁。

病灶(实测确认):旧 account_profile.py 写的是

    Path(os.environ.get("ANTI_RISK_PROFILE_DIR", ".ihui-agent/tmp/anti-profiles")).resolve()

`Path(相对路径).resolve()` 按**进程当前工作目录**解析,于是同一份配置在不同启动姿势
下落到三个不同的物理根(实测:apps/ai-service 下一份 9 目录且都带 Cookies、
apps/ai-service/.trae-cn 下一份 11 个空壳、仓库根下一份 0 目录)⇒ 同一账号
"换个目录启动就是换一张脸",画像/指纹隔离等于没生效。

本文件判的是纯函数 resolve_profile_root 的**三态规则**(默认 / 相对 / 绝对),
不碰 os.environ、不创建目录、不依赖宿主进程恰好站在哪个 cwd。
"""

from __future__ import annotations

import ast
import io
import tokenize
from pathlib import Path

from app.services.publish.anti_risk import account_profile
from app.services.publish.anti_risk.account_profile import resolve_profile_root

# 由本测试文件自身位置独立推导仓库根(apps/ai-service/tests/ → 上溯 3 层)。
# 刻意**不**与实现共用同一次 parents 计数:两处推导一旦互相不一致(例如模块搬家
# 后层数过期)本文件必须当场红,而不是"双双漂开还互相印证"。
REPO_ROOT = Path(__file__).resolve().parents[3]
AI_SERVICE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_ROOT = REPO_ROOT / ".ihui-agent" / "tmp" / "anti-profiles"

#: 画像根的相对字面量 —— 源码面锁的判据对象。
_LITERAL = ".ihui-agent/tmp/anti-profiles"


def _chdir_two(tmp_path: Path) -> tuple[Path, Path]:
    """造两个互不相同的 cwd(monkeypatch 自动还原),用于正向证明"与 cwd 无关"。"""
    cwd_a = tmp_path / "cwd-a"
    cwd_b = tmp_path / "cwd-b"
    cwd_a.mkdir()
    cwd_b.mkdir()
    return cwd_a, cwd_b


def test_default_root_identical_across_two_cwds(tmp_path, monkeypatch) -> None:
    """本缺陷的正向判据:换任何 cwd,默认根解析结果必须逐字相同。

    旧写法在这一条必红(Path(rel).resolve() 随 cwd 漂移)。
    """
    cwd_a, cwd_b = _chdir_two(tmp_path)
    monkeypatch.chdir(cwd_a)
    root_a = resolve_profile_root(None)
    monkeypatch.chdir(cwd_b)
    root_b = resolve_profile_root(None)
    assert root_a == root_b, "默认画像根随 cwd 漂移 = 换目录就是换一张脸"
    assert root_a == DEFAULT_ROOT, "默认根必须锚定仓库根的 .ihui-agent/tmp/anti-profiles"


def test_default_root_under_repo_root_and_outside_ai_service(tmp_path, monkeypatch) -> None:
    """解析结果必须落在仓库根之下、且**不得**落回 apps/ai-service/ 里面。

    实测事故里真实登录态(Cookies)恰好漂在 apps/ai-service/.ihui-agent/ 下 ——
    "落在端内"本身就是要防回归的那一型,本断言不得为过门放宽。
    """
    cwd_a, cwd_b = _chdir_two(tmp_path)
    for cwd in (cwd_a, cwd_b):
        monkeypatch.chdir(cwd)
        root = resolve_profile_root(None)
        assert root.is_relative_to(REPO_ROOT), f"{root} 不在仓库根 {REPO_ROOT} 之下"
        assert not root.is_relative_to(AI_SERVICE_DIR), (
            f"{root} 落回了 apps/ai-service 内部 —— 正是画像根随启动目录分裂的旧形态"
        )


def test_relative_override_anchored_to_repo_root_not_cwd(tmp_path, monkeypatch) -> None:
    """环境变量给相对路径时也必须锚定仓库根 —— 不得保留"相对即按 cwd"的老语义。"""
    cwd_a, cwd_b = _chdir_two(tmp_path)
    monkeypatch.chdir(cwd_a)
    root_a = resolve_profile_root("custom/anti")
    monkeypatch.chdir(cwd_b)
    root_b = resolve_profile_root("custom/anti")
    assert root_a == root_b, "相对路径覆盖值仍随 cwd 漂移 = 本缺陷本体换了入口复活"
    assert root_a == REPO_ROOT / "custom" / "anti"


def test_absolute_override_used_verbatim(tmp_path, monkeypatch) -> None:
    """绝对路径原样采用(只做规范化),不因任何锚点被改写。"""
    cwd_a, cwd_b = _chdir_two(tmp_path)
    target = tmp_path / "abs-profiles"
    for cwd in (cwd_a, cwd_b):
        monkeypatch.chdir(cwd)
        assert resolve_profile_root(str(target)) == target.resolve()


def test_blank_env_value_falls_back_to_default(tmp_path, monkeypatch) -> None:
    """空串/纯空白按"未设置"处理。

    旧实现把 ANTI_RISK_PROFILE_DIR="" 解析成 **cwd 本身**(Path("").resolve()==cwd),
    画像会直接长在启动目录里 —— 归入默认档是唯一不漂的处置。
    """
    cwd_a, _ = _chdir_two(tmp_path)
    monkeypatch.chdir(cwd_a)
    assert resolve_profile_root("") == DEFAULT_ROOT
    assert resolve_profile_root("   ") == DEFAULT_ROOT


def test_resolution_is_pure_no_directory_created(tmp_path, monkeypatch) -> None:
    """解析不得有副作用:不许 mkdir(导入期与调用期都不许)。"""
    cwd_a, _ = _chdir_two(tmp_path)
    monkeypatch.chdir(cwd_a)
    target = resolve_profile_root("zz-not-a-real-dir/anti-profiles-probe")
    assert not target.exists(), f"resolve_profile_root 创建了目录 {target} —— 必须是纯函数"
    assert not (cwd_a / "zz-not-a-real-dir").exists(), "相对档不得按 cwd 解析、更不得在 cwd 下建目录"


def _masked_code_lines(src: str) -> list[str]:
    """逐行剥掉**注释与 docstring**后的源码副本(字符串字面量必须保留)。

    源码面锁判的是"代码里有没有第二处硬拼画像根":
    - 注释 / docstring 里的提及要放过,否则锁会咬到自己写的解释
      (本仓守门 70/131 记过同型:判据把说明文字判成违规,后人只好删说明);
    - 字符串字面量绝不能遮,遮掉等于把"第二处硬拼"洗成"没看见"。
    """
    lines = src.splitlines()
    masked = list(lines)
    # 1) 注释:tokenize 精确定位 COMMENT token,从其起始列截断(不受串内 '#' 干扰)。
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type == tokenize.COMMENT:
            row = tok.start[0]
            masked[row - 1] = masked[row - 1][: tok.start[1]]
    # 2) docstring(模块级与函数级):任何"裸字符串表达式语句"整行清空。
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


def test_profile_root_literal_only_inside_resolve_exit() -> None:
    """源码面锁:account_profile.py 里,画像根相对字面量只许出现在唯一出口内部。

    两条断言各拦一型:
    - inside 为空 ⇒ 默认档被搬出出口(出口失去默认,或字面量散回模块级);
    - outside 命中 ⇒ 有人在本文件第二处硬拼画像根(两处真相必漂移)。
    """
    src = Path(account_profile.__file__).read_text(encoding="utf-8-sig")
    tree = ast.parse(src)
    fn = next(
        (
            n
            for n in tree.body
            if isinstance(n, ast.FunctionDef) and n.name == "resolve_profile_root"
        ),
        None,
    )
    assert fn is not None, "resolve_profile_root 必须定义在 account_profile 模块顶层"
    lo, hi = fn.lineno, fn.end_lineno or fn.lineno
    masked = _masked_code_lines(src)
    inside = "\n".join(masked[lo - 1 : hi])
    outside = "\n".join(masked[: lo - 1] + masked[hi:])
    assert _LITERAL in inside, (
        "默认画像根字面量必须住在唯一出口 resolve_profile_root 的代码面里 —— "
        "该断言变红说明默认档被挪去别处(第二处硬拼的前奏)"
    )
    assert _LITERAL not in outside, (
        "画像根相对字面量在唯一出口之外又出现了一次 —— 收敛进 resolve_profile_root,"
        "不得在模块里第二处拼同一个根"
    )
