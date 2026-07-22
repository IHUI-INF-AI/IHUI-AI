"""MCP 工具 / 技能 / 人格 / 代码搜索 / 截图模块。

端点(16 个):
- GET  /v1/tools
- POST /v1/tools/call
- GET  /v1/resources
- GET  /v1/resources/:uri
- GET  /v1/prompts
- POST /v1/prompts/invoke
- GET  /v1/skills
- GET  /v1/slash-commands
- POST /v1/slash-commands
- POST /v1/sampling
- GET  /v1/personas
- GET  /v1/personas/:name
- POST /v1/tools/search-codebase
- POST /v1/tools/search-web
- POST /v1/tools/analyze-code
- POST /v1/screenshot
"""

from __future__ import annotations

from urllib.parse import quote

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import (
    V1AnalyzeCodeRequest,
    V1AnalyzeCodeResponse,
    V1InvokeSlashCommandRequest,
    V1InvokeSlashCommandResponse,
    V1PersonaDetail,
    V1PersonasResponse,
    V1PromptInvokeRequest,
    V1PromptInvokeResponse,
    V1PromptsResponse,
    V1ResourceDetail,
    V1ResourcesResponse,
    V1SamplingRequest,
    V1SamplingResponse,
    V1ScreenshotRequest,
    V1ScreenshotResponse,
    V1SearchCodebaseRequest,
    V1SearchCodebaseResponse,
    V1SearchWebRequest,
    V1SearchWebResponse,
    V1SkillsResponse,
    V1SlashCommandsResponse,
    V1ToolCallRequest,
    V1ToolCallResponse,
    V1ToolsResponse,
)


class ToolsApi:
    """MCP 工具 / 技能 / 人格 / 代码搜索 / 截图模块(同步)。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def list(self) -> V1ToolsResponse:
        """GET /v1/tools(MCP 工具列表)。"""
        return self._client.request("GET", "/tools")

    def call(self, req: V1ToolCallRequest) -> V1ToolCallResponse:
        """POST /v1/tools/call(调用 MCP 工具)。"""
        return self._client.request("POST", "/tools/call", req)

    def list_resources(self) -> V1ResourcesResponse:
        """GET /v1/resources(MCP 资源列表)。"""
        return self._client.request("GET", "/resources")

    def get_resource(self, uri: str) -> V1ResourceDetail:
        """GET /v1/resources/:uri(资源详情)。"""
        return self._client.request("GET", f"/resources/{quote(uri, safe='')}")

    def list_prompts(self) -> V1PromptsResponse:
        """GET /v1/prompts(MCP 提示词列表)。"""
        return self._client.request("GET", "/prompts")

    def invoke_prompt(self, req: V1PromptInvokeRequest) -> V1PromptInvokeResponse:
        """POST /v1/prompts/invoke(调用提示词)。"""
        return self._client.request("POST", "/prompts/invoke", req)

    def list_skills(self) -> V1SkillsResponse:
        """GET /v1/skills(技能列表)。"""
        return self._client.request("GET", "/skills")

    def list_slash_commands(self) -> V1SlashCommandsResponse:
        """GET /v1/slash-commands(slash 命令列表)。"""
        return self._client.request("GET", "/slash-commands")

    def invoke_slash_command(self, req: V1InvokeSlashCommandRequest) -> V1InvokeSlashCommandResponse:
        """POST /v1/slash-commands(调用 slash 命令)。"""
        return self._client.request("POST", "/slash-commands", req)

    def sampling(self, req: V1SamplingRequest) -> V1SamplingResponse:
        """POST /v1/sampling(模型采样)。"""
        return self._client.request("POST", "/sampling", req)

    def list_personas(self) -> V1PersonasResponse:
        """GET /v1/personas(人格列表)。"""
        return self._client.request("GET", "/personas")

    def get_persona(self, name: str) -> V1PersonaDetail:
        """GET /v1/personas/:name(人格详情)。"""
        return self._client.request("GET", f"/personas/{quote(name, safe='')}")

    def search_codebase(self, req: V1SearchCodebaseRequest) -> V1SearchCodebaseResponse:
        """POST /v1/tools/search-codebase(代码库搜索)。"""
        return self._client.request("POST", "/tools/search-codebase", req)

    def search_web(self, req: V1SearchWebRequest) -> V1SearchWebResponse:
        """POST /v1/tools/search-web(网页搜索)。"""
        return self._client.request("POST", "/tools/search-web", req)

    def analyze_code(self, req: V1AnalyzeCodeRequest) -> V1AnalyzeCodeResponse:
        """POST /v1/tools/analyze-code(代码分析)。"""
        return self._client.request("POST", "/tools/analyze-code", req)

    def screenshot(self, req: V1ScreenshotRequest) -> V1ScreenshotResponse:
        """POST /v1/screenshot(网页截图)。"""
        return self._client.request("POST", "/screenshot", req)


class AsyncToolsApi:
    """MCP 工具 / 技能 / 人格 / 代码搜索 / 截图模块(asyncio)。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def list(self) -> V1ToolsResponse:
        """GET /v1/tools(MCP 工具列表)。"""
        return await self._client.request("GET", "/tools")

    async def call(self, req: V1ToolCallRequest) -> V1ToolCallResponse:
        """POST /v1/tools/call(调用 MCP 工具)。"""
        return await self._client.request("POST", "/tools/call", req)

    async def list_resources(self) -> V1ResourcesResponse:
        """GET /v1/resources(MCP 资源列表)。"""
        return await self._client.request("GET", "/resources")

    async def get_resource(self, uri: str) -> V1ResourceDetail:
        """GET /v1/resources/:uri(资源详情)。"""
        return await self._client.request("GET", f"/resources/{quote(uri, safe='')}")

    async def list_prompts(self) -> V1PromptsResponse:
        """GET /v1/prompts(MCP 提示词列表)。"""
        return await self._client.request("GET", "/prompts")

    async def invoke_prompt(self, req: V1PromptInvokeRequest) -> V1PromptInvokeResponse:
        """POST /v1/prompts/invoke(调用提示词)。"""
        return await self._client.request("POST", "/prompts/invoke", req)

    async def list_skills(self) -> V1SkillsResponse:
        """GET /v1/skills(技能列表)。"""
        return await self._client.request("GET", "/skills")

    async def list_slash_commands(self) -> V1SlashCommandsResponse:
        """GET /v1/slash-commands(slash 命令列表)。"""
        return await self._client.request("GET", "/slash-commands")

    async def invoke_slash_command(self, req: V1InvokeSlashCommandRequest) -> V1InvokeSlashCommandResponse:
        """POST /v1/slash-commands(调用 slash 命令)。"""
        return await self._client.request("POST", "/slash-commands", req)

    async def sampling(self, req: V1SamplingRequest) -> V1SamplingResponse:
        """POST /v1/sampling(模型采样)。"""
        return await self._client.request("POST", "/sampling", req)

    async def list_personas(self) -> V1PersonasResponse:
        """GET /v1/personas(人格列表)。"""
        return await self._client.request("GET", "/personas")

    async def get_persona(self, name: str) -> V1PersonaDetail:
        """GET /v1/personas/:name(人格详情)。"""
        return await self._client.request("GET", f"/personas/{quote(name, safe='')}")

    async def search_codebase(self, req: V1SearchCodebaseRequest) -> V1SearchCodebaseResponse:
        """POST /v1/tools/search-codebase(代码库搜索)。"""
        return await self._client.request("POST", "/tools/search-codebase", req)

    async def search_web(self, req: V1SearchWebRequest) -> V1SearchWebResponse:
        """POST /v1/tools/search-web(网页搜索)。"""
        return await self._client.request("POST", "/tools/search-web", req)

    async def analyze_code(self, req: V1AnalyzeCodeRequest) -> V1AnalyzeCodeResponse:
        """POST /v1/tools/analyze-code(代码分析)。"""
        return await self._client.request("POST", "/tools/analyze-code", req)

    async def screenshot(self, req: V1ScreenshotRequest) -> V1ScreenshotResponse:
        """POST /v1/screenshot(网页截图)。"""
        return await self._client.request("POST", "/screenshot", req)


__all__ = ["ToolsApi", "AsyncToolsApi"]
