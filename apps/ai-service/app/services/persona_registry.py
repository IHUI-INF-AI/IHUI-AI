"""Persona contracts registry — 对齐 apps/cli/src/personas/contracts.ts。

5 个 persona: researcher / coder / reviewer / architect / debugger。
每个 persona 声明 input_schema / output_schema(JSON Schema 子集),
让 AI-Service 暴露与 CLI 一致的契约给前端。
"""

from dataclasses import dataclass


@dataclass
class PersonaContract:
    """Persona 输入/输出契约。"""

    input_schema: dict
    output_schema: dict


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
    ),
}


def get_persona_contract(persona: str) -> PersonaContract | None:
    """按名称获取 persona 契约,不存在返回 None。"""
    return PERSONAS_CONTRACTS.get(persona)


def list_persona_names() -> list[str]:
    """列出全部 persona 名称。"""
    return list(PERSONAS_CONTRACTS.keys())
