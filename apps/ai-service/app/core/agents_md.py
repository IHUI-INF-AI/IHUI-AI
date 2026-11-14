# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/agents_md.py
"""AGENTS.md 发现与项目指令装配(2026-09-19 第二十八批,对标 Codex agents_md.rs)。

模型可见的项目文档发现算法(Codex 模块级注释忠实移植):

1. **项目根定位**:从 cwd 向上逐级寻找 project_root_markers(默认
   ``[".git"]``);找不到标记则仅视 cwd 为根;**空标记列表 = 禁用向上遍历**;
2. **逐层收集**:从项目根到 cwd(含)逐目录收集 AGENTS.md,按此顺序拼接;
   **绝不越过项目根**;
3. **本地覆盖**:同目录存在 ``AGENTS.override.md`` 时优先于 ``AGENTS.md``
   (本地调优不进版本库);
4. **回退文件名**:可配置 fallback 文件名(默认空);**含路径分隔符的
   回退项直接忽略**(防路径注入式探测,Codex 同款);
5. **字节预算**:project_doc_max_bytes(默认 32 KiB)按顺序消耗,超出即停
   (低层文档优先保真,预算截断不抛错)。

返回结构含命中文件列表(审计"模型看到了哪些指令文档")与被截断标记。
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

DEFAULT_AGENTS_MD_FILENAME = "AGENTS.md"
LOCAL_AGENTS_MD_FILENAME = "AGENTS.override.md"
DEFAULT_PROJECT_DOC_MAX_BYTES = 32 * 1024
DEFAULT_PROJECT_ROOT_MARKERS: tuple[str, ...] = (".git",)
# 用户指令与项目文档的拼接分隔符(Codex AGENTS_MD_SEPARATOR 同款)
AGENTS_MD_SEPARATOR = "\n\n--- project-doc ---\n\n"


@dataclass
class LoadedAgentsMd:
    """装配结果。"""

    content: str = ""
    files: list[str] = field(default_factory=list)
    truncated: bool = False
    unread_files: list[str] = field(default_factory=list)

    def is_empty(self) -> bool:
        return not self.content.strip()

    def combine_with_user_instructions(self, user_instructions: str) -> str:
        """用户指令在前、项目文档在后(Codex 拼接语义)。"""
        if self.is_empty():
            return user_instructions
        if not user_instructions:
            return self.content
        return user_instructions + AGENTS_MD_SEPARATOR + self.content


def find_project_root(cwd: Path, markers: tuple[str, ...] = DEFAULT_PROJECT_ROOT_MARKERS) -> Path:
    """向上定位项目根;找不到标记→cwd;空标记列表→禁用遍历(仅 cwd)。"""
    cwd = Path(cwd).resolve()
    if not markers:
        return cwd
    current = cwd
    while True:
        for marker in markers:
            if (current / marker).exists():
                return current
        parent = current.parent
        if parent == current:
            return cwd  # 到达文件系统根仍未命中 → cwd 兜底
        current = parent


def _sanitize_fallback_filenames(fallback_filenames: list[str]) -> list[str]:
    """过滤非法回退文件名(含路径分隔符/绝对路径/空名直接忽略)。"""
    cleaned = []
    for name in fallback_filenames:
        if not name or not name.strip():
            continue
        if "/" in name or "\\" in name or Path(name).is_absolute():
            continue
        cleaned.append(name.strip())
    return cleaned


def collect_agents_md_candidates(
    cwd: Path,
    project_root: Path,
    fallback_filenames: list[str] | None = None,
) -> list[Path]:
    """从项目根到 cwd 逐层收集文档候选(每目录一个:override 优先)。

    返回顺序 = 拼接顺序(根 → cwd)。
    """
    fallback = _sanitize_fallback_filenames(fallback_filenames or [])
    names = [LOCAL_AGENTS_MD_FILENAME, DEFAULT_AGENTS_MD_FILENAME, *fallback]

    root = Path(project_root).resolve()
    current = Path(cwd).resolve()
    # cwd 必须在 root 之下(含相等),否则仅 cwd 一层
    chain: list[Path] = []
    node = current
    while True:
        chain.append(node)
        if node == root:
            break
        parent = node.parent
        if parent == node or not str(node).startswith(str(root)):
            chain = [current]  # cwd 不在 root 子树 → 只看 cwd
            break
        node = parent
    chain.reverse()  # 根 → cwd

    candidates: list[Path] = []
    for directory in chain:
        for name in names:
            p = directory / name
            if p.is_file():
                candidates.append(p)
                break  # 每目录只取一个(override > AGENTS.md > fallback)
    return candidates


def load_project_instructions(
    cwd: str | Path,
    *,
    project_root_markers: tuple[str, ...] = DEFAULT_PROJECT_ROOT_MARKERS,
    fallback_filenames: list[str] | None = None,
    max_bytes: int = DEFAULT_PROJECT_DOC_MAX_BYTES,
) -> LoadedAgentsMd:
    """主入口:发现 + 拼接 + 预算截断(失败静默降级,绝不阻塞)。"""
    cwd_path = Path(cwd).resolve()
    loaded = LoadedAgentsMd()
    if max_bytes <= 0:
        return loaded

    project_root = find_project_root(cwd_path, project_root_markers)
    remaining = max_bytes
    parts: list[str] = []
    for path in collect_agents_md_candidates(cwd_path, project_root, fallback_filenames):
        if remaining <= 0:
            loaded.truncated = True
            break
        try:
            raw = path.read_bytes()
        except FileNotFoundError:
            continue
        except OSError:
            loaded.unread_files.append(str(path))
            continue
        take = raw[:remaining]
        text = take.decode("utf-8", errors="replace")
        if len(raw) > remaining:
            loaded.truncated = True
        remaining -= len(take)
        parts.append(text)
        loaded.files.append(str(path))

    if parts:
        loaded.content = "\n\n".join(parts)
    return loaded


# ---------------------------------------------------------------------------
# 工作区指令链(2026-11-14 第七遍对标 DSH `dsh-agent-instructions`)
# ---------------------------------------------------------------------------
# 与上面 Codex 版 `load_project_instructions` 的关系:
#   - 上面那份 = 单一项目链(每目录只取一个文件),既有调用点与测试原样保留;
#   - 本段 = DSH 语义的项目链:同目录基名/本地覆盖叠加,同内容去重,
#     字节预算按「具体优先」分配(宽泛文件先被省略),并支持"本轮触达的更深目录"。
# 默认值的选择:
#   - 基础候选 AGENTS.md + CLAUDE.md,本地叠加 AGENTS.local.md +
#     CLAUDE.local.md(与 DSH 同名单);`AGENTS.override.md` 仍排最前
#     (既有 Codex 语义,本地调优先于版本库文件)。
#   - **不读用户级全局指令**(`~/.ihui/AGENTS.md` 一类):§6.3-4 已判定 ——
#     服务端在云端,读到的只会是服务器主目录,跨租户注入既不可达也不该越界。
# 纪律:任何读失败都只记账不抛错;空文件不占篇幅;绝不越过项目根。

DEFAULT_BASE_INSTRUCTION_FILENAMES: tuple[str, ...] = ("AGENTS.md", "CLAUDE.md")
DEFAULT_OVERLAY_INSTRUCTION_FILENAMES: tuple[str, ...] = (
    "AGENTS.local.md",
    "CLAUDE.local.md",
)
DEFAULT_WORKSPACE_INSTRUCTIONS_MAX_BYTES = 64 * 1024
WORKSPACE_INSTRUCTIONS_OPEN = "<workspace_instructions"
WORKSPACE_INSTRUCTIONS_CLOSE = "</workspace_instructions>"


def workspace_instructions_digest(text: str) -> str:
    """指令正文摘要(模型可见标记的一部分,供"这条链是否已在上下文里"判定)。"""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def render_workspace_instructions_block(text: str, *, digest: str) -> str:
    """渲染模型可见的工作区指令块(带摘要标记,便于去重/替换定位)。"""
    return (
        f'{WORKSPACE_INSTRUCTIONS_OPEN} hash="{digest}">\n'
        f"{text}\n"
        f"{WORKSPACE_INSTRUCTIONS_CLOSE}"
    )


def build_workspace_instructions_fragment(
    text: str, *, notice: str | None = None
) -> dict[str, Any]:
    """普通 / 替换片段(developer 角色:只在本次运行内可见,不回写用户可见历史)。

    notice 非空时作为首行声明(内容变更 → REPLACEMENT_NOTICE),
    与 `agents_md_state` 的 Codex 同款文案保持一字不差。
    """
    body = f"{notice}\n\n{text}" if notice else text
    return {
        "role": "developer",
        "content": render_workspace_instructions_block(
            body, digest=workspace_instructions_digest(text)
        ),
    }


def build_workspace_instructions_removal_fragment(notice: str) -> dict[str, Any]:
    """移除片段:指令链变空时告知模型先前注入的指令不再适用。"""
    return {
        "role": "developer",
        "content": (
            f'{WORKSPACE_INSTRUCTIONS_OPEN} hash="removed">\n'
            f"{notice}\n"
            f"{WORKSPACE_INSTRUCTIONS_CLOSE}"
        ),
    }


def _candidate_names(
    base_filenames: tuple[str, ...],
    overlay_filenames: tuple[str, ...],
) -> list[str]:
    """每目录候选名(有序):override 首选 → 基础候选 → 本地叠加;非法名剔除。"""
    ordered = [LOCAL_AGENTS_MD_FILENAME, *base_filenames, *overlay_filenames]
    names: list[str] = []
    for name in ordered:
        cleaned = _sanitize_fallback_filenames([name])
        if cleaned and cleaned[0] not in names:
            names.append(cleaned[0])
    return names


def _chain_dirs(target: Path, project_root: Path) -> list[Path]:
    """单个目标的祖先链(项目根 → 目标);目标不在根子树时只取目标本身。"""
    target = Path(target).resolve()
    root = Path(project_root).resolve()
    if target == root:
        return [root]
    if not str(target).startswith(str(root) + os.sep) and target != root:
        return [target]
    chain: list[Path] = []
    node = target
    while True:
        chain.append(node)
        if node == root:
            break
        parent = node.parent
        if parent == node:
            return [target]
        node = parent
    chain.reverse()
    return chain


@dataclass
class WorkspaceInstructions:
    """工作区指令链装配结果。"""

    content: str = ""
    files: list[str] = field(default_factory=list)
    truncated: bool = False
    unread_files: list[str] = field(default_factory=list)

    def is_empty(self) -> bool:
        return not self.content.strip()


def _allocate_by_specificity(
    entries: list[tuple[Path, bytes]], max_bytes: int
) -> tuple[list[str], list[str], bool]:
    """按「具体优先」分配预算,再按原顺序输出(宽泛文件先被省略)。

    entries 顺序 = 从宽泛到具体(项目根 → 目标;用户链靠前文件更宽泛)。
    预算不够时从末尾(最具体)开始保真,前面的宽泛文件整份省略;
    单个文件超出剩余预算时截断其尾部(与 DSH「最具体的文件最后被截断」同向)。
    """
    if max_bytes <= 0 or not entries:
        return [], [str(p) for p, _ in entries], bool(entries)
    allocated: dict[int, bytes] = {}
    remaining = max_bytes
    truncated = False
    for idx in range(len(entries) - 1, -1, -1):
        if remaining <= 0:
            truncated = True
            continue
        raw = entries[idx][1]
        take = raw[:remaining]
        if len(raw) > len(take):
            truncated = True
        allocated[idx] = take
        remaining -= len(take)
    parts: list[str] = []
    files: list[str] = []
    for idx, (path, _raw) in enumerate(entries):
        if idx not in allocated:
            continue
        text = allocated[idx].decode("utf-8", errors="replace")
        if not text.strip():
            continue
        parts.append(text)
        files.append(str(path))
    return parts, files, truncated


def load_workspace_instructions(
    cwd: str | Path,
    *,
    extra_dirs: list[str] | tuple[str, ...] = (),
    project_root_markers: tuple[str, ...] = DEFAULT_PROJECT_ROOT_MARKERS,
    base_filenames: tuple[str, ...] = DEFAULT_BASE_INSTRUCTION_FILENAMES,
    overlay_filenames: tuple[str, ...] = DEFAULT_OVERLAY_INSTRUCTION_FILENAMES,
    max_bytes: int = DEFAULT_WORKSPACE_INSTRUCTIONS_MAX_BYTES,
) -> WorkspaceInstructions:
    """装配工作区指令链(失败静默降级,绝不阻塞)。

    extra_dirs 是本次运行成功触达的更深目录(DSH:成功的 read/write/edit 到达
    更深目录后,下一次请求包含新适用的指令文件)。链的并集按「浅 → 深」渲染,
    同内容(去除首尾空白)只渲染一次。
    """
    result = WorkspaceInstructions()
    if max_bytes <= 0:
        return result

    try:
        cwd_path = Path(cwd).expanduser().resolve()
    except OSError:
        return result

    project_root = find_project_root(cwd_path, project_root_markers)
    names = _candidate_names(base_filenames, overlay_filenames)
    ordered_dirs: list[Path] = []
    targets = [cwd_path, *[Path(d).expanduser() for d in extra_dirs if str(d).strip()]]
    for target in targets:
        try:
            target_resolved = target.resolve()
        except OSError:
            continue
        for directory in _chain_dirs(target_resolved, project_root):
            if directory not in ordered_dirs:
                ordered_dirs.append(directory)
    ordered_dirs.sort(key=lambda p: (len(p.parts), str(p)))

    entries: list[tuple[Path, bytes]] = []
    seen_content: set[str] = set()
    for directory in ordered_dirs:
        for name in names:
            path = directory / name
            if not path.is_file():
                continue
            try:
                raw = path.read_bytes()
            except OSError:
                result.unread_files.append(str(path))
                continue
            if not raw.strip():
                continue
            fingerprint = raw.decode("utf-8", errors="replace").strip()
            if fingerprint in seen_content:
                continue
            seen_content.add(fingerprint)
            entries.append((path, raw))
    parts, files, truncated = _allocate_by_specificity(entries, max_bytes)
    result.content = "\n\n".join(parts)
    result.files.extend(files)
    result.truncated = truncated
    return result

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
