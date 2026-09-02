# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SKILL.md 解析工具(1-7 技能体系标准化)。

对齐 Anthropic Skills 规范:frontmatter 必需 ``name`` + ``description``,
正文为 instructions;兼容额外字段(``metadata`` / ``allowed-tools`` / ``version``
等)且不丢弃。提供:

- :func:`parse_skill_md` 严格兼容两种 frontmatter(宽松逐行 与 Anthropic 风格)
- :func:`validate_skill_md` 返回缺失的必需字段
- :func:`discover_skill_md` 只读递归扫描某目录下所有 ``SKILL.md``(catalog 用)

解析健壮性:

- 容忍 frontmatter 前的 HTML 注释块(业务技能 koubo_workflow / content_engine
  的 SKILL.md 顶部带 Provenance 注释)。
- 支持多行 ``description``(YAML 块标量 ``|`` / ``>`` 及缩进续行)。
- 支持引号包裹标量(``'...'`` / ``"..."``)并剥除引号。
- 其余字段原样保留到 ``SkillMd.extra``(不丢弃、不执行)。

设计决策(扫描策略):业务技能目录(koubo_workflow / content_engine 下 skills/*)
默认**不**纳入执行注册表扫描,仅作为只读 catalog 审计;默认执行扫描源为
``app/skills/auto/*.md``。若需扩展扫描根,由 ``SkillRegistry`` 通过
``IHUI_SKILL_SCAN_ROOTS`` 环境变量(逗号分隔目录)增量叠加,且业务目录仍只读取、
不改写、不执行。详见 ``app/services/skills.py`` 中 ``SkillRegistry._iter_skill_files``。
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Any

# 必需字段(对齐 Anthropic Skills 规范 + packages/types SkillFrontmatter)。
_REQUIRED_FIELDS: tuple[str, ...] = ("name", "description")

# frontmatter 可前置 0..n 个 HTML 注释块 + 空白,再接 --- 分隔符。
# group(1)=frontmatter 文本, group(2)=正文 instructions。
_FRONTMATTER_RE = re.compile(
    r"^\s*(?:<!--.*?-->\s*)*---\n(.*?)\n---\n?(.*)$",
    re.DOTALL,
)

# 块标量指示符(YAML):| 字面, > 折叠;+/- 为裁剪标记。
_BLOCK_SCALARS = ("|", ">", "|-", ">-", "|+", ">+")


@dataclass
class SkillMd:
    """单个 SKILL.md 的解析结果。

    Attributes:
        name: frontmatter ``name``(空字符串表示缺失)。
        description: frontmatter ``description``(支持多行折叠,空表示缺失)。
        instructions: 剥离 frontmatter 后的正文(已 trim)。
        extra: 其余 frontmatter 字段(name/description 之外)原样保留。
        has_frontmatter: 是否成功解析到 frontmatter 块。
    """

    name: str = ""
    description: str = ""
    instructions: str = ""
    extra: dict[str, Any] = field(default_factory=dict)
    has_frontmatter: bool = False


def _parse_frontmatter(fm_text: str) -> dict[str, str]:
    """解析宽松 YAML frontmatter 为 {key: raw_value}。

    支持:块标量(``|``/``>``)、引号包裹标量、缩进续行。值均为原始字符串,
    复杂结构(列表/嵌套对象)保留为原样文本存入 ``extra``(不丢弃)。
    """
    result: dict[str, str] = {}
    lines = fm_text.split("\n")
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        m = re.match(r"^([A-Za-z0-9_\-]+):\s*(.*)$", line)
        if not m:
            i += 1
            continue
        key, rest = m.group(1), m.group(2)
        # 块标量:收集后续缩进行
        if rest in _BLOCK_SCALARS:
            i += 1
            block: list[str] = []
            while i < n and (lines[i].startswith(" ") or lines[i].startswith("\t")):
                block.append(lines[i].lstrip(" \t"))
                i += 1
            if rest.startswith(">"):
                result[key] = " ".join(block)  # 折叠为空格
            else:
                result[key] = "\n".join(block)  # 字面换行
            continue
        # 引号包裹标量:剥除成对引号
        if len(rest) >= 2 and rest[0] == rest[-1] and rest[0] in ("'", '"'):
            result[key] = rest[1:-1]
            i += 1
            continue
        # 普通标量,支持缩进续行
        value = rest
        i += 1
        while (
            i < n
            and (lines[i].startswith(" ") or lines[i].startswith("\t"))
            and lines[i].strip()
        ):
            value += "\n" + lines[i].lstrip(" \t")
            i += 1
        result[key] = value
    return result


def parse_skill_md(content: str) -> SkillMd:
    """解析 SKILL.md 内容为 :class:`SkillMd`。

    Args:
        content: SKILL.md 文件全文。

    Returns:
        SkillMd:无 frontmatter 时 ``has_frontmatter=False`` 且 name/description
        为空、instructions 等于原文(向后兼容 ``_parse_skill_md`` 无 frontmatter 行为)。
    """
    if not content:
        return SkillMd(instructions="", has_frontmatter=False)
    m = _FRONTMATTER_RE.match(content)
    if not m:
        return SkillMd(instructions=content, has_frontmatter=False)
    fm_text, body = m.group(1), m.group(2)
    fields = _parse_frontmatter(fm_text)
    name = fields.pop("name", "").strip()
    description = fields.pop("description", "").strip()
    # 保留其余字段(metadata/allowed-tools/version/license/...)到 extra,不丢弃
    extra = {k: v for k, v in fields.items() if k not in _REQUIRED_FIELDS}
    return SkillMd(
        name=name,
        description=description,
        instructions=body.strip(),
        extra=extra,
        has_frontmatter=True,
    )


def validate_skill_md(content: str) -> list[str]:
    """校验 SKILL.md 必备字段,返回缺失项列表(如 ``["name", "description"]``)。

    空列表表示通过校验。仅检查 name/description(Anthropic 规范必需项)。
    """
    parsed = parse_skill_md(content)
    missing: list[str] = []
    if not parsed.name:
        missing.append("name")
    if not parsed.description:
        missing.append("description")
    return missing


def discover_skill_md(root_dir: str) -> list[SkillMd]:
    """只读递归扫描目录下所有 ``SKILL.md`` 并解析(用于 catalog 审计,不改写)。

    Args:
        root_dir: 待扫描根目录。

    Returns:
        按目录遍历顺序收集到的 SkillMd 列表(读取失败的文件被跳过)。
    """
    out: list[SkillMd] = []
    if not os.path.isdir(root_dir):
        return out
    for dirpath, _dirs, files in os.walk(root_dir):
        for fn in sorted(files):
            if fn != "SKILL.md":
                continue
            path = os.path.join(dirpath, fn)
            try:
                with open(path, encoding="utf-8") as f:
                    out.append(parse_skill_md(f.read()))
            except OSError:
                continue
    return out
