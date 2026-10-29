# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具名单的 Python 侧唯一读入口(单一真相源的**消费端**,不是第二份真相源)。

## 为什么有这个模块(2026-10-29,§0.6 违反清账)

`routers/llm.py` 的 `_build_tool_summary` 里曾有三行**函数内**手写字面量::

    _FILE_SEARCH_TOOLS = frozenset({"read_file", "search_codebase", "file_search"})
    _WEB_SEARCH_TOOLS  = frozenset({"web_search", "search_web"})
    _FILE_MODIFY_TOOLS = frozenset({"file_edit", "write_file"})

而同一件事在前端各有一份(`packages/shared/src/chat/task-status.ts` 的
``FILE_WRITE_TOOLS``、`apps/web/src/components/ai/progress-sections/` 下的
``FILE_SEARCH_TOOLS`` / ``WEB_SEARCH_TOOLS`` / ``FILE_MODIFY_TOOLS`` / ``EXACT_MAP``)。
两侧已经漂开:后端"文件修改"只有 2 枚、前端 5 枚,于是同一会话两边算出不同的
"改了几个文件",而用户看到的是前端那个数。

现在名单只有一个生产端 = TS 真相源,由 ``scripts/gen-tool-name-sets.mjs`` 抽成
``app/data/tool_name_sets.json``(与 ``command_policy.json`` / ``default_models.json``
同一形态、同一目录),本模块是 Python 侧的**唯一读入口**。

## 纪律

- **禁止在本文件里出现任何工具名字面量**:名单只能来自那份 JSON。加工具请改 TS 源
  并跑 ``node scripts/gen-tool-name-sets.mjs``。
- **取不到就喊**:JSON 缺失 / 不可解析 / 形态不符 ⇒ 导入期 ``ToolNameSetsError``,
  绝不回落硬编码默认值(回落等于把第二份真相源重新种回来,而它下次不会漂在同一个地方)。
- 漂移判据在两个位置:前端 ``node scripts/gen-tool-name-sets.mjs --check``(生成物 ↔ TS 源),
  后端 ``tests/test_tool_summary.py``(本模块 ↔ JSON ↔ TS 源三面同值)。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

__all__ = [
    "COMMAND_TOOLS",
    "FILE_CATEGORY_TOOLS",
    "FILE_MODIFY_TOOLS",
    "FILE_SEARCH_TOOLS",
    "FILE_WRITE_TOOLS",
    "PATH_ARG_KEYS",
    "WEB_SEARCH_TOOLS",
    "ToolNameSetsError",
    "load_tool_name_sets",
    "tool_name_sets_path",
]

#: 生成物落点(与 command_policy.json / default_models.json 同目录)。
_DATA_FILE = "tool_name_sets.json"

#: 每一档的键名 → 该档在 JSON 里必须是 list[str](形态锁;少一档或多一型都判"未判定")。
_LIST_KEYS = (
    "fileWrite",
    "pathArgKeys",
    "fileSearch",
    "webSearch",
    "fileModify",
    "commandTools",
    "fileCategoryTools",
)


class ToolNameSetsError(RuntimeError):
    """名单生成物取不到或形态不符。导入期抛出,不做任何静默回落。"""


def tool_name_sets_path() -> Path:
    """生成物的绝对路径(按本文件位置推导,不依赖 cwd —— §15 共享工作区 cwd 不可靠)。"""
    return Path(__file__).resolve().parent.parent / "data" / _DATA_FILE


def load_tool_name_sets(path: Path | None = None) -> dict[str, Any]:
    """读并**校验形态**的生成物;取不到 / 不可解析 / 形态不符 ⇒ ``ToolNameSetsError``。

    形态要求逐条:
    - 顶层是对象,且 ``_LIST_KEYS`` 每一档都存在、都是 list;
    - 每一档每个成员都是非空字符串(空串会让"未知工具"和"某个真工具"混成一个键);
    - ``pathArgKeys`` 非空且无重复(前端 ``pickFilePath`` 按序取第一个字符串键,重复即语义模糊)。
    """
    p = path if path is not None else tool_name_sets_path()
    try:
        raw = p.read_text(encoding="utf-8")
    except OSError as e:
        raise ToolNameSetsError(
            f"工具名单生成物读不到:{p}({e.__class__.__name__}: {e});"
            "修法 = 在仓库根跑 node scripts/gen-tool-name-sets.mjs"
        ) from e
    try:
        data = json.loads(raw)
    except ValueError as e:
        raise ToolNameSetsError(f"工具名单生成物不是可解析 JSON:{p}({e})") from e
    if not isinstance(data, dict):
        raise ToolNameSetsError(f"工具名单生成物根必须是对象:{p}")

    out: dict[str, Any] = {}
    for key in _LIST_KEYS:
        value = data.get(key)
        if not isinstance(value, list):
            raise ToolNameSetsError(f"工具名单生成物缺 {key}(或不是 list):{p}")
        for item in value:
            if not isinstance(item, str) or not item:
                raise ToolNameSetsError(f"工具名单 {key} 里有非字符串或空串成员:{item!r}")
        out[key] = list(value)

    keys = out["pathArgKeys"]
    if not keys:
        raise ToolNameSetsError(f"pathArgKeys 为空 ⇒ 路径取值面整族失明:{p}")
    if len(set(keys)) != len(keys):
        raise ToolNameSetsError(f"pathArgKeys 有重复键,取值次序不再唯一:{keys}")

    cat = data.get("categoryByTool")
    if not isinstance(cat, dict) or not cat:
        raise ToolNameSetsError(f"工具名单生成物缺 categoryByTool:{p}")
    out["categoryByTool"] = dict(cat)
    return out


_SETS = load_tool_name_sets()

#: 会改动工作区文件的写类工具(前端 ``FILE_WRITE_TOOLS``;**动作粒度**,用于 `edits` 档)
FILE_WRITE_TOOLS: frozenset[str] = frozenset(_SETS["fileWrite"])

#: 取文件路径时依次尝试的参数键(前端 ``PATH_ARG_KEYS``;**顺序有语义**,不可排序)
PATH_ARG_KEYS: tuple[str, ...] = tuple(_SETS["pathArgKeys"])

#: 文件检索类(前端 ``FILE_SEARCH_TOOLS``;用于 `filesSearched` 档)
FILE_SEARCH_TOOLS: frozenset[str] = frozenset(_SETS["fileSearch"])

#: 网页检索类(前端 ``WEB_SEARCH_TOOLS``;用于 `webSearched` 档)
WEB_SEARCH_TOOLS: frozenset[str] = frozenset(_SETS["webSearch"])

#: 会被计成"改了哪个文件 / 增删多少行"的工具(前端 ``FILE_MODIFY_TOOLS``;**文件粒度**)
FILE_MODIFY_TOOLS: frozenset[str] = frozenset(_SETS["fileModify"])

#: 类目 = command 的工具(前端 ``resolveToolCategory(x) === 'command'`` 的等价名单)
COMMAND_TOOLS: frozenset[str] = frozenset(_SETS["commandTools"])

#: 类目以 ``file_`` 开头的工具(前端 ``resolveToolCategory(x).startsWith('file_')`` 的等价名单)
FILE_CATEGORY_TOOLS: frozenset[str] = frozenset(_SETS["fileCategoryTools"])

#: 工具名 → 类目(前端 ``EXACT_MAP`` 的镜像;未命中不等于 other —— 前端还有 MCP 命名约定那一支)
CATEGORY_BY_TOOL: dict[str, str] = _SETS["categoryByTool"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
