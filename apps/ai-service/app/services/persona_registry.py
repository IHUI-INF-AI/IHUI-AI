# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Persona contracts registry — 对齐 apps/cli/src/personas/contracts.ts。

5 个 persona: researcher / coder / reviewer / architect / debugger。
每个 persona 声明 input_schema / output_schema(JSON Schema 子集),
让 AI-Service 暴露与 CLI 一致的契约给前端。
"""

from dataclasses import dataclass
from typing import Any

from .project_memory import build_system_prompt


@dataclass
class PersonaContract:
    """Persona 输入/输出契约。

    tools(D01 2026-10-25 立):该 persona 的工具白名单摘要,**唯一**数据面 ——
    对话内 Agent 选择器(/personas)与 chat 请求的工具并入(merge_persona_tools)
    都从这一份读,禁止再建第二份 persona→工具映射。
    """

    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    tools: tuple[str, ...] = ()


PERSONAS_CONTRACTS: dict[str, PersonaContract] = {
    "researcher": PersonaContract(
        input_schema={
            "type": "object",
            "description": "researcher 输入:调研任务 + 文件路径",
            "properties": {
                "task": {"type": "string", "description": "调研任务描述(清晰、独立、可验证)"},
                "filePaths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "需调研的文件路径列表(可选,用于聚焦范围)",
                },
                "scope": {"type": "string", "description": "调研范围(可选,如模块/目录/主题)"},
            },
            "required": ["task"],
            "additionalProperties": False,
        },
        output_schema={
            "type": "object",
            "description": "researcher 输出:调研摘要 + 推荐方案",
            "properties": {
                "researchSummary": {
                    "type": "string",
                    "description": "调研结论摘要(事实陈述,非代码)",
                },
                "recommendedApproach": {"type": "string", "description": "推荐实现方案"},
                "references": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "引用的文件路径/URL(可选)",
                },
            },
            "required": ["researchSummary", "recommendedApproach"],
            "additionalProperties": False,
        },
        tools=("read_file", "list_files", "search_codebase", "analyze_code", "parse_document"),
    ),
    "coder": PersonaContract(
        input_schema={
            "type": "object",
            "description": "coder 输入:任务 + 受影响文件 + 约束",
            "properties": {
                "task": {"type": "string", "description": "实现任务描述"},
                "affectedFiles": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "受影响的文件绝对路径列表",
                },
                "constraints": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "实现约束(如不得改 schema、保持向后兼容)",
                },
            },
            "required": ["task", "affectedFiles"],
            "additionalProperties": False,
        },
        output_schema={
            "type": "object",
            "description": "coder 输出:代码改动 + 测试结果 + 验证依据",
            "properties": {
                "codeChanges": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "修改的文件清单(逐文件列明)",
                },
                "testResults": {"type": "string", "description": "测试结果摘要(通过数/失败数)"},
                "verification": {
                    "type": "string",
                    "description": "验证依据(typecheck/lint/test 命令 + 退出码)",
                },
            },
            "required": ["codeChanges", "verification"],
            "additionalProperties": False,
        },
        tools=(
            "read_file",
            "list_files",
            "search_codebase",
            "file_edit",
            "write_file",
            "run_command",
            "generate_test",
        ),
    ),
    "reviewer": PersonaContract(
        input_schema={
            "type": "object",
            "description": "reviewer 输入:代码 diff + 审查标准",
            "properties": {
                "codeDiff": {"type": "string", "description": "待审查的代码 diff(统一格式)"},
                "reviewCriteria": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "审查标准(如安全/性能/可读性)",
                },
                "context": {"type": "string", "description": "审查上下文(可选,如关联需求)"},
            },
            "required": ["codeDiff"],
            "additionalProperties": False,
        },
        output_schema={
            "type": "object",
            "description": "reviewer 输出:审查意见 + 决策",
            "properties": {
                "reviewComments": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "审查意见列表(每条含 严重度 + 文件:行 + 修复建议)",
                },
                "decision": {
                    "type": "string",
                    "enum": ["approve", "request_changes"],
                    "description": "审查结论:approve=通过 / request_changes=需修改",
                },
                "severity": {
                    "type": "string",
                    "enum": ["P0", "P1", "P2"],
                    "description": "最高问题严重度(无问题填 P2)",
                },
            },
            "required": ["reviewComments", "decision"],
            "additionalProperties": False,
        },
        tools=("read_file", "list_files", "search_codebase", "analyze_code", "review_pr"),
    ),
    "architect": PersonaContract(
        input_schema={
            "type": "object",
            "description": "architect 输入:需求 + 约束",
            "properties": {
                "requirements": {"type": "string", "description": "需求描述(要解决什么问题)"},
                "constraints": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "设计约束(技术栈/性能/兼容性)",
                },
                "existingArchitecture": {
                    "type": "string",
                    "description": "现有架构说明(可选,用于增量设计)",
                },
            },
            "required": ["requirements"],
            "additionalProperties": False,
        },
        output_schema={
            "type": "object",
            "description": "architect 输出:设计文档 + 文件结构 + API 契约",
            "properties": {
                "designDoc": {"type": "string", "description": "设计文档(含模块划分 + 数据流)"},
                "fileStructure": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "建议的文件结构(路径 + 职责)",
                },
                "apiContracts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "API 契约定义(路由 + 请求/响应 schema)",
                },
            },
            "required": ["designDoc", "fileStructure"],
            "additionalProperties": False,
        },
        tools=("read_file", "list_files", "search_codebase", "analyze_code"),
    ),
    "debugger": PersonaContract(
        input_schema={
            "type": "object",
            "description": "debugger 输入:错误描述 + 堆栈 + 复现步骤",
            "properties": {
                "errorDescription": {"type": "string", "description": "错误描述(现象 + 期望)"},
                "stackTrace": {"type": "string", "description": "堆栈跟踪(可选但强烈推荐)"},
                "reproSteps": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "复现步骤(逐步可执行)",
                },
            },
            "required": ["errorDescription"],
            "additionalProperties": False,
        },
        output_schema={
            "type": "object",
            "description": "debugger 输出:根因 + 修复 + 验证测试",
            "properties": {
                "rootCause": {"type": "string", "description": "根因分析(为什么出错)"},
                "fix": {"type": "string", "description": "修复方案(改了什么 + 为什么这样改)"},
                "test": {"type": "string", "description": "验证测试(如何确认修复有效)"},
            },
            "required": ["rootCause", "fix"],
            "additionalProperties": False,
        },
        tools=("read_file", "search_codebase", "run_command", "file_edit", "generate_test"),
    ),
}


def get_persona_contract(persona: str) -> PersonaContract | None:
    """按名称获取 persona 契约,不存在返回 None。"""
    return PERSONAS_CONTRACTS.get(persona)


def list_persona_names() -> list[str]:
    """列出全部 persona 名称。"""
    return list(PERSONAS_CONTRACTS.keys())


# ════════════════════════════════════════════════
# D01(2026-10-25)对话内 Agent 选择器运行时并入
# 与 build_persona_system_prompt 的分工:那个是 CLI persona 子进程的**完整**提示词
# (DEFAULT + 字典 + 项目记忆 + 契约),而主聊天链路已经把记忆/字典注入过了,
# 再叠加一次会把同一段记忆写两遍。故 chat 侧只并入 persona 契约摘要这一段,
# 数据仍从 PERSONAS_CONTRACTS 这唯一注册表派生 —— 不新造第二份 persona 定义。
# ════════════════════════════════════════════════


def persona_catalog() -> list[dict[str, Any]]:
    """对话内 Agent 选择器的目录投影(name / description / 工具白名单摘要)。

    单一出口:``/personas`` 与 ``/llm/personas`` 都调它,前端选择器与工具并入共用同一份
    ``PERSONAS_CONTRACTS`` —— D01 明令禁止第二份 persona 定义。
    """
    return [
        {
            "name": name,
            "description": contract.input_schema.get("description", ""),
            "tools": list(contract.tools),
        }
        for name, contract in PERSONAS_CONTRACTS.items()
    ]


def build_persona_chat_hint(persona: str) -> str | None:
    """对话内选中 persona 时追加到 system 尾部的 persona 说明;未知 persona 返回 None。"""
    contract = get_persona_contract(persona)
    if contract is None:
        return None
    required_in = ", ".join(contract.input_schema.get("required", [])) or "(none)"
    required_out = ", ".join(contract.output_schema.get("required", [])) or "(none)"
    tools = ", ".join(contract.tools) or "(none)"
    return (
        f"## Persona active: {persona}\n"
        f"The user selected the '{persona}' expert from the composer. Answer this "
        "conversation in that role.\n"
        f"- Input contract required fields: {required_in}\n"
        f"- Output contract required fields: {required_out}\n"
        f"- Preferred tools: {tools}\n"
        "Prefer the listed tools; do not claim results you did not verify."
    )


def merge_persona_tools(persona: str, agent_tools: list[str] | None) -> list[str] | None:
    """把 persona 白名单**并集**进本次工具清单(与 D09 merge_tools 同语义)。

    - 并集而非替换:调用方显式给的工具是用户意图,不能被选择器改写成另一张表。
    - 保持原顺序、去重:persona 工具排在调用方清单之后。
    - 未知 persona 原样返回(None 就还是 None,不因拼错 id 而突然给工具)。
    """
    contract = get_persona_contract(persona)
    if contract is None:
        return agent_tools
    merged = list(agent_tools or [])
    merged.extend(tool for tool in contract.tools if tool not in merged)
    return merged


# ════════════════════════════════════════════════
# G1 字典化闭环接入示例(G1 第 3 轮)
# 把"业务代号字典"与 persona 契约组合,作为 persona LLM 调用的 system prompt。
# 所有走此 helper 的 persona 调用自动获得:DEFAULT + 业务代号字典 + 项目记忆 + persona 契约摘要。
# ════════════════════════════════════════════════


def build_persona_system_prompt(persona: str, workspace_path: str | None = None) -> str | None:
    """构建 persona 专属 system prompt(自动注入业务代号字典 + 项目记忆 + persona 契约摘要)。

    Args:
        persona: persona 名称(researcher / coder / reviewer / architect / debugger)
        workspace_path: 工作区路径(None 时用 cwd)

    Returns:
        完整 system prompt;persona 不存在时返回 None
    """
    contract = get_persona_contract(persona)
    if contract is None:
        return None

    base = build_system_prompt(workspace_path=workspace_path)
    contract_summary = (
        f"## persona 契约:{persona}\n\n"
        f"**输入 schema**(required 字段):"
        f"{', '.join(contract.input_schema.get('required', [])) or '(无 required 字段)'}\n\n"
        f"**输出 schema**(required 字段):"
        f"{', '.join(contract.output_schema.get('required', [])) or '(无 required 字段)'}\n"
    )
    return f"{base}\n\n{contract_summary}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
