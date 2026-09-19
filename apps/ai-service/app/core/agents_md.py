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

from dataclasses import dataclass, field
from pathlib import Path

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
        except OSError:
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
