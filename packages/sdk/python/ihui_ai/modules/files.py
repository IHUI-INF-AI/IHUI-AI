"""文件模块 — 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传。

端点(9 个):
- GET  /v1/files(文件列表)
- POST /v1/files(上传文件,multipart/form-data)
- GET  /v1/files/:id(文件详情)
- DELETE /v1/files/:id(删除文件)
- GET  /v1/files/:id/content(文件内容,二进制流)
- GET  /v1/files/:id/versions(文件版本)
- POST /v1/files/upload-init(分片上传初始化)
- POST /v1/files/upload-chunk(上传分片)
- POST /v1/files/complete(完成上传)
"""

from __future__ import annotations

from collections.abc import Iterator
from urllib.parse import quote

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import (
    V1FileInfo,
    V1FileVersionsResponse,
    V1FilesListResponse,
    V1UploadChunkRequest,
    V1UploadCompleteRequest,
    V1UploadCompleteResponse,
    V1UploadInitRequest,
    V1UploadInitResponse,
)


class FilesApi:
    """文件模块(同步)— 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def list(self) -> V1FilesListResponse:
        """GET /v1/files(文件列表)。"""
        return self._client.request("GET", "/files")

    def upload(self, file: bytes, filename: str = "upload") -> V1FileInfo:
        """POST /v1/files(上传文件,multipart/form-data)。

        Args:
            file: 文件内容 bytes。
            filename: 文件名。
        """
        return self._client.request(
            "POST",
            "/files",
            multipart=({}, {"file": (filename, file)}),
        )

    def get(self, file_id: str) -> V1FileInfo:
        """GET /v1/files/:id(文件详情)。"""
        return self._client.request("GET", f"/files/{quote(file_id, safe='')}")

    def delete(self, file_id: str) -> None:
        """DELETE /v1/files/:id(删除文件)。"""
        self._client.request("DELETE", f"/files/{quote(file_id, safe='')}")

    def get_content(self, file_id: str) -> bytes:
        """GET /v1/files/:id/content(文件内容,返回二进制 bytes)。"""
        return self._client.request_raw("GET", f"/files/{quote(file_id, safe='')}/content")

    def get_versions(self, file_id: str) -> V1FileVersionsResponse:
        """GET /v1/files/:id/versions(文件版本列表)。"""
        return self._client.request("GET", f"/files/{quote(file_id, safe='')}/versions")

    def upload_init(self, req: V1UploadInitRequest) -> V1UploadInitResponse:
        """POST /v1/files/upload-init(分片上传初始化)。"""
        return self._client.request("POST", "/files/upload-init", req)

    def upload_chunk(self, req: V1UploadChunkRequest) -> None:
        """POST /v1/files/upload-chunk(上传分片)。"""
        self._client.request("POST", "/files/upload-chunk", req)

    def upload_complete(self, req: V1UploadCompleteRequest) -> V1UploadCompleteResponse:
        """POST /v1/files/complete(完成分片上传)。"""
        return self._client.request("POST", "/files/complete", req)


class AsyncFilesApi:
    """文件模块(asyncio)— 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def list(self) -> V1FilesListResponse:
        """GET /v1/files(文件列表)。"""
        return await self._client.request("GET", "/files")

    async def upload(self, file: bytes, filename: str = "upload") -> V1FileInfo:
        """POST /v1/files(上传文件,multipart/form-data)。

        Args:
            file: 文件内容 bytes。
            filename: 文件名。
        """
        return await self._client.request(
            "POST",
            "/files",
            multipart=({}, {"file": (filename, file)}),
        )

    async def get(self, file_id: str) -> V1FileInfo:
        """GET /v1/files/:id(文件详情)。"""
        return await self._client.request("GET", f"/files/{quote(file_id, safe='')}")

    async def delete(self, file_id: str) -> None:
        """DELETE /v1/files/:id(删除文件)。"""
        await self._client.request("DELETE", f"/files/{quote(file_id, safe='')}")

    async def get_content(self, file_id: str) -> bytes:
        """GET /v1/files/:id/content(文件内容,返回二进制 bytes)。

        注意:此方法内部使用同步 urllib(通过 run_in_executor),
        因为 asyncio 流式读取二进制内容的实现较复杂,且文件下载通常不是高频操作。
        """
        import asyncio

        loop = asyncio.get_event_loop()
        # 复用同步 BaseClient 的 request_raw
        from ..base import BaseClient

        sync_client = BaseClient.__new__(BaseClient)
        sync_client._api_key = self._client._api_key
        sync_client._secret = self._client._secret
        sync_client._base_url = self._client._base_url
        sync_client._timeout = self._client._timeout
        sync_client._max_retries = self._client._max_retries
        return await loop.run_in_executor(
            None, sync_client.request_raw, "GET", f"/files/{quote(file_id, safe='')}/content"
        )

    async def get_versions(self, file_id: str) -> V1FileVersionsResponse:
        """GET /v1/files/:id/versions(文件版本列表)。"""
        return await self._client.request("GET", f"/files/{quote(file_id, safe='')}/versions")

    async def upload_init(self, req: V1UploadInitRequest) -> V1UploadInitResponse:
        """POST /v1/files/upload-init(分片上传初始化)。"""
        return await self._client.request("POST", "/files/upload-init", req)

    async def upload_chunk(self, req: V1UploadChunkRequest) -> None:
        """POST /v1/files/upload-chunk(上传分片)。"""
        await self._client.request("POST", "/files/upload-chunk", req)

    async def upload_complete(self, req: V1UploadCompleteRequest) -> V1UploadCompleteResponse:
        """POST /v1/files/complete(完成分片上传)。"""
        return await self._client.request("POST", "/files/complete", req)


__all__ = ["FilesApi", "AsyncFilesApi"]
