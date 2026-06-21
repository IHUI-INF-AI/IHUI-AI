"""Agent 输入 payload 构建器.

迁移自 ZHS_Server_java/small/service/agent/AgentPayloadBuilder.java.
"""

from collections import defaultdict
from typing import Any

from app.services.agent_upload.agent_json_helper import normalize, parse_array


def build_input_params(agent: Any, raw_problems: str | None) -> dict[str, Any]:
    """根据 agent 配置的变量和用户 problems 构建输入参数."""
    if agent is None:
        raise ValueError("Agent must not be null")
    safe_problems_json = raw_problems if raw_problems and raw_problems.strip() else "[]"
    problems_array = parse_array(safe_problems_json, "problems")
    variables_in_str = getattr(agent, "agent_variables_in", None) or "[]"
    variables_in_array = parse_array(variables_in_str, "agentVariablesIn")

    param_value_map: dict[str, list[Any]] = defaultdict(list)
    for problem in problems_array:
        target_param = problem.get("parameterName", "")
        if not target_param:
            continue
        variable_obj = next(
            (v for v in variables_in_array if v.get("parameterName") == target_param),
            None,
        )
        raw_content = problem.get("content")
        normalized = normalize(raw_content)
        if normalized is None or normalized == "":
            default = variable_obj.get("default") if variable_obj else None
            if default is not None:
                if isinstance(default, list) and default:
                    normalized = normalize(default[0])
                else:
                    normalized = normalize(default)
        if normalized is None:
            normalized = None
        param_value_map[target_param].append(normalized)

    input_params: dict[str, Any] = {}
    for param_name, values in param_value_map.items():
        if not values:
            input_params[param_name] = None
            continue
        if len(values) == 1:
            input_params[param_name] = values[0]
        else:
            input_params[param_name] = values
    return input_params
