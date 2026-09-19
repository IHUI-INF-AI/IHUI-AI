# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/turn_diff_tracker.py
"""回合净 diff 跟踪器(2026-09-19 第二十七批,对标 Codex turn_diff_tracker.rs)。

从本回合已提交的补丁变更(add/delete/update+move)在**内存中**累计净文本 diff,
不回读文件系统;非精确变更(inexact delta)立即整体失效(Codex invalidate 语义,
宁可不给 diff 也不给错误 diff)。要点:

- **基线捕获**:首次触碰某路径时,以补丁携带的旧内容/被覆盖内容作为基线,
  使"回合中途新建后又删除"等操作序列仍能得到正确的净 diff;
- **移动/改名成对**:origin 映射把 update(move_path) 建成 (旧路径→新路径)
  rename 对,渲染为单个 `diff --git a/old b/new`,而非 删+增 两个文件;
- **revision 缓存**:每次内容变更递增全局 revision,渲染结果按
  (左路径,左版本,右路径,右版本) 缓存,重复刷新零成本;
- **git 形态输出**:`diff --git`/`new file mode 100644`/`index <oid>..<oid>`,
  oid 为真实 git blob SHA-1(与 `git hash-object` 一致),路径统一 `/`。
"""

from __future__ import annotations

import difflib
import hashlib
import time
from dataclasses import dataclass, field
from typing import Optional

ZERO_OID = "0" * 40
DEV_NULL = "/dev/null"
REGULAR_FILE_MODE = "100644"
# 渲染超时无法像 similar 那样精确实现,用"超大输入跳过行级 diff"兜底,
# 防病态输入阻塞工具完成(语义对标 DIFF_TIMEOUT 100ms 的降级路径)。
_DIFF_MAX_LINES = 20000


@dataclass(frozen=True)
class TrackedPath:
    environment_id: str
    path: str


@dataclass
class TrackedContent:
    content: str
    revision: int


@dataclass
class FileChange:
    """一次补丁文件变更(exact)。

    kind: "add" | "delete" | "update"
    content: add 的新内容 / delete 的被删内容 / update 的新内容
    overwritten_content: add 覆盖掉的旧内容(可空)
    old_content: update 的旧内容(可空)
    move_path: update 的目标路径(改名/移动时可空)
    overwritten_move_content: 移动覆盖掉的旧内容(可空)
    """

    kind: str
    path: str
    content: str = ""
    overwritten_content: Optional[str] = None
    old_content: Optional[str] = None
    move_path: Optional[str] = None
    overwritten_move_content: Optional[str] = None


@dataclass
class PatchDelta:
    """一次补丁提交的变更集;exact=False 触发整体失效。"""

    environment_id: str
    changes: list[FileChange] = field(default_factory=list)
    exact: bool = True


def git_blob_oid(content: str) -> str:
    data = content.encode("utf-8")
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


class TurnDiffTracker:
    """回合净 diff 状态机(线程兼容:由调用方保证单线程使用,同 Codex)。"""

    def __init__(self, display_roots: Optional[dict[str, str]] = None) -> None:
        self._valid = True
        self._display_roots: dict[str, str] = dict(display_roots or {})
        self._baseline: dict[TrackedPath, TrackedContent] = {}
        self._current: dict[TrackedPath, TrackedContent] = {}
        self._origin_by_current: dict[TrackedPath, TrackedPath] = {}
        self._next_revision = 0
        self._rendered_cache: dict[tuple[TrackedPath, Optional[int], TrackedPath, Optional[int]], Optional[str]] = {}
        self._unified_diff: Optional[str] = None

    # ------------------------------------------------------------------
    def track_delta(self, delta: PatchDelta) -> None:
        if not self._valid:
            return
        if not delta.exact:
            self.invalidate()
            return
        for change in delta.changes:
            self._apply_change(delta.environment_id, change)
        self._refresh_unified_diff()

    def invalidate(self) -> None:
        self._valid = False
        self._rendered_cache.clear()
        self._unified_diff = None

    @property
    def valid(self) -> bool:
        return self._valid

    def get_unified_diff(self) -> Optional[str]:
        return self._unified_diff

    def has_unified_diff(self) -> bool:
        return self._unified_diff is not None

    # ------------------------------------------------------------------
    def _tracked(self, content: str) -> TrackedContent:
        rev = self._next_revision
        self._next_revision += 1
        return TrackedContent(content=content, revision=rev)

    def _apply_change(self, environment_id: str, change: FileChange) -> None:
        src = TrackedPath(environment_id, change.path)
        if change.kind == "add":
            self._apply_add(src, change)
        elif change.kind == "delete":
            self._apply_delete(src, change)
        elif change.kind == "update":
            self._apply_update(src, change)
        else:  # 未知类型按 inexact 处理
            self.invalidate()

    def _apply_add(self, path: TrackedPath, change: FileChange) -> None:
        self._origin_by_current.pop(path, None)
        if (
            path not in self._current
            and path not in self._baseline
            and change.overwritten_content is not None
        ):
            self._baseline[path] = self._tracked(change.overwritten_content)
        self._current[path] = self._tracked(change.content)

    def _apply_delete(self, path: TrackedPath, change: FileChange) -> None:
        existed = self._current.pop(path, None) is not None
        if not existed and path not in self._baseline:
            self._baseline[path] = self._tracked(change.content)
        self._origin_by_current.pop(path, None)

    def _apply_update(self, src: TrackedPath, change: FileChange) -> None:
        if src not in self._current and src not in self._baseline:
            self._baseline[src] = self._tracked(change.old_content or "")

        dest = TrackedPath(src.environment_id, change.move_path) if change.move_path else None
        if dest is None:
            self._current[src] = self._tracked(change.content)
            return
        if (
            dest not in self._current
            and dest not in self._baseline
            and change.overwritten_move_content is not None
        ):
            self._baseline[dest] = self._tracked(change.overwritten_move_content)
        origin = self._origin_by_current.pop(src, src)
        self._current.pop(src, None)
        self._current[dest] = self._tracked(change.content)
        self._origin_by_current.pop(dest, None)
        if dest != origin:
            self._origin_by_current[dest] = origin

    # ------------------------------------------------------------------
    def _rename_pairs(self) -> dict[TrackedPath, TrackedPath]:
        pairs: dict[TrackedPath, TrackedPath] = {}
        for dest, origin in self._origin_by_current.items():
            if (
                dest == origin
                or origin in self._current
                or dest not in self._current
                or origin not in self._baseline
                or dest in self._baseline
            ):
                continue
            pairs[origin] = dest
        return pairs

    def _refresh_unified_diff(self) -> None:
        rename_pairs = self._rename_pairs()
        paired_destinations = set(rename_pairs.values())
        handled: set[TrackedPath] = set()
        paths = sorted(
            set(self._baseline) | set(self._current), key=self._display_path
        )

        previous = self._rendered_cache
        rendered_cache: dict[tuple[TrackedPath, Optional[int], TrackedPath, Optional[int]], Optional[str]] = {}
        aggregated: list[str] = []
        for path in paths:
            if path in handled or path in paired_destinations:
                continue
            dest = rename_pairs.get(path)
            if dest is not None:
                handled.add(dest)
                left_path, right_path = path, dest
            else:
                left_path, right_path = path, path
            handled.add(path)

            left = self._baseline.get(left_path)
            right = self._current.get(right_path)
            key = (
                left_path,
                left.revision if left else None,
                right_path,
                right.revision if right else None,
            )
            if key in previous:
                rendered = previous[key]
            else:
                rendered = self._render_diff(
                    left_path,
                    left.content if left else None,
                    right_path,
                    right.content if right else None,
                )
            if rendered:
                aggregated.append(rendered if rendered.endswith("\n") else rendered + "\n")
            rendered_cache[key] = rendered

        self._rendered_cache = rendered_cache
        joined = "".join(aggregated)
        self._unified_diff = joined if joined else None

    def _render_diff(
        self,
        left_path: TrackedPath,
        left_content: Optional[str],
        right_path: TrackedPath,
        right_content: Optional[str],
    ) -> Optional[str]:
        if left_content == right_content:
            return None
        left_display = self._display_path(left_path).replace("\\", "/")
        right_display = self._display_path(right_path).replace("\\", "/")
        left_oid = git_blob_oid(left_content) if left_content is not None else ZERO_OID
        right_oid = git_blob_oid(right_content) if right_content is not None else ZERO_OID

        diff = f"diff --git a/{left_display} b/{right_display}\n"
        if left_content is None and right_content is not None:
            diff += f"new file mode {REGULAR_FILE_MODE}\n"
        elif left_content is not None and right_content is None:
            diff += f"deleted file mode {REGULAR_FILE_MODE}\n"
        elif left_content is None and right_content is None:
            return None
        diff += f"index {left_oid}..{right_oid}\n"

        old_header = f"a/{left_display}" if left_content is not None else DEV_NULL
        new_header = f"b/{right_display}" if right_content is not None else DEV_NULL

        old_lines = (left_content or "").splitlines(keepends=True)
        new_lines = (right_content or "").splitlines(keepends=True)
        if len(old_lines) > _DIFF_MAX_LINES or len(new_lines) > _DIFF_MAX_LINES:
            # 病态输入兜底:不生成行级 diff(对标 DIFF_TIMEOUT 降级)
            diff += f"--- {old_header}\n+++ {new_header}\n@@ 内容过大,行级 diff 省略 @@\n"
            return diff
        unified = difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=old_header,
            tofile=new_header,
            n=3,
        )
        diff += "".join(unified)
        return diff

    def _display_path(self, path: TrackedPath) -> str:
        display = path.path
        root = self._display_roots.get(path.environment_id)
        if root:
            norm_p = path.path.replace("\\", "/").rstrip("/")
            norm_r = root.replace("\\", "/").rstrip("/")
            if norm_p.startswith(norm_r + "/"):
                display = norm_p[len(norm_r) + 1:]
            elif norm_p == norm_r:
                display = path.path.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        else:
            # 无 display root 时退化为去掉引导斜杠的路径(git diff 头形态)
            display = display.lstrip("/")
        if len(self._display_roots) > 1 and path.environment_id:
            return f"{path.environment_id}/{display}"
        return display
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
