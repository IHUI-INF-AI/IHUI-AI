"""用户 / 工作区 / 工作流 / 统计模块。

端点(9 个):
- GET  /v1/me(当前用户 + 配额)
- GET  /v1/projects(项目列表)
- GET  /v1/projects/:id/files(项目文件)
- GET  /v1/workflows/:id(工作流详情)
- POST /v1/workflows/instances(运行工作流)
- POST /v1/workflows/coze/run(Coze 工作流)
- POST /v1/workflows/n8n/run(n8n 工作流)
- GET  /v1/usage(用量统计)
- GET  /v1/usage/:vendor(厂商用量)
"""

from __future__ import annotations

from urllib.parse import quote

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import (
    V1ProjectFilesResponse,
    V1ProjectsResponse,
    V1RunCozeWorkflowRequest,
    V1RunCozeWorkflowResponse,
    V1RunN8nWorkflowRequest,
    V1RunN8nWorkflowResponse,
    V1RunWorkflowRequest,
    V1RunWorkflowResponse,
    V1UsageResponse,
    V1UserInfo,
    V1VendorUsageResponse,
    V1WorkflowInfo,
)


class UserApi:
    """用户 / 工作区 / 工作流 / 统计模块(同步)。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def me(self) -> V1UserInfo:
        """GET /v1/me(当前用户信息 + 配额)。"""
        return self._client.request("GET", "/me")

    def list_projects(self) -> V1ProjectsResponse:
        """GET /v1/projects(项目列表)。"""
        return self._client.request("GET", "/projects")

    def list_project_files(self, project_id: str) -> V1ProjectFilesResponse:
        """GET /v1/projects/:id/files(项目文件列表)。"""
        return self._client.request("GET", f"/projects/{quote(project_id, safe='')}/files")

    def get_workflow(self, workflow_id: str) -> V1WorkflowInfo:
        """GET /v1/workflows/:id(工作流详情)。"""
        return self._client.request("GET", f"/workflows/{quote(workflow_id, safe='')}")

    def run_workflow(self, req: V1RunWorkflowRequest) -> V1RunWorkflowResponse:
        """POST /v1/workflows/instances(运行工作流)。"""
        return self._client.request("POST", "/workflows/instances", req)

    def run_coze_workflow(self, req: V1RunCozeWorkflowRequest) -> V1RunCozeWorkflowResponse:
        """POST /v1/workflows/coze/run(Coze 工作流)。"""
        return self._client.request("POST", "/workflows/coze/run", req)

    def run_n8n_workflow(self, req: V1RunN8nWorkflowRequest) -> V1RunN8nWorkflowResponse:
        """POST /v1/workflows/n8n/run(n8n 工作流)。"""
        return self._client.request("POST", "/workflows/n8n/run", req)

    def get_usage(self) -> V1UsageResponse:
        """GET /v1/usage(用量统计)。"""
        return self._client.request("GET", "/usage")

    def get_vendor_usage(self, vendor: str) -> V1VendorUsageResponse:
        """GET /v1/usage/:vendor(厂商用量)。"""
        return self._client.request("GET", f"/usage/{quote(vendor, safe='')}")


class AsyncUserApi:
    """用户 / 工作区 / 工作流 / 统计模块(asyncio)。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def me(self) -> V1UserInfo:
        """GET /v1/me(当前用户信息 + 配额)。"""
        return await self._client.request("GET", "/me")

    async def list_projects(self) -> V1ProjectsResponse:
        """GET /v1/projects(项目列表)。"""
        return await self._client.request("GET", "/projects")

    async def list_project_files(self, project_id: str) -> V1ProjectFilesResponse:
        """GET /v1/projects/:id/files(项目文件列表)。"""
        return await self._client.request("GET", f"/projects/{quote(project_id, safe='')}/files")

    async def get_workflow(self, workflow_id: str) -> V1WorkflowInfo:
        """GET /v1/workflows/:id(工作流详情)。"""
        return await self._client.request("GET", f"/workflows/{quote(workflow_id, safe='')}")

    async def run_workflow(self, req: V1RunWorkflowRequest) -> V1RunWorkflowResponse:
        """POST /v1/workflows/instances(运行工作流)。"""
        return await self._client.request("POST", "/workflows/instances", req)

    async def run_coze_workflow(self, req: V1RunCozeWorkflowRequest) -> V1RunCozeWorkflowResponse:
        """POST /v1/workflows/coze/run(Coze 工作流)。"""
        return await self._client.request("POST", "/workflows/coze/run", req)

    async def run_n8n_workflow(self, req: V1RunN8nWorkflowRequest) -> V1RunN8nWorkflowResponse:
        """POST /v1/workflows/n8n/run(n8n 工作流)。"""
        return await self._client.request("POST", "/workflows/n8n/run", req)

    async def get_usage(self) -> V1UsageResponse:
        """GET /v1/usage(用量统计)。"""
        return await self._client.request("GET", "/usage")

    async def get_vendor_usage(self, vendor: str) -> V1VendorUsageResponse:
        """GET /v1/usage/:vendor(厂商用量)。"""
        return await self._client.request("GET", f"/usage/{quote(vendor, safe='')}")


__all__ = ["UserApi", "AsyncUserApi"]
