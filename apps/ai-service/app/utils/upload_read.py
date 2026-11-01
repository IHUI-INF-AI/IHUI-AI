# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""上传体的**分块 + 上限**读取(全仓唯一实现)。

为什么需要它(2026-11-01 安全强化,高危):
四个上传端点此前都是同一种写法 —— `data = await file.read()` 之后才判 `len(data)`,
其中 ``/api/image/edits`` 连上限都没有。Starlette 的 ``UploadFile`` 会把请求体落到
临时文件/内存,但 ``read()`` 无参调用把整包一次性读进进程内存:一枚 2GB 的分片就能
把 worker 打到 OOM,而"判定"发生在内存已经吃完之后 —— 上限本身没有起到限流作用。

``read_capped`` 边读边断:峰值内存受限于 ``limit + 一个分块``,超限立刻返回 ``None``,
调用方据此回 413/400,不再需要"先读完再量"。
"""

from __future__ import annotations

from typing import Any

__all__ = ["DEFAULT_CHUNK_BYTES", "read_capped"]

# 1MiB 分块:小到峰值可控,大到不会把 25MiB 的音频/图片拆成上千次系统调用。
DEFAULT_CHUNK_BYTES = 1024 * 1024


async def read_capped(
    file: Any, limit: int, *, chunk_size: int = DEFAULT_CHUNK_BYTES
) -> bytes | None:
    """分块读到 ``limit`` 为止;**超限返回 None**,不会把整包读进内存再判长度。

    Args:
        file: Starlette ``UploadFile`` 形状的对象(有 ``async read(size)``)。
        limit: 上限字节数;读到的总量**超过**它即返回 None(等于 limit 允许)。
        chunk_size: 单次读取块大小。

    Returns:
        完整内容(``len <= limit``);超限返回 None。
    """
    if limit < 0:
        raise ValueError("limit 不能为负(0 = 只允许空文件)")
    if chunk_size <= 0:
        raise ValueError("chunk_size 必须为正")
    chunks: list[bytes] = []
    total = 0
    while True:
        piece = await file.read(chunk_size)
        if not piece:
            break
        total += len(piece)
        if total > limit:
            return None
        chunks.append(piece)
    return b"".join(chunks)
