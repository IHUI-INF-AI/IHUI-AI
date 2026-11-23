# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""项目规则加载与选择(2026-11-24,Cursor `.cursor/rules/*.mdc` 等价实现)。

## 对照的是什么(Cursor 3.27.22 实读,取证见 `.ihui-agent/tmp/r12`)

Cursor 的项目规则是 `.cursor/rules/` 下的 `.mdc` 文件,YAML frontmatter 三个字段:
`description`(规则说明)、`globs`(路径模式,文件命中时才附加)、`alwaysApply`(true 则每会话附加)。
证据:本机 `~/.cursor/skills-cursor/create-rule/SKILL.md` 第 39-99 行逐字给出该格式与两种配置。

## 为什么本仓需要它(而不是已有能力)

`app/core/agents_md.py` 只处理**整仓级**指令链(AGENTS.override.md > AGENTS.md/CLAUDE.md > *.local.md),
没有「按路径命中才附加」这一层。缺这一层时,子目录约定只能全量塞进 system,既撑爆预算又让
不相关规则互相打架。本模块补的正是这一层。

## 三条硬约束(失效方向恒为"多拒一条 + 点名原因",绝不静默)

1. 解析失败 / 缺 frontmatter / 正文超长 ⇒ **排除并写原因**,不猜测、不截断冒充完整。
2. 预算超限 ⇒ 逐条点名 `budget_exceeded`,不静默丢弃、不把后面的规则挤到看不见。
3. 只读工作区内 `.ihui/rules` 与 `.cursor/rules`,跳过符号链接与越界路径;不跟随链接读宿主文件。

## 超越对照的轴

- 每条被排除的规则都带**机器可读原因**(对照侧只是一个 picker,不告诉模型"为什么少了一条")。
- 同一正文在多目录重复时按优先级去重并点名 `duplicate_body`(对照侧会重复注入)。
- 预算按**渲染后字节**精确记账(UTF-8),并把 `used_chars/budget_chars` 回传给调用方。
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# 规则目录:本仓自有优先,其次兼容 Cursor 目录(同一正文只留优先级高的一份)
RULES_DIRS: tuple[str, ...] = (".ihui/rules", ".cursor/rules")

# 只认这两种后缀(Cursor 用 .mdc;允许 .md 便于把既有文档直接搬进来)
RULE_SUFFIXES: tuple[str, ...] = (".mdc", ".md")

# 单文件读取上限(字节):超过即拒绝(防误把大文档丢进 rules 目录)
MAX_RULE_BYTES = 16_384
# 单条正文上限(字符):Cursor 官方建议 <50 行;超过拒绝而非截断
MAX_RULE_BODY_CHARS = 2_000
# 扫描上限:防止目录里塞几千个文件拖垮线程启动
MAX_RULES_SCANNED = 128
# 默认预算(渲染后字符):一次注入最多 8KB,超出逐条点名
DEFAULT_BUDGET_CHARS = 8_000

# 用户级规则目录(2026-11-24 第二档,对齐 Cursor User Rules):
# 与工作区无关、对本机所有项目生效;路径固定,不接受任意目录(防被环境变量引到宿主敏感目录)。
USER_RULE_DIRS: tuple[str, ...] = ("~/.ihui/rules", "~/.cursor/rules")
# 覆盖用户级规则目录(os.pathsep 分隔;测试/多机用),仍逐条过符号链接与越界判据。
USER_RULE_DIRS_ENV = "IHUI_USER_RULES_DIRS"
# 一键关闭用户级规则(只留项目级)。
USER_RULES_DISABLE_ENV = "IHUI_USER_RULES_DISABLE"

BLOCK_HEADER = "[项目规则]"
BLOCK_NOTE = "(以下规则由路径/alwaysApply 自动附加,不是用户本轮输入)"
CATALOG_HEADER = "[项目规则·可请求]"
CATALOG_NOTE = "(Agent Requested:正文不在本轮上下文里;需要时用 read_project_rule 按 locator 取回)"


_TRUE = {"true", "yes", "on", "1"}
_FALSE = {"false", "no", "off", "0"}


class RuleParseError(ValueError):
    """frontmatter 不可解析。reason 是机器可读短码,line 用于人定位。"""

    def __init__(self, reason: str, line: int | None = None) -> None:
        super().__init__(reason if line is None else f"{reason}@line{line}")
        self.reason = reason
        self.line = line


@dataclass(frozen=True)
class ParsedRule:
    description: str
    globs: tuple[str, ...]
    always_apply: bool

    def as_dict(self) -> dict[str, object]:
        return {
            "description": self.description,
            "globs": list(self.globs),
            "alwaysApply": self.always_apply,
        }


@dataclass(frozen=True)
class RuleFile:
    """一条候选规则(project: rel_path 相对工作区;user: rel_path 即 locator 的尾段)。"""

    rel_path: str
    source_dir: str
    description: str
    globs: tuple[str, ...]
    always_apply: bool
    body: str
    scope: str = "project"  # project | user
    locator: str = ""

    @property
    def label(self) -> str:
        return self.locator or self.rel_path


@dataclass(frozen=True)
class AgentRule:
    """Agent Requested 档:只给模型目录(description + locator),正文按需取。"""

    locator: str
    description: str


@dataclass(frozen=True)
class LoadedRule:
    """read_project_rule 取回的单条规则(含出处,便于审计)。"""

    locator: str
    description: str
    body: str
    globs: tuple[str, ...]
    always_apply: bool
    scope: str


class RuleLookupError(ValueError):
    """按 locator 取规则失败。code 机器可读,不接受"取不到就空串"。"""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class ExcludedRule:
    """被排除的规则:原因必须机器可读,调用方据此解释"为什么少了一条"。"""

    rel_path: str
    reason: str


@dataclass(frozen=True)
class SelectedRule:
    rel_path: str
    description: str
    body: str
    matched_paths: tuple[str, ...]
    reason: str  # always | glob


@dataclass(frozen=True)
class RulesSelection:
    selected: tuple[SelectedRule, ...]
    excluded: tuple[ExcludedRule, ...]
    budget_chars: int
    used_chars: int
    truncated: bool
    agent_requested: tuple[AgentRule, ...] = ()

    def is_empty(self) -> bool:
        return not self.selected and not self.agent_requested


def parse_frontmatter(text: str) -> tuple[ParsedRule, str]:
    """解析 `.mdc` 的 YAML 子集 frontmatter,返回 (元数据, 正文)。

    只支持 required 三个字段与它们的常见写法(字符串/引号/方括号/短横线列表)。
    未知键**不拒**(前向兼容),但不参与判据 —— 这一档与本仓「不猜」纪律一致:
    不认识的键不能悄悄改变附加语义。
    """
    body_text = text.lstrip("\ufeff")
    lines = body_text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise RuleParseError("missing_frontmatter")
    closing: int | None = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() in {"---", "..."}:
            closing = idx
            break
    if closing is None:
        raise RuleParseError("frontmatter_unterminated")

    meta: dict[str, object] = {}
    unknown: list[str] = []
    idx = 1
    while idx < closing:
        raw = lines[idx]
        stripped = raw.strip()
        idx += 1
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("- "):
            raise RuleParseError("list_item_without_key", idx)
        if ":" not in stripped:
            raise RuleParseError("unexpected_line", idx)
        key, _, value = stripped.partition(":")
        key_norm = key.strip()
        value_text = value.strip()
        if key_norm in {"description", "globs", "alwaysApply", "always_apply"}:
            if value_text in {">", ">-", "|", "|-"}:
                folded: list[str] = []
                while idx < closing:
                    nxt = lines[idx]
                    if nxt.strip() == "":
                        folded.append("")
                        idx += 1
                        continue
                    if not (nxt.startswith(" ") or nxt.startswith("\t")):
                        break
                    folded.append(nxt.strip())
                    idx += 1
                sep = "\n" if value_text.startswith("|") else " "
                meta[key_norm] = sep.join(folded).strip()
                continue
            if value_text == "" and key_norm == "globs":
                # globs 允许写成后续 - item 列表
                items: list[str] = []
                while idx < closing:
                    nxt = lines[idx].strip()
                    if nxt.startswith("- "):
                        items.append(_unquote(nxt[2:].strip()))
                        idx += 1
                        continue
                    break
                meta["globs"] = items
                continue
            meta[key_norm] = _unquote(value_text)
        else:
            unknown.append(key_norm)

    description = str(meta.get("description") or "").strip()
    always_raw = meta.get("alwaysApply", meta.get("always_apply"))
    always_apply = _parse_bool(always_raw) if always_raw is not None else False
    globs = _parse_globs(meta.get("globs"))
    body = "\n".join(lines[closing + 1 :]).strip("\n").strip()
    parsed = ParsedRule(description=description, globs=globs, always_apply=always_apply)
    if unknown:
        logger.debug("project_rules: 未知 frontmatter 键被忽略: %s", sorted(set(unknown)))
    return parsed, body


def _parse_bool(raw: object) -> bool:
    text = str(raw).strip().lower()
    if text in _TRUE:
        return True
    if text in _FALSE:
        return False
    raise RuleParseError("invalid_alwaysApply")


def _unquote(text: str) -> str:
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {"'", '"'}:
        return text[1:-1]
    return text


def _parse_globs(raw: object) -> tuple[str, ...]:
    if raw is None:
        return ()
    if isinstance(raw, (list, tuple)):
        items = [str(x).strip() for x in raw]
    else:
        text = str(raw).strip()
        if text == "":
            return ()
        if text.startswith("[") and text.endswith("]"):
            inner = text[1:-1].strip()
            items = [_unquote(part.strip()) for part in _split_top_level(inner)]
        else:
            items = [_unquote(part.strip()) for part in re.split(r"[,\s]+", text)]
    out: list[str] = []
    for item in items:
        if not item:
            continue
        if item not in out:
            out.append(item)
    return tuple(out)


def _split_top_level(text: str) -> list[str]:
    """按逗号切分方括号内联列表,尊重引号;不处理嵌套(规则文件里不会出现)。"""
    parts: list[str] = []
    buf: str = ""
    quote: str | None = None
    for ch in text:
        if quote:
            buf += ch
            if ch == quote:
                quote = None
            continue
        if ch in {"'", '"'}:
            quote = ch
            buf += ch
            continue
        if ch == ",":
            parts.append(buf)
            buf = ""
            continue
        buf += ch
    parts.append(buf)
    return parts


def normalize_rel_path(path: str) -> str | None:
    """把路径归一成工作区相对形式(正斜杠)。越界/非法返回 None(不猜)。"""
    text = str(path or "").strip()
    if not text:
        return None
    text = text.replace("\\", "/")
    if text.startswith("./"):
        text = text[2:]
    if text.startswith("/") or text.startswith("~"):
        return None
    if re.match(r"^[A-Za-z]:", text):
        return None
    parts = [p for p in text.split("/") if p not in {"", "."}]
    if any(p == ".." for p in parts):
        return None
    return "/".join(parts)


def _glob_to_regex(pattern: str) -> re.Pattern[str]:
    """gitignore 风格 glob → 正则(支持 `**` / `*` / `?` / `{a,b}` / `[abc]`)。"""
    pat = pattern.strip().replace("\\", "/")
    if pat.startswith("./"):
        pat = pat[2:]
    anchored = pat.startswith("/")
    if anchored:
        pat = pat[1:]
    directory = pat.endswith("/")
    if directory:
        pat = pat[:-1]
    regex_parts: list[str] = []
    i = 0
    while i < len(pat):
        ch = pat[i]
        if ch == "*":
            if pat.startswith("**", i):
                if pat.startswith("**/", i):
                    regex_parts.append(r"(?:[^/]+/)*")
                    i += 3
                    continue
                regex_parts.append(r".*")
                i += 2
                continue
            regex_parts.append(r"[^/]*")
            i += 1
            continue
        if ch == "?":
            regex_parts.append(r"[^/]")
            i += 1
            continue
        if ch == "{":
            close = pat.find("}", i + 1)
            if close > i:
                inner = pat[i + 1 : close]
                alternatives = "|".join(re.escape(x) for x in inner.split(","))
                regex_parts.append(f"(?:{alternatives})")
                i = close + 1
                continue
        if ch == "[":
            close = pat.find("]", i + 1)
            if close > i:
                inner = pat[i + 1 : close]
                if inner.startswith("!"):
                    inner = "^" + inner[1:]
                regex_parts.append("[" + inner + "]")
                i = close + 1
                continue
        regex_parts.append(re.escape(ch))
        i += 1
    body = "".join(regex_parts)
    if directory:
        body = body + r"(?:/.*)?"
    prefix = "^" if anchored or "/" in pat or pat.startswith("**") else r"^(?:.*/)?"
    return re.compile(prefix + body + "$")


_GLOB_CACHE: dict[str, re.Pattern[str]] = {}


def match_glob(pattern: str, path: str) -> bool:
    """单条 glob 是否命中工作区相对路径(大小写敏感,与 Linux/CI 行为一致)。"""
    rel = normalize_rel_path(path)
    if rel is None:
        return False
    cached = _GLOB_CACHE.get(pattern)
    if cached is None:
        if len(_GLOB_CACHE) >= 512:
            _GLOB_CACHE.clear()
        cached = _glob_to_regex(pattern)
        _GLOB_CACHE[pattern] = cached
    return bool(cached.match(rel))


def rule_matches(globs: Sequence[str], path: str) -> bool:
    """一条规则的多个 glob:正向任一命中 + 否定(`!`)任一命中即整体排除(后者优先)。"""
    positives = [g for g in globs if not g.startswith("!")]
    negatives = [g[1:] for g in globs if g.startswith("!")]
    if not positives:
        return False
    if not any(match_glob(g, path) for g in positives):
        return False
    return not any(match_glob(g, path) for g in negatives)


def _parse_rule_path(
    path: Path,
    root: Path,
    *,
    scope: str,
    source_dir: str,
    locator_prefix: str,
) -> tuple[RuleFile | None, str | None]:
    """读一条规则;返回 (规则, 排除原因)。读不出/超限/解析失败都走原因,绝不吞。"""
    try:
        if path.is_symlink():
            return None, "symlink_skipped"
        size = path.stat().st_size
        if size > MAX_RULE_BYTES:
            return None, "too_large"
        raw = path.read_bytes()
    except OSError:
        return None, "read_error"
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None, "decode_error"
    try:
        meta, body = parse_frontmatter(text)
    except RuleParseError as exc:
        return None, f"invalid_frontmatter:{exc.reason}"
    if not body.strip():
        return None, "empty_body"
    if len(body) > MAX_RULE_BODY_CHARS:
        return None, "body_too_long"
    try:
        rel = path.relative_to(root).as_posix()
    except ValueError:
        return None, "outside_workspace"
    locator = rel if scope == "project" else f"{locator_prefix}:{rel}"
    return (
        RuleFile(
            rel_path=rel,
            source_dir=source_dir,
            description=meta.description,
            globs=meta.globs,
            always_apply=meta.always_apply,
            body=body,
            scope=scope,
            locator=locator,
        ),
        None,
    )


def _user_rule_roots() -> list[tuple[str, Path]]:
    """解析用户级规则目录;每条都过存在性判据,标签稳定且唯一。"""
    if os.environ.get(USER_RULES_DISABLE_ENV, "").strip().lower() in _TRUE:
        return []
    raw = os.environ.get(USER_RULE_DIRS_ENV, "").strip()
    candidates = raw.split(os.pathsep) if raw else list(USER_RULE_DIRS)
    roots: list[tuple[str, Path]] = []
    seen: set[str] = set()
    for candidate in candidates:
        text = candidate.strip()
        if not text:
            continue
        path = Path(text).expanduser()
        try:
            path = path.resolve(strict=False)
        except OSError:
            continue
        if not path.is_dir():
            continue
        parent = path.parent.name or "root"
        label = f"user:{parent}/{path.name}"
        if label in seen:
            index = 2
            while f"{label}#{index}" in seen:
                index += 1
            label = f"{label}#{index}"
        seen.add(label)
        roots.append((label, path))
    return roots


def discover_rules(
    workspace: str | os.PathLike[str], *, include_user: bool = True
) -> tuple[list[RuleFile], list[ExcludedRule]]:
    """扫描项目级 + 用户级规则目录:返回 (可用规则, 被排除规则)。顺序确定,不跟随链接。"""
    root = Path(workspace).expanduser()
    try:
        root = root.resolve(strict=False)
    except OSError:
        return [], []
    if not root.is_dir():
        return [], []
    rules: list[RuleFile] = []
    excluded: list[ExcludedRule] = []
    scanned = 0
    for dir_name in RULES_DIRS:
        directory = root / dir_name
        if not directory.is_dir():
            continue
        try:
            entries = sorted(directory.iterdir(), key=lambda p: p.name)
        except OSError:
            excluded.append(ExcludedRule(rel_path=dir_name, reason="read_error"))
            continue
        for entry in entries:
            if scanned >= MAX_RULES_SCANNED:
                excluded.append(ExcludedRule(rel_path=dir_name, reason="scan_limit_reached"))
                break
            if entry.is_dir():
                continue
            if entry.suffix.lower() not in RULE_SUFFIXES:
                continue
            scanned += 1
            rule, reason = _parse_rule_path(
                entry,
                root,
                scope="project",
                source_dir=dir_name,
                locator_prefix="",
            )
            if rule is not None:
                rules.append(rule)
            elif reason is not None:
                try:
                    rel = entry.relative_to(root).as_posix()
                except ValueError:
                    rel = entry.name
                excluded.append(ExcludedRule(rel_path=rel, reason=reason))
    if include_user:
        for label, directory in _user_rule_roots():
            try:
                entries = sorted(directory.iterdir(), key=lambda p: p.name)
            except OSError:
                excluded.append(ExcludedRule(rel_path=label, reason="read_error"))
                continue
            for entry in entries:
                if scanned >= MAX_RULES_SCANNED:
                    excluded.append(ExcludedRule(rel_path=label, reason="scan_limit_reached"))
                    break
                if entry.is_dir() or entry.suffix.lower() not in RULE_SUFFIXES:
                    continue
                scanned += 1
                rule, reason = _parse_rule_path(
                    entry,
                    directory,
                    scope="user",
                    source_dir=label,
                    locator_prefix=label,
                )
                if rule is not None:
                    rules.append(rule)
                elif reason is not None:
                    excluded.append(ExcludedRule(rel_path=f"{label}/{entry.name}", reason=reason))
    return rules, excluded



def _render_one(rule: SelectedRule) -> str:
    title = rule.description or rule.rel_path
    return f"## {title} ({rule.rel_path})\n{rule.body}"


def _render_catalog_one(rule: AgentRule) -> str:
    return f"- {rule.description} ({rule.locator})"


def select_rules(
    workspace: str | os.PathLike[str],
    target_paths: Sequence[str] | None = None,
    *,
    budget_chars: int = DEFAULT_BUDGET_CHARS,
) -> RulesSelection:
    """按 alwaysApply / globs / Agent Requested 选出规则,并做预算截断(逐条点名)。

    - alwaysApply ⇒ 每会话附加;
    - 有 globs ⇒ 目标路径命中才附加;
    - 只有 description、没有 globs ⇒ 进"可请求目录",正文由 read_project_rule 按需取回。
    """
    rules, excluded_list = discover_rules(workspace)
    excluded = list(excluded_list)
    normalized_targets: list[str] = []
    for raw in target_paths or ():
        rel = normalize_rel_path(raw)
        if rel is None:
            excluded.append(ExcludedRule(rel_path=str(raw), reason="invalid_target_path"))
            continue
        normalized_targets.append(rel)

    selected: list[SelectedRule] = []
    agent_requested: list[AgentRule] = []
    seen_body: dict[str, str] = {}
    for rule in rules:
        digest = hashlib.sha256(rule.body.encode("utf-8")).hexdigest()
        if digest in seen_body:
            excluded.append(ExcludedRule(rel_path=rule.label, reason="duplicate_body"))
            continue
        if rule.always_apply:
            seen_body[digest] = rule.label
            selected.append(
                SelectedRule(
                    rel_path=rule.label,
                    description=rule.description,
                    body=rule.body,
                    matched_paths=(),
                    reason="always",
                )
            )
            continue
        if rule.globs:
            if not normalized_targets:
                excluded.append(ExcludedRule(rel_path=rule.label, reason="no_match"))
                continue
            matched = tuple(p for p in normalized_targets if rule_matches(rule.globs, p))
            if not matched:
                excluded.append(ExcludedRule(rel_path=rule.label, reason="no_match"))
                continue
            seen_body[digest] = rule.label
            selected.append(
                SelectedRule(
                    rel_path=rule.label,
                    description=rule.description,
                    body=rule.body,
                    matched_paths=matched,
                    reason="glob",
                )
            )
            continue
        if rule.description:
            seen_body[digest] = rule.label
            agent_requested.append(AgentRule(locator=rule.label, description=rule.description))
            continue
        excluded.append(ExcludedRule(rel_path=rule.label, reason="no_match"))

    budget = max(0, int(budget_chars))
    kept: list[SelectedRule] = []
    kept_catalog: list[AgentRule] = []
    used = 0
    truncated = False
    for chosen in selected:
        rendered = _render_one(chosen)
        cost = len(rendered)
        if used + cost > budget:
            excluded.append(ExcludedRule(rel_path=chosen.rel_path, reason="budget_exceeded"))
            truncated = True
            continue
        kept.append(chosen)
        used += cost
    for agent in agent_requested:
        cost = len(_render_catalog_one(agent))
        if used + cost > budget:
            excluded.append(ExcludedRule(rel_path=agent.locator, reason="budget_exceeded"))
            truncated = True
            continue
        kept_catalog.append(agent)
        used += cost
    return RulesSelection(
        selected=tuple(kept),
        excluded=tuple(excluded),
        budget_chars=budget,
        used_chars=used,
        truncated=truncated,
        agent_requested=tuple(kept_catalog),
    )


def render_rules_block(selection: RulesSelection, *, include_catalog: bool = True) -> str | None:
    """把选择结果渲染成注入块;无规则返回 None(调用方据此零行为变化)。"""
    if selection.is_empty():
        return None
    parts = [f"{BLOCK_HEADER} {BLOCK_NOTE}"]
    parts.extend(_render_one(rule) for rule in selection.selected)
    if include_catalog and selection.agent_requested:
        parts.append(f"{CATALOG_HEADER} {CATALOG_NOTE}")
        parts.extend(_render_catalog_one(rule) for rule in selection.agent_requested)
    if len(parts) == 1:
        return None
    return "\n\n".join(parts)


def load_always_apply_rules_block(
    workspace: str | os.PathLike[str],
    *,
    budget_chars: int = DEFAULT_BUDGET_CHARS,
) -> str | None:
    """线程启动档(旧档):只渲染 alwaysApply 正文,不附可请求目录。"""
    selection = select_rules(workspace, None, budget_chars=budget_chars)
    return render_rules_block(selection, include_catalog=False)


def load_project_rules_block(
    workspace: str | os.PathLike[str],
    *,
    budget_chars: int = DEFAULT_BUDGET_CHARS,
) -> str | None:
    """线程启动档(新档):alwaysApply 正文 + Agent Requested 目录(无规则返回 None)。"""
    selection = select_rules(workspace, None, budget_chars=budget_chars)
    return render_rules_block(selection)


def load_applicable_rules_block(
    workspace: str | os.PathLike[str],
    target_paths: Iterable[str],
    *,
    budget_chars: int = DEFAULT_BUDGET_CHARS,
) -> str | None:
    """按目标文件档:alwaysApply + globs 命中,只渲染正文(不附目录)。"""
    selection = select_rules(workspace, list(target_paths), budget_chars=budget_chars)
    return render_rules_block(selection, include_catalog=False)


def _loaded_from(rule: RuleFile) -> LoadedRule:
    return LoadedRule(
        locator=rule.label,
        description=rule.description,
        body=rule.body,
        globs=rule.globs,
        always_apply=rule.always_apply,
        scope=rule.scope,
    )


def _load_at(
    path: Path,
    root: Path,
    *,
    locator_prefix: str,
    scope: str,
    source_dir: str,
) -> LoadedRule:
    rule, reason = _parse_rule_path(
        path,
        root,
        scope=scope,
        source_dir=source_dir,
        locator_prefix=locator_prefix,
    )
    if rule is None:
        raise RuleLookupError(reason or "read_error")
    return _loaded_from(rule)


def read_rule_body(workspace: str | os.PathLike[str], locator: str) -> LoadedRule:
    """按 locator 取单条规则正文(Agent Requested 的消费口)。

    安全判据与发现档一字不差:拒符号链接、拒越界、拒超限、拒坏 frontmatter。
    取不到一律抛 RuleLookupError(code),**不返回空串**冒充"规则就是空的"。
    """
    text = str(locator or "").strip()
    if not text:
        raise RuleLookupError("missing_locator")
    if text.startswith("user:"):
        roots = _user_rule_roots()
        matches = [(label, path) for label, path in roots if text.startswith(label + ":")]
        if not matches:
            raise RuleLookupError("unknown_user_root")
        label, directory = max(matches, key=lambda item: len(item[0]))
        rel = text[len(label) + 1 :]
        if not rel or rel.startswith("/") or ".." in rel.split("/"):
            raise RuleLookupError("invalid_locator")
        path = directory / rel
        try:
            if path.is_symlink():
                raise RuleLookupError("symlink_skipped")
            resolved = path.resolve(strict=True)
            resolved.relative_to(directory)
        except RuleLookupError:
            raise
        except (OSError, ValueError):
            raise RuleLookupError("read_error") from None
        if not resolved.is_file():
            raise RuleLookupError("read_error")
        return _load_at(
            resolved,
            directory,
            locator_prefix=label,
            scope="user",
            source_dir=label,
        )

    project_rel = normalize_rel_path(text)
    if project_rel is None:
        raise RuleLookupError("invalid_locator")
    source_dir = next((d for d in RULES_DIRS if project_rel.startswith(d + "/")), "")
    if source_dir == "":
        raise RuleLookupError("unknown_locator")
    root = Path(workspace).expanduser()
    try:
        root = root.resolve(strict=True)
    except OSError:
        raise RuleLookupError("workspace_missing") from None
    path = root / project_rel
    try:
        if path.is_symlink():
            raise RuleLookupError("symlink_skipped")
        resolved = path.resolve(strict=True)
        resolved.relative_to(root)
    except RuleLookupError:
        raise
    except (OSError, ValueError):
        raise RuleLookupError("read_error") from None
    if not resolved.is_file():
        raise RuleLookupError("read_error")
    return _load_at(
        resolved,
        root,
        locator_prefix="",
        scope="project",
        source_dir=source_dir,
    )

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
