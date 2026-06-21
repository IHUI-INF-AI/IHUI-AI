"""Agent JSON 规范化工具.

迁移自 ZHS_Server_java/small/service/agent/AgentJsonHelper.java.
"""

import json
from typing import Any


def normalize(element: Any) -> Any:
    """规范化 JSON 元素:null/空字符串处理、字符串形式的 JSON 解析."""
    if element is None:
        return None
    if isinstance(element, str):
        s = element.strip()
        if not s:
            return None
        if (s.startswith("{") and s.endswith("}")) or (s.startswith("[") and s.endswith("]")):
            try:
                return json.loads(s)
            except json.JSONDecodeError:
                return s
        return s
    return element


def parse_array(json_str: str | None, field_name: str = "field") -> list[dict[str, Any]]:
    """解析 JSON 数组:支持 array/object 两种输入格式."""
    if not json_str or not json_str.strip():
        return []
    try:
        parsed = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"{field_name} contains invalid JSON: {e}") from e
    if isinstance(parsed, list):
        return [p for p in parsed if isinstance(p, dict)]
    if isinstance(parsed, dict):
        if "parameterName" in parsed:
            return [parsed]
        result = []
        for k, v in parsed.items():
            result.append({"parameterName": k, "content": v})
        return result
    raise ValueError(f"{field_name} must be a JSON array or object")


def append_string_value(target: dict[str, Any], key: str, value: str) -> None:
    """追加字符串值:存在则转为数组,不存在则添加."""
    if target is None or key is None or value is None:
        return
    if key not in target:
        target[key] = value
        return
    existing = target[key]
    if isinstance(existing, list):
        existing.append(value)
    else:
        target[key] = [existing, value]
