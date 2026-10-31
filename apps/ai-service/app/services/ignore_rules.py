# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 索引面的 ignore 规则判据(gitignore 子集,单源一把尺)。

逆向对齐目标:Qoder 把 ignore 剪枝下沉进原生层,`.node` 字面量里逐字出现
`.gitignore` / `.qoderignore` / `.aiignore` 三文件族(取证见
`docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T12-mtree-and-hook-host.md` §A)。
本仓此前**根本没有这一层**:`rg_fallback_parity` 为了两通道对账刻意给 rg 传 `--no-ignore`
(见该文件 :170 的注释),于是 `.gitignore` 里的 `build/`、`*.log` 全都进索引、也进
`render_repo_tree` 的骨架 —— 预算被构建产物吃掉,而构建产物本来就不该送去索引。

三条与对方不同的地方(超越轴,不是顺手写的):
1. **一把尺判两通道**:规则求值是一段纯函数,rg 腿与 Python 遍历腿都只能在**枚举之后**过它,
   所以"两通道对 ignore 的判断不一致"这一型在结构上不可能发生(不靠对账门事后追)。
2. **判得出出处**:每条剪枝都带回是哪枚规则文件的哪一行让它不进索引(`IgnoreRule.source` / `.line`)。
   对方原生层给的是结果不是理由,本仓要能回答"我的密钥文件为什么没进索引/为什么进了索引"。
3. **读不动要出声**:规则文件打不开/超限都进 `IgnoreSet.errors` 逐条点名(§0.3),
   绝不静默当作"没有规则"。
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_IGNORE_FILENAMES: tuple[str, ...] = (".gitignore", ".aiignore")
MAX_RULE_FILES = 64
MAX_RULES = 4000
MAX_RULE_DEPTH = 8
#: 装规则文件的目录本身要先按目录名剪掉,否则会把 node_modules 里别人家的 .gitignore 也读进来。
RULE_SCAN_PRUNE: frozenset[str] = frozenset({".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"})


@dataclass(frozen=True)
class IgnoreRule:
    raw: str
    source: str
    line: int
    regex: re.Pattern[str]
    dir_only: bool
    negated: bool

    def where(self) -> str:
        return f"{self.source}:{self.line}"


@dataclass
class IgnoreSet:
    rules: list[IgnoreRule] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def rule_files(self) -> int:
        return len({r.source for r in self.rules})


def _glob_to_regex(body: str, *, anchored: bool, dir_only: bool) -> re.Pattern[str]:
    """gitignore 语义子集 → 对"相对根 posix 路径"求值的正则。

    只支持有文档保证的那几条:`*`/`?` 不跨 `/`,`**` 跨 `/`,无斜杠的模式在任意层级匹配,
    带斜杠的模式锚定到规则文件所在目录。`dir_only` 的模式额外吃掉它整棵子树。
    """
    out: list[str] = []
    i = 0
    n = len(body)
    while i < n:
        ch = body[i]
        if ch == "*":
            if body.startswith("/**/", i):
                out.append("(?:.*/)?")
                i += 4
                continue
            if body.startswith("**", i):
                if i == 0:
                    out.append("(?:.*/)?")
                else:
                    out.append(".*")
                i += 3 if body.startswith("**/", i) else 2
                continue
            out.append("[^/]*")
            i += 1
            continue
        if ch == "?":
            out.append("[^/]")
            i += 1
            continue
        if ch == "[":
            j = i + 1
            if j < n and body[j] == "!":
                j += 1
            while j < n and body[j] != "]":
                j += 1
            if j >= n:
                out.append(re.escape(ch))
                i += 1
                continue
            cls = body[i + 1 : j]
            if not cls or cls.endswith("\\"):
                # 空集合或结尾单反斜杠会让正则当场崩(真仓里就撞上了:一条畸形规则
                # 能把整次渲染带倒)。这种写法按字面量处理,不猜它想表达什么。
                out.append(re.escape(ch))
                i += 1
                continue
            if cls.startswith("!"):
                cls = "^" + cls[1:]
            elif cls.startswith("^"):
                cls = "\\" + cls
            out.append(f"[{cls}]")
            i = j + 1
            continue
        out.append(re.escape(ch))
        i += 1
    pattern = "".join(out)
    if not anchored:
        pattern = "(?:.*/)?" + pattern
    if dir_only:
        pattern += "(?:/.*)?"
    return re.compile("^" + pattern + "$")


def parse_ignore_text(
    text: str,
    source_rel: str,
    *,
    base_dir: str = "",
    errors: list[str] | None = None,
) -> list[IgnoreRule]:
    """一枚规则文件的正文 → 规则列表(行号是文件内 1 基行号)。

    编译不过的模式**跳过并点名**,不让一条畸形规则把整次装配带崩(本仓真档实测崩过一枚)。
    """
    rules: list[IgnoreRule] = []
    prefix = base_dir.strip("/")
    for idx, raw in enumerate(text.splitlines(), start=1):
        if raw.endswith("\\ ") or raw.endswith("\\\t"):
            # 去掉的是**反斜杠**,留下的是文件名的一部分(所以切两刀再补回那个空白)。
            line = raw[:-2] + raw[-1]
        else:
            line = raw.rstrip(" \t")
        if not line or line.startswith("#"):
            continue
        negated = line.startswith("!")
        if negated:
            line = line[1:]
        dir_only = line.endswith("/")
        if dir_only:
            line = line[:-1]
        anchored = "/" in line
        if line.startswith("/"):
            line = line[1:]
        if not line:
            continue
        body = line
        if prefix:
            body = f"{prefix}/{body}" if not anchored else f"{prefix}/{body}"
            anchored = True
        try:
            regex = _glob_to_regex(body, anchored=True if prefix else anchored, dir_only=dir_only)
        except re.error as e:
            if errors is not None:
                errors.append(f"{source_rel}:{idx} 模式无法编译,本轮不生效: {str(e)[:80]}")
            continue
        rules.append(
            IgnoreRule(
                raw=raw,
                source=source_rel,
                line=idx,
                regex=regex,
                dir_only=dir_only,
                negated=negated,
            )
        )
    return rules


def load_ignore_set(
    root: Path,
    *,
    filenames: tuple[str, ...] = DEFAULT_IGNORE_FILENAMES,
    max_depth: int = MAX_RULE_DEPTH,
) -> IgnoreSet:
    """收集 root 之下(限深、跳构建目录)的规则文件。"""
    found: list[tuple[Path, str, str]] = []
    errors: list[str] = []

    def walk(rel: str, depth: int) -> None:
        if len(found) >= MAX_RULE_FILES or depth > max_depth:
            return
        current = root if not rel else root / Path(*rel.split("/"))
        try:
            entries = sorted(current.iterdir(), key=lambda p: p.name)
        except OSError as e:
            errors.append(f"规则目录读不动 {rel or '.'}: {type(e).__name__}")
            return
        dirs = [p for p in entries if p.is_dir()]
        for name in filenames:
            cand = current / name
            if cand.exists():
                if cand.is_dir():
                    errors.append(f"{(rel + '/' if rel else '') + name} 是目录而非规则文件,已跳过")
                    continue
                found.append((cand, (rel + "/" if rel else "") + name, rel))
        for p in dirs:
            if p.name in RULE_SCAN_PRUNE or p.name.startswith("."):
                continue
            walk(f"{rel + '/' if rel else ''}{p.name}", depth + 1)

    walk("", 0)
    rules: list[IgnoreRule] = []
    for path, source_rel, base_dir in found:
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            errors.append(f"规则文件读不动 {source_rel}: {type(e).__name__}")
            continue
        rules.extend(parse_ignore_text(text, source_rel, base_dir=base_dir, errors=errors))
        if len(rules) > MAX_RULES:
            errors.append(f"规则总数超过上限 {MAX_RULES},已停止收集(其余规则文件本轮不生效)")
            rules = rules[:MAX_RULES]
            break
    return IgnoreSet(rules=rules, errors=errors)


def _match(path: str, rules: list[IgnoreRule]) -> IgnoreRule | None:
    """同一批规则对一路径求值:**最后命中者胜**(gitignore 口径)。"""
    hit: IgnoreRule | None = None
    for rule in rules:
        if rule.regex.match(path):
            hit = rule
    return hit


def is_ignored(path: str, ignore: IgnoreSet, *, is_dir: bool = False) -> tuple[bool, IgnoreRule | None]:
    """路径(相对根 posix)是否被 ignore。返回 (是否剪, 判它的规则)。

    先查祖先目录:目录被 ignore 时其下任何条目都进不来,且**负向规则救不回来** ——
    这不是省事,是 gitignore 的文档语义(`docs/…` 被忽略后 `!docs/keep.md` 不生效),
    实现成"能救回来"反而是最常被重写错的一格。
    """
    parts = path.split("/")
    acc = ""
    for i in range(len(parts) - 1):
        acc = f"{acc + '/' if acc else ''}{parts[i]}"
        hit = _match(acc, ignore.rules)
        if hit is not None and not hit.negated:
            return True, hit
    hit = _match(path, ignore.rules)
    if hit is None:
        return False, None
    if hit.negated:
        return False, hit
    if is_dir and not hit.dir_only:
        # 无斜杠的文件型模式(如 *.log)不会把同名目录吃掉;目录自身不算被 ignore。
        return False, hit
    return True, hit


def filter_paths(paths: Iterable[str], ignore: IgnoreSet) -> tuple[list[str], list[tuple[str, str]]]:
    """一趟过滤:留下的 + 被剪的(带出处)。输入顺序原样保留(枚举出口已是稳定序)。"""
    kept: list[str] = []
    pruned: list[tuple[str, str]] = []
    for rel in paths:
        norm = str(rel).replace("\\", "/").strip("/")
        drop, rule = is_ignored(norm, ignore)
        if drop and rule is not None:
            pruned.append((norm, rule.where()))
            continue
        kept.append(str(rel))
    return kept, pruned


__test__ = {
    "parse_ignore_text": parse_ignore_text,
    "load_ignore_set": load_ignore_set,
    "is_ignored": is_ignored,
    "filter_paths": filter_paths,
    "_glob_to_regex": _glob_to_regex,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
