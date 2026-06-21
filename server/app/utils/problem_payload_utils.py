"""problem 字段规范化工具.

迁移自 ZHS_Server_java/small/util/ProblemPayloadUtils.java.
"""

import json
from typing import Any


def normalize_problems(payload: Any) -> list[dict[str, Any]]:
    """将 problem 字段规范化为数组格式.

    支持的输入:
        - list: 已为数组, 直接返回 list[dict]
        - dict: 单个对象, 包装为 [{"parameterName": ..., "content": ...}]
        - str: JSON 字符串, 解析后递归
        - None: 返回空数组
    """
    if payload is None:
        return []
    if isinstance(payload, list):
        return [p for p in payload if isinstance(p, dict)]
    if isinstance(payload, dict):
        if "parameterName" in payload:
            return [payload]
        result = []
        for k, v in payload.items():
            result.append({"parameterName": k, "content": v})
        return result
    if isinstance(payload, str):
        s = payload.strip()
        if not s:
            return []
        try:
            return normalize_problems(json.loads(s))
        except json.JSONDecodeError:
            return [{"content": s}]
    return []


def to_payload_json(problems: list[dict[str, Any]]) -> str:
    """将 problem 数组序列化为 JSON 字符串."""
    return json.dumps(normalize_problems(problems), ensure_ascii=False)
