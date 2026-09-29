# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-816042:模块自述的依赖关系必须与实况一致(源码级锁)。

起因:sse_contract.py 的头注曾写着「本模块零行为变化:仅作为事件名的事实来源与文档,
不被 ai-service 运行时强依赖」,而 `grep -rn "from app.core.sse_contract import" app`
现读有运行时 import —— 自述与实况分叉。读注释的人据此判断"改它没有影响",而实际有,
这正是本仓记过多次的失效型:散文承诺没有任何尺子核,分叉的表现永远是安静。

判据三条,各自成对:
  L1 头注里的 `SSE-CONTRACT-IMPORT-SITES = <N>` 必须等于全 app 面的运行时 import 现读数;
  L2 被禁措辞「不被 ai-service 运行时强依赖」不得回到文件里(它是一句已被证伪的承诺);
  L3 声明缺位(改了注释没更新那个数)⇒ 判失败,而不是跳过。

刻意不判的一格(如实登记,别误以为这里有门):只数 `from app.core.sse_contract import`,
不数 `import app.core.sse_contract as ...` 或 `__import__` 之类等价形态 —— 与守门 52 同取向
(宁漏不误报),扩形态要先证明那种写法在本仓真存在。
"""

from __future__ import annotations

import re
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1] / "app"
CONTRACT_FILE = APP_ROOT / "core" / "sse_contract.py"
DECL_TOKEN = re.compile(r"SSE-CONTRACT-IMPORT-SITES\s*=\s*(\d+)")
IMPORT_RE = re.compile(r"from\s+app\.core\.sse_contract\s+import\b")
BANNED_PHRASE = "不被 ai-service 运行时强依赖"


def _count_import_sites() -> int:
    """全 app 面现读运行时 import 处数(逐文件,跳过本测试自身与缓存目录)。"""
    total = 0
    for py in sorted(APP_ROOT.rglob("*.py")):
        if "__pycache__" in py.parts:
            continue
        text = py.read_text(encoding="utf-8", errors="replace")
        total += len(IMPORT_RE.findall(text))
    return total


def test_declared_import_site_count_matches_reality() -> None:
    """L1:头注声明的处数必须等于现读数(不等就是自述已分叉)。"""
    text = CONTRACT_FILE.read_text(encoding="utf-8")
    declared = DECL_TOKEN.findall(text)
    assert len(declared) == 1, f"L3 声明缺位或多份:头注应恰好有一句 SSE-CONTRACT-IMPORT-SITES = <N>(实得 {len(declared)} 处)"
    actual = _count_import_sites()
    assert int(declared[0]) == actual, (
        f"自述与实况分叉:头注声明 {declared[0]} 处运行时 import,现读 {actual} 处。"
        "新增/删除 import 点时必须同步改 app/core/sse_contract.py 里那个数。"
    )


def test_banned_stale_phrase_does_not_return() -> None:
    """L2:被证伪的旧措辞不得回来(它回来而数字没改,L1 也会红,但那一红会把人指向'改数字')。"""
    text = CONTRACT_FILE.read_text(encoding="utf-8")
    assert BANNED_PHRASE not in text, f"头注重新写入了已证伪的承诺:{BANNED_PHRASE!r}"


def test_import_site_counter_is_not_a_constant_zero() -> None:
    """阳性对照:现读量到的处数必须 > 0,否则上面两条在"什么都没扫到"时双双假绿。"""
    assert _count_import_sites() > 0, "app 面一枚 import 都没枚举到 ⇒ 尺子失效,不得当作通过"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
