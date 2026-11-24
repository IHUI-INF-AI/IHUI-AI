# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""运行时分维导入:命名空间拆开、凭据不落结果、空和缺席可区分。"""

from __future__ import annotations

import json

from app.services.importers import parse_conversation_file
from app.services.importers.runtime_bundle import classify_runtime_bundle

_SECRET = "SUPERSECRETVALUE99"


def _bundle() -> bytes:
    payload = {
        "qoderWorkConversations": [
            {
                "title": "迁移过来的会话",
                "messages": [{"role": "user", "content": "你好"}],
                "apiKey": _SECRET,
            }
        ],
        "qoderWorkAutomationTasks": [
            {"name": "夜跑", "schedule": "0 2 * * *", "env": {"TOKEN": _SECRET}}
        ],
        "qoderWorkSkills": [
            {
                "name": "审查",
                "prompt": f"按清单审查。token={_SECRET}",
                "apiKey": _SECRET,
            }
        ],
        "qoderQuestMemory": [{"text": "用户偏好中文"}],
        "codex-capabilities": [{"name": "repo-read", "description": "只读仓库", "env": {"X": "1"}}],
        "billing": {"card": _SECRET},
        "automations": [{"name": "不该合并", "schedule": "0 0 * * *"}],
    }
    return json.dumps(payload, ensure_ascii=False).encode()


def test_known_namespaces_stay_in_their_own_dimensions() -> None:
    bundle = classify_runtime_bundle(_bundle())
    assert bundle is not None
    assert bundle.dimensions["conversations"] == "present"
    assert bundle.dimensions["automations"] == "present"
    assert bundle.dimensions["skills"] == "present"
    assert bundle.dimensions["memory"] == "present"
    assert bundle.dimensions["capabilities"] == "present"
    assert bundle.conversations[0].title == "迁移过来的会话"
    assert bundle.automations == [{"name": "夜跑", "trigger": "0 2 * * *"}]
    assert bundle.memory == [{"text": "用户偏好中文"}]
    assert bundle.capabilities[0]["name"] == "repo-read"
    assert "automations" in bundle.unrecognized
    assert "billing" in bundle.unrecognized
    assert any("未合并" in warning for warning in bundle.warnings)


def test_secret_values_never_appear_in_the_plan() -> None:
    bundle = classify_runtime_bundle(_bundle())
    assert bundle is not None
    dumped = json.dumps(bundle.as_runtime(), ensure_ascii=False)
    dumped += json.dumps(
        [
            {"title": item.title, "content": item.messages[0].content}
            for item in bundle.conversations
        ],
        ensure_ascii=False,
    )
    assert _SECRET not in dumped
    assert bundle.stripped_secrets >= 3
    assert "REDACTED" in bundle.skills[0]["prompt"] or _SECRET not in bundle.skills[0]["prompt"]


def test_absent_empty_and_invalid_are_distinct() -> None:
    payload = {
        "skills": [],
        "memory": "不是列表",
        "workbuddy-automations": [{"name": "备份", "cron": "0 3 * * *"}],
    }
    bundle = classify_runtime_bundle(json.dumps(payload).encode())
    assert bundle is not None
    assert bundle.dimensions["skills"] == "empty"
    assert bundle.dimensions["memory"] == "invalid"
    assert bundle.dimensions["conversations"] == "absent"
    assert bundle.dimensions["capabilities"] == "absent"
    assert bundle.automations == [{"name": "备份", "trigger": "0 3 * * *"}]


def test_plain_conversation_object_stays_with_the_chat_parser() -> None:
    payload = {"conversations": [{"messages": [{"role": "user", "content": "仅会话"}]}]}
    assert classify_runtime_bundle(json.dumps(payload).encode()) is None


def test_parse_route_shape_includes_runtime_without_the_secret() -> None:
    parsed, warnings, truncated = parse_conversation_file("codex", "bundle.json", _bundle())
    assert truncated is False
    assert parsed["conversations"][0]["messages"][0]["content"] == "你好"
    assert parsed["runtime"]["automations"][0]["name"] == "夜跑"
    assert _SECRET not in json.dumps(parsed, ensure_ascii=False)
    assert _SECRET not in json.dumps(warnings, ensure_ascii=False)


def test_automation_prompt_is_kept_separately_from_the_trigger() -> None:
    payload = {
        "codex-automations": [
            {"name": "日报", "schedule": "0 9 * * *", "prompt": f"汇总昨日。token={_SECRET}"},
            {"name": "只有时刻", "cron": "0 1 * * *"},
        ]
    }
    bundle = classify_runtime_bundle(json.dumps(payload).encode())
    assert bundle is not None
    assert bundle.automations[0]["trigger"] == "0 9 * * *"
    assert bundle.automations[0]["prompt"] != "0 9 * * *"
    assert _SECRET not in bundle.automations[0]["prompt"]
    assert "prompt" not in bundle.automations[1]


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
