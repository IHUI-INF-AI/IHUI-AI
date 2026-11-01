# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""代码改名候选检测 —— 纯函数,零 IO、零全局可变态(P85,2026-11-01 立)。

逆向对齐目标(T12 §A2/§A6,取证 `docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/
T12-mtree-and-hook-host.md`):对侧把 `compute_simhash` / `compute_simhash_batch` /
`hamming_distance` 做成**原生一等导出**(`src\\core\\simhash.rs`,256 bit 指纹,
`invalid simhash hex length: expected 64` 是它的校验串),而它的 `diffTree` 结果桶仍然
只有 `added` / `modified` / `removed` 三桶 —— **相似底座在,改名的判定不在**。
本仓在快照差集这一格补上判定:

- 同 content-hash ⇒ **直判改名**(逐字节相同,旧切片的语义成本为零);
- 否则 simhash 汉明距离 ≤ `RENAME_MAX_HAMMING` ⇒ **候选**:内容已经很近但**变过**,
  所以调用方仍须重新嵌入(候选只把"删+增"读成"一次改名",不冒充内容没变);
- 其余仍然落 `added_only` / `removed_only` 两桶。

与对侧不同的三处(超越轴,不是顺手写的):
1. **阈值单点**:`RENAME_MAX_HAMMING` 全仓只有这一份;指纹取 64 bit(对侧 256 bit)——
   指纹只在本仓内自比、不与对侧互通,位数取小换常数成本,判据(阈值)同步给出,
   所以"位数"与"阈值"永远成对出现,不会出现抄了阈值忘了位数的那一型。
2. **判定与副作用分离**:本模块没有任何 IO/全局态,输入两张 map(可选两张指纹 map),
   输出 `RenameReport`;删不删旧切片、写不写新切片由调用方决定,判定可单测。
3. **判不出就说判不出**:指纹缺失 ⇒ `near_stage="skipped-no-fingerprints"`,
   两边规模超上限 ⇒ `"skipped-too-many"`,绝不静默退回"只有精确改名"还装作判完了。
"""

from __future__ import annotations

import hashlib
import itertools
import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from functools import lru_cache

#: 指纹位宽。对侧是 256 bit;本仓只做同仓内自比,取 64 bit 把常数压到 1/4,
#: 阈值因此必须与本行成对理解(见 `RENAME_MAX_HAMMING`)。
SIMHASH_BITS = 64
#: 64 bit 指纹的十六进制长度(快照里以 hex 存,便于 JSON 落盘与人读)。
SIMHASH_HEX_LEN = SIMHASH_BITS // 4
#: 汉明距离阈值(单点定义)。64 bit 指纹下 ≤3 bit 翻转是经典的"近重复"闸门:
#: 再放宽会把"同语言不同文件"也吞进来(它们共享同一批关键字),再收紧则连
#: "改名 + 改了一行"都判不出。
#:
#: 已知边界(实测,不是猜):**几十枚 token 的小文件**逐位多数本来就不稳,加一行注释
#: 能翻到 7 bit 以上 ⇒ 这些改名只会落在精确档或退化为"删 + 增"。这正是候选层该有的
#: 边界(它只影响"要不要少烧一次 embedding"),不是数据面损失 —— 内容永远会被索引,
#: 只是走了贵的那条路。
RENAME_MAX_HAMMING = 3
#: 指纹只吃前 N 枚 token。改名通常整文件搬走,前缀指纹足够判;上限换来的是
#: **每文件成本常数**(64 bit 的逐位累加是 O(token×64),不设上限在 monorepo
#: 上会变成秒级/文件)。对侧取证里也是同一取法("前 N 块,simhash")。
RENAME_FINGERPRINT_MAX_TOKENS = 1024
#: 近同判定两侧各自最多看多少枚候选:精确匹配之后剩下的规模一旦超限,
#: O(n×m) 会变成拖死一次索引的理由,宁可如实报 `skipped-too-many`。
RENAME_MAX_CANDIDATES_PER_SIDE = 512

RENAME_BASIS_HASH = "content-hash"
RENAME_BASIS_SIMHASH = "simhash"

NEAR_STAGE_DONE = "done"
NEAR_STAGE_NOT_NEEDED = "not-needed"
NEAR_STAGE_SKIPPED_NO_FINGERPRINTS = "skipped-no-fingerprints"
NEAR_STAGE_SKIPPED_TOO_MANY = "skipped-too-many"
#: 近同判定档位清单单源(实现与用例都从这一行取,不另写第二份)。
NEAR_STAGES: tuple[str, ...] = (
    NEAR_STAGE_DONE,
    NEAR_STAGE_NOT_NEEDED,
    NEAR_STAGE_SKIPPED_NO_FINGERPRINTS,
    NEAR_STAGE_SKIPPED_TOO_MANY,
)

# 代码 token:标识符 / 数字 / 多字符运算符 / 单个非空白标点。逐 token 进指纹,
# 所以"改了注释里的一个词"对指纹的影响是局部的(这正是汉明距离能用的前提)。
_TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*|\d+|==|!=|<=|>=|=>|->|[^\sA-Za-z0-9_]")


@dataclass(frozen=True)
class Rename:
    """一枚改名判定。`hamming is None` 只有精确档(basis=content-hash)才会出现。"""

    old_path: str
    new_path: str
    basis: str
    hamming: int | None = None


@dataclass(frozen=True)
class RenameReport:
    """一次差集判定的全部结论。三桶互斥且并集就是差集本身。"""

    renames: tuple[Rename, ...] = ()
    added_only: tuple[str, ...] = ()
    removed_only: tuple[str, ...] = ()
    near_stage: str = NEAR_STAGE_NOT_NEEDED

    def __post_init__(self) -> None:
        if self.near_stage not in NEAR_STAGES:
            raise ValueError(f"近同判定档位 {self.near_stage!r} 不在 NEAR_STAGES 里")

    @property
    def exact(self) -> tuple[Rename, ...]:
        """精确改名(同 content-hash)—— 只这几枚允许跳过重嵌入。"""
        return tuple(r for r in self.renames if r.basis == RENAME_BASIS_HASH)

    @property
    def near(self) -> tuple[Rename, ...]:
        """近同候选(内容已变)—— 只用于把"删+增"读成改名,不改变重嵌入义务。"""
        return tuple(r for r in self.renames if r.basis == RENAME_BASIS_SIMHASH)


@lru_cache(maxsize=16384)
def _token_hash(token: str) -> int:
    """token → 64 bit。同一标识符在整轮里只算一次(代码里重复率极高)。"""
    return int.from_bytes(hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest(), "big")


def compute_simhash(text: str, *, max_tokens: int = RENAME_FINGERPRINT_MAX_TOKENS) -> int:
    """文本 → 64 bit SimHash(逐 token 等权重累加,每位 >0 取 1)。

    纯函数:同输入同输出,没有时间/随机量(`blake2b` 而非 `hash()`,后者带进程盐)。
    `max_tokens` 只吃前缀 —— 见常量注释里的成本账。
    """
    if max_tokens <= 0:
        raise ValueError("max_tokens 必须为正:0 会把任何文本都压成同一枚指纹")
    counts = [0] * SIMHASH_BITS
    for match in itertools.islice(_TOKEN_RE.finditer(text or ""), max_tokens):
        h = _token_hash(match.group(0))
        for bit in range(SIMHASH_BITS):
            counts[bit] += 1 if (h >> bit) & 1 else -1
    value = 0
    for bit in range(SIMHASH_BITS):
        if counts[bit] > 0:
            value |= 1 << bit
    return value


def compute_simhash_batch(
    texts: Iterable[str], *, max_tokens: int = RENAME_FINGERPRINT_MAX_TOKENS
) -> list[int]:
    """批量版本(对侧同名导出 `compute_simhash_batch`);语义与逐个调用逐字相同。"""
    return [compute_simhash(text, max_tokens=max_tokens) for text in texts]


def hamming_distance(a: int, b: int) -> int:
    """两枚指纹的汉明距离。负数/超位宽一律抛 —— 静默截断会让判据偏移而不出声。"""
    if a < 0 or b < 0:
        raise ValueError("指纹不得为负")
    if a >> SIMHASH_BITS or b >> SIMHASH_BITS:
        raise ValueError(f"指纹超出 {SIMHASH_BITS} bit 位宽")
    return bin(a ^ b).count("1")


def fingerprint_hex(value: int) -> str:
    """指纹 → 定宽 hex(落盘形态)。"""
    if value < 0 or value >> SIMHASH_BITS:
        raise ValueError(f"指纹超出 {SIMHASH_BITS} bit 位宽")
    return f"{value:0{SIMHASH_HEX_LEN}x}"


def parse_fingerprint(raw: str | None) -> int | None:
    """hex → 指纹;形态不合返回 None(调用方据此判"这根针没数据",不猜)。"""
    if not isinstance(raw, str) or len(raw) != SIMHASH_HEX_LEN:
        return None
    try:
        return int(raw, 16)
    except ValueError:
        return None


def _suffix(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    idx = name.rfind(".")
    return name[idx:].lower() if idx > 0 else ""


def detect_renames(
    prev_hashes: Mapping[str, str],
    cur_hashes: Mapping[str, str],
    *,
    prev_fingerprints: Mapping[str, str] | None = None,
    cur_fingerprints: Mapping[str, str] | None = None,
    max_hamming: int = RENAME_MAX_HAMMING,
) -> RenameReport:
    """两张快照的内容 hash 表 → 改名判定(纯函数)。

    判定顺序:
    1. **同 content-hash 直判改名**(逐字节相同);同 hash 多枚时按路径字典序贪心配对
       —— 确定性优先,不追最优匹配(最优匹配在等价多解上是随机的)。
    2. 剩余两侧里,同扩展名 ∧ 汉明距离 ≤ `max_hamming` ⇒ 近同候选(按距离升序贪心)。
    3. 还没配上的原样落 `added_only` / `removed_only`:删除 + 新增就是删除 + 新增,
       不许被当成改名(那会让"旧切片不清、新切片不建"这一型真的发生)。

    指纹缺任一侧 ⇒ 只剩精确档并把档位写成 `skipped-no-fingerprints`(判不出就说判不出)。
    """
    removed = sorted(p for p in prev_hashes if p not in cur_hashes)
    added = sorted(p for p in cur_hashes if p not in prev_hashes)

    renames: list[Rename] = []
    used_old: set[str] = set()
    used_new: set[str] = set()

    by_hash: dict[str, list[str]] = {}
    for path in removed:
        by_hash.setdefault(str(prev_hashes[path]), []).append(path)
    for new_path in added:
        bucket = by_hash.get(str(cur_hashes[new_path]))
        if not bucket:
            continue
        old_path = bucket.pop(0)
        used_old.add(old_path)
        used_new.add(new_path)
        renames.append(Rename(old_path, new_path, RENAME_BASIS_HASH, None))

    rest_old = [p for p in removed if p not in used_old]
    rest_new = [p for p in added if p not in used_new]
    if not rest_old or not rest_new:
        stage = NEAR_STAGE_NOT_NEEDED
    elif prev_fingerprints is None or cur_fingerprints is None:
        stage = NEAR_STAGE_SKIPPED_NO_FINGERPRINTS
    elif (
        len(rest_old) > RENAME_MAX_CANDIDATES_PER_SIDE
        or len(rest_new) > RENAME_MAX_CANDIDATES_PER_SIDE
    ):
        stage = NEAR_STAGE_SKIPPED_TOO_MANY
    else:
        candidates: list[tuple[int, str, str]] = []
        for old_path in rest_old:
            left = parse_fingerprint(prev_fingerprints.get(old_path))
            if left is None:
                continue
            for new_path in rest_new:
                if _suffix(old_path) != _suffix(new_path):
                    continue
                right = parse_fingerprint(cur_fingerprints.get(new_path))
                if right is None:
                    continue
                distance = hamming_distance(left, right)
                if distance <= max_hamming:
                    candidates.append((distance, old_path, new_path))
        candidates.sort()
        for distance, old_path, new_path in candidates:
            if old_path in used_old or new_path in used_new:
                continue
            used_old.add(old_path)
            used_new.add(new_path)
            renames.append(Rename(old_path, new_path, RENAME_BASIS_SIMHASH, distance))
        stage = NEAR_STAGE_DONE

    return RenameReport(
        renames=tuple(renames),
        added_only=tuple(p for p in added if p not in used_new),
        removed_only=tuple(p for p in removed if p not in used_old),
        near_stage=stage,
    )


__test__ = {
    "compute_simhash": compute_simhash,
    "compute_simhash_batch": compute_simhash_batch,
    "hamming_distance": hamming_distance,
    "fingerprint_hex": fingerprint_hex,
    "parse_fingerprint": parse_fingerprint,
    "detect_renames": detect_renames,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
