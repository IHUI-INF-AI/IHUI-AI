# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""目录级递归前像(rhash)—— 索引快照的第二维:整枝比对与整枝搬家识别。

背景(2026-11-01,缺口表 #1,逆向-复现-超越铁律 §0.12):
    取证册 `docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T12-mtree-and-hook-host.md`
    §5 表首行观察到对侧 `MerkleNode{hash, rhash}` 与 `snapshot{rootHash, rootRhash}`:
    `rhash` 由 children 自底向上聚合 ⇒ **目录级前像可以整枝比对**。本仓 `_merkle_root`
    只有扁平根(`sha256(sorted("path:hash"))`),能 O(1) 判"整仓变没变",但答不了
    "哪一枝变了""这一枝是不是被整枝搬走了" —— 目录改名/整枝移动在它眼里与
    "删 n 个 + 增 n 个"同形。

复现的是行为与设计,不复刻对方字节。三处超越(逐条可测):
    1. **搬家配歧义不猜**:同一个 rhash 在两侧各出现多次时,配对是任意的 ⇒ 本模块
       整族判 `ambiguous`、一条都不报 moved(宁少报一次,不给错答案;与 P85 改名检测
       的歧义口径同一条纪律);
    2. **只报最浅的那一枝**:整枝搬走时每一层子目录的 rhash 都会跟着变,若逐层上报,
       读数会随嵌套深度膨胀。这里祖先已判 moved 的后代不再重复计(计数与点名同尺);
    3. **纯函数零 IO**:不读盘、不依赖 git ⇒ 夹具可逐档断言,也不必起进程。

射程与限制(必须知道,否则会误用):
    - 输入只有"被索引的文件面"(`path -> content hash`),**空目录无法表达** —— 一个
      只剩空目录的枝在本模块里等于不存在。这是刻意的:索引链本来就不索引空目录,
      凭空造一层"目录存在性"会让快照与真实索引面脱节;
    - 目录分隔符统一按 `/` 折;Windows 反斜杠由调用方先归一(索引链已是 posix 形态);
    - 根目录的键是空串 `""`(不是 `.`),与文件相对路径的写法同一套。

失效方向:输入形态不合(非 str 键/值)⇒ 抛 `ValueError`,绝不静默当成空表 ——
"没判"与"判过且干净"在调用方必须长得不一样(§0.3)。
"""

from __future__ import annotations

import hashlib
from collections.abc import Mapping
from dataclasses import dataclass, field

__all__ = [
    "DirRHashDiff",
    "depth_of",
    "dir_rhash_map",
    "diff_dir_rhash",
    "parent_of",
]

#: 聚合时的分隔符。与 `_merkle_root` 的差别只在前像粒度(根 vs 每层),不是第二套哈希算法。
_JOINER = "\n"


def depth_of(path: str) -> int:
    """目录深度:根(空串)= 0,`apps` = 1,`apps/web` = 2。"""
    return 0 if not path else path.count("/") + 1


def parent_of(path: str) -> str:
    """父目录;根没有父目录(返回空串,便于调用方无分支向上走)。"""
    parent, _sep, _name = path.rpartition("/")
    return parent


def _validate(file_hashes: Mapping[str, str]) -> None:
    for key, value in file_hashes.items():
        if not isinstance(key, str) or not isinstance(value, str):
            raise ValueError("dir_rhash 的输入必须是 path(str) -> hash(str)")
        if key == "":
            raise ValueError("空路径不是文件")
        if key.startswith("/") or key.endswith("/"):
            raise ValueError(f"路径必须是不带前导/尾随斜杠的相对路径: {key!r}")


def dir_rhash_map(file_hashes: Mapping[str, str]) -> dict[str, str]:
    """自底向上算每个目录的递归前像。返回 `dir -> rhash`,含根(键 `""`)。

    聚合规则(逐字):
        `rhash(dir) = sha256(join(f"{child_name}:{child_digest}" for child in sorted(children)))`
    其中 children = 该目录下的**文件**(名字 → 内容 hash)∪ **子目录**(名字 → 子目录 rhash)。
    文件与目录同名不可能出现在同一层(文件系统语义),所以一张表即够,无需第二套命名空间。
    """
    _validate(file_hashes)
    files_at: dict[str, dict[str, str]] = {}
    subdirs: dict[str, set[str]] = {}
    dirs: set[str] = {""}
    for path, digest in file_hashes.items():
        parts = path.split("/")
        # 每一层目录都要在册;子目录关系按**逐层贡献**登记,所以根目录的子目录
        # (apps、packages 这一层)也必然被记上 —— 漏了根这一格,根 rhash 就只剩
        # 顶层散文件、叶子一变它不动(整枝比对的全部意义在那里)。
        for depth in range(1, len(parts)):
            dirs.add("/".join(parts[:depth]))
            subdirs.setdefault("/".join(parts[: depth - 1]), set()).add(parts[depth - 1])
        parent = "/".join(parts[:-1])
        files_at.setdefault(parent, {})[parts[-1]] = digest

    out: dict[str, str] = {}
    for d in sorted(dirs, key=lambda s: (-depth_of(s), s)):
        members: dict[str, str] = dict(files_at.get(d, {}))
        prefix = f"{d}/" if d else ""
        for sub in sorted(subdirs.get(d, ())):
            members[sub] = out[prefix + sub]
        joined = _JOINER.join(f"{name}:{members[name]}" for name in sorted(members))
        out[d] = hashlib.sha256(joined.encode("utf-8")).hexdigest()
    return out


@dataclass
class DirRHashDiff:
    """两轮目录前像的差分。四桶互不相交,**任何一桶都不得被读成"通过"**。"""

    total_cur: int = 0
    unchanged: int = 0
    changed: int = 0
    added: int = 0
    removed: int = 0
    #: 整枝搬家:当前路径 → 上一轮路径。只报**最浅**的那一枝,祖先已报的后代不再重复。
    moved: dict[str, str] = field(default_factory=dict)
    #: 同一 rhash 在两侧各出现多次 ⇒ 配对任意 ⇒ 整族不报(不许猜)。
    ambiguous: int = 0
    #: 上一轮有目录前像吗(旧档没有 ⇒ 本轮只能报当前目录数,判不了"未变/搬家")。
    prev_present: bool = True

    def as_note(self) -> str:
        if not self.prev_present:
            return (
                "上一轮快照没有目录前像(旧档)⇒ 本轮的「未变/搬家」两桶判不出,"
                f"只报当前 {self.total_cur} 个目录;下一轮起可判"
            )
        parts = [
            f"目录 {self.total_cur} 个:未变 {self.unchanged} / 变 {self.changed} / "
            f"新增 {self.added} / 消失 {self.removed} / 整枝搬家 {len(self.moved)}"
        ]
        if self.ambiguous:
            parts.append(
                f"{self.ambiguous} 个 rhash 在两侧各出现多次 ⇒ 配对任意,"
                "整族不报搬家(宁少报一次,不给错答案)"
            )
        return ";".join(parts)


def diff_dir_rhash(prev: Mapping[str, str] | None, cur: Mapping[str, str]) -> DirRHashDiff:
    """比两轮目录前像。`prev is None` 表示上一轮**没有这一维**(旧档),单独一档。"""
    diff = DirRHashDiff(total_cur=len(cur))
    if prev is None:
        diff.prev_present = False
        return diff

    prev_by_rhash: dict[str, list[str]] = {}
    for d, rhash in prev.items():
        prev_by_rhash.setdefault(rhash, []).append(d)
    cur_by_rhash: dict[str, list[str]] = {}
    for d, rhash in cur.items():
        cur_by_rhash.setdefault(rhash, []).append(d)

    for d, rhash in cur.items():
        if d not in prev:
            diff.added += 1
        elif prev[d] == rhash:
            diff.unchanged += 1
        else:
            diff.changed += 1
    diff.removed = sum(1 for d in prev if d not in cur)

    # 整枝搬家:同 rhash、两侧各自唯一、且路径集不同。歧义族整族跳过并只报族数。
    pending: list[tuple[str, str]] = []
    for rhash, cur_dirs in cur_by_rhash.items():
        prev_dirs = prev_by_rhash.get(rhash)
        if not prev_dirs:
            continue
        if set(cur_dirs) == set(prev_dirs):
            continue  # 两侧同路径 ⇒ 已在 unchanged 里,不是搬家
        if len(cur_dirs) > 1 or len(prev_dirs) > 1:
            diff.ambiguous += 1
            continue
        pending.append((cur_dirs[0], prev_dirs[0]))

    # 只留最浅的那一枝:祖先已报 moved 的后代不再重复计。
    moved: dict[str, str] = {}
    for dst, src in sorted(pending, key=lambda pair: (depth_of(pair[0]), pair[0])):
        ancestor = parent_of(dst)
        covered = False
        while ancestor:
            if ancestor in moved:
                covered = True
                break
            ancestor = parent_of(ancestor)
        if covered:
            continue
        moved[dst] = src
    diff.moved = moved
    return diff
