# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""会话导出文件的冷归档压缩(2026-09-19 第二十批,对标 Codex rollout crate)。

- compress_cold_exports:把目录下「冷」的 *.jsonl 原子压缩为 .jsonl.gz,
  fire-and-forget 语义 —— 单文件失败只记入 errors,绝不抛出、绝不中断;
  marker 文件防止重叠或过于频繁的压缩轮(对标 codex 的 run marker)。
- open_export_lines:透明行读取器,同时处理明文与 .gz;路径在表示切换
  瞬间消失时短暂重试(对标 codex 的 NotFound 重试窗口)。

与 codex 的差异:压缩用 gzip 标准库(zstd 无第三方依赖不引入),其余语义
(原子写、保留 mtime、marker 限频、错误隔离)逐条对齐。
"""

from __future__ import annotations

import gzip
import os
import time
from collections.abc import Iterator
from pathlib import Path

__all__ = [
    "is_cold",
    "compress_cold_exports",
    "open_export_lines",
    "estimate_bytes_saved",
]

_TMP_COUNTER = 0
_NOT_FOUND_RETRIES = 3
_NOT_FOUND_RETRY_DELAY_S = 0.05


def is_cold(path: Path, older_than_hours: float, now: float | None = None) -> bool:
    """mtime 早于阈值即「冷」;文件不存在/不可访问返回 False(不猜)。"""
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return False
    current = now if now is not None else time.time()
    return (current - mtime) >= max(0.0, older_than_hours) * 3600.0


def estimate_bytes_saved(original: int, compressed: int) -> int:
    """字节节省量(负数按 0 计,压缩失败不产生负收益)。"""
    return max(0, original - compressed)


def _read_marker(marker_path: Path) -> float | None:
    try:
        return float(marker_path.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return None  # marker 缺失/损坏 → 降级为"本次照跑"


def _write_marker(marker_path: Path, ts: float) -> None:
    try:
        marker_path.parent.mkdir(parents=True, exist_ok=True)
        marker_path.write_text(str(ts), encoding="utf-8")
    except OSError:
        pass  # marker 写失败不阻塞本轮压缩


def _atomic_gzip(src: Path, dest: Path) -> None:
    """原子压缩:写 .tmp(带计数器防并发冲突)后 os.replace 到目标名。"""
    global _TMP_COUNTER
    _TMP_COUNTER += 1
    tmp = dest.with_name(dest.name + f".tmp.{os.getpid()}.{_TMP_COUNTER}")
    try:
        with open(src, "rb") as fin, gzip.open(tmp, "wb", compresslevel=6) as fout:
            while True:
                chunk = fin.read(1 << 20)
                if not chunk:
                    break
                fout.write(chunk)
        # 保留原 mtime:让"冷"判定不被压缩动作重置(否则下轮时序混乱)
        st = src.stat()
        os.utime(tmp, ns=(st.st_atime_ns, st.st_mtime_ns))
        os.replace(tmp, dest)
    except Exception:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        raise


def compress_cold_exports(
    directory: Path,
    older_than_hours: float = 168.0,
    min_size_bytes: int = 1024,
    marker_dir: Path | None = None,
    min_interval_minutes: float = 30.0,
    now: float | None = None,
) -> dict[str, int | list[str]]:
    """压缩目录下的冷导出文件(对标 codex spawn_rollout_compression_worker)。

    - 只处理 *.jsonl(已压缩的 .jsonl.gz 跳过);
    - 冷(mtime 早于阈值)且 >= min_size_bytes 才压;
    - 原子写 + 保留 mtime;成功后删除原文件;
    - marker_dir 给定时:距上次运行不足 min_interval_minutes 则整轮跳过;
      marker 读写失败降级照跑;
    - fire-and-forget:单文件失败记入 errors 并继续,绝不抛出。
    """
    compressed = 0
    skipped_hot = 0
    skipped_small = 0
    bytes_saved = 0
    errors: list[str] = []
    marker_path = (marker_dir or directory) / ".rollout-archive-marker"
    if marker_dir is not None:
        last = _read_marker(marker_path)
        current = now if now is not None else time.time()
        if (
            last is not None
            and (current - last) < max(0.0, min_interval_minutes) * 60.0
        ):
            return {
                "compressed": 0,
                "skipped_hot": 0,
                "skipped_small": 0,
                "skipped_marker": 1,
                "bytes_saved": 0,
                "errors": [],
            }
    try:
        candidates = sorted(
            p for p in directory.glob("*.jsonl") if p.is_file()
        ) if directory.is_dir() else []
    except OSError:
        candidates = []
    for path in candidates:
        try:
            if not is_cold(path, older_than_hours, now=now):
                skipped_hot += 1
                continue
            size = path.stat().st_size
            if size < min_size_bytes:
                skipped_small += 1
                continue
            dest = path.with_name(path.name + ".gz")
            if dest.exists():
                skipped_hot += 1  # 目标已存在,视为已处理
                continue
            _atomic_gzip(path, dest)
            bytes_saved += estimate_bytes_saved(size, dest.stat().st_size)
            path.unlink()
            compressed += 1
        except Exception as e:  # noqa: BLE001 - fire-and-forget:失败隔离
            errors.append(f"{path.name}: {e}")
    if marker_dir is not None:
        _write_marker(marker_path, now if now is not None else time.time())
    return {
        "compressed": compressed,
        "skipped_hot": skipped_hot,
        "skipped_small": skipped_small,
        "skipped_marker": 0,
        "bytes_saved": bytes_saved,
        "errors": errors,
    }


def open_export_lines(path: Path) -> Iterator[str]:
    """透明行读取器:明文 .jsonl 与压缩 .jsonl.gz 通吃。

    文件在表示切换瞬间(明文→压缩)可能短暂消失:NotFound 时重试最多 3 次、
    间隔 0.05s(对标 codex MAX_NOT_FOUND_RETRIES),仍失败才抛 FileNotFoundError。
    """
    last_err: OSError | None = None
    for attempt in range(_NOT_FOUND_RETRIES):
        try:
            gz_path = path.with_name(path.name + ".gz")
            if path.is_file():
                with open(path, "r", encoding="utf-8", errors="replace") as fin:
                    for line in fin:
                        yield line.rstrip("\r\n")
                return
            if gz_path.is_file():
                with gzip.open(gz_path, "rt", encoding="utf-8", errors="replace") as fin:
                    for line in fin:
                        yield line.rstrip("\r\n")
                return
            last_err = FileNotFoundError(str(path))
        except OSError as e:  # 读取中途的瞬态错误同样走重试窗口
            last_err = e
        if attempt < _NOT_FOUND_RETRIES - 1:
            time.sleep(_NOT_FOUND_RETRY_DELAY_S)
    assert last_err is not None
    raise last_err
