"""
Skills + Hooks 系统 — 对标 Claude Code。

Skills: .claude/skills/<name>/SKILL.md, 按需加载, frontmatter 元数据
Hooks: .claude/settings.json hooks 键, 生命周期事件 (PreToolUse/PostToolUse/...)

对标 Claude Code 四大定制机制:
- CLAUDE.md (记忆) → memory.py
- Hooks (硬约束) → 本文件
- Skills (按需流程) → 本文件
- Subagents (隔离分工) → agent_loop.py 的独立上下文
"""

from __future__ import annotations

import asyncio
import json
import subprocess
from pathlib import Path
from typing import Any

from app.api.v1.workspace.schemas import SkillMeta


# ---------------------------------------------------------------------------
# Skills 系统
# ---------------------------------------------------------------------------

def discover_skills(workspace_path: str) -> list[SkillMeta]:
    """发现工作区中的所有 Skill。

    查找位置:
    1. .claude/skills/<name>/SKILL.md (项目级, 进版本库)
    2. ~/.ihui/skills/<name>/SKILL.md (用户级, 跨项目)

    三层渐进披露:
    1. description 常驻上下文 (写清"何时使用")
    2. 正文在调用时加载
    3. references/ 等支撑文件按需读取
    """
    workspace = Path(workspace_path).resolve()
    skills: list[SkillMeta] = []

    for base in [workspace / ".claude" / "skills", Path.home() / ".ihui" / "skills"]:
        if not base.is_dir():
            continue
        for skill_dir in sorted(base.iterdir()):
            if skill_dir.is_dir():
                skill = _load_skill(skill_dir)
                if skill:
                    skills.append(skill)
    return skills


def _load_skill(skill_dir: Path) -> SkillMeta | None:
    """加载单个 Skill 元数据 (仅 frontmatter, 不加载正文)。"""
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        return None
    content = skill_file.read_text(encoding="utf-8", errors="replace")
    fm, _body = _parse_frontmatter(content)
    return SkillMeta(
        name=fm.get("name", skill_dir.name),
        description=fm.get("description", ""),
        disable_model_invocation=fm.get("disable-model-invocation", "false").lower() == "true",
        allowed_tools=_parse_list(fm.get("allowed-tools")),
        context=fm.get("context", "main"),  # main | fork
        model=fm.get("model"),
        body_path=str(skill_file),
    )


def get_skill_body(skill_meta: SkillMeta) -> str:
    """按需加载 Skill 正文 (仅在调用时, 省 token)。"""
    if not skill_meta.body_path:
        return ""
    p = Path(skill_meta.body_path)
    if not p.exists():
        return ""
    _, body = _parse_frontmatter(p.read_text(encoding="utf-8", errors="replace"))
    return body


def get_skill_references(skill_meta: SkillMeta) -> dict[str, str]:
    """加载 Skill 的 references/ 支撑文件。"""
    if not skill_meta.body_path:
        return {}
    refs_dir = Path(skill_meta.body_path).parent / "references"
    if not refs_dir.is_dir():
        return {}
    refs: dict[str, str] = {}
    for ref_file in refs_dir.rglob("*.md"):
        rel = ref_file.relative_to(refs_dir)
        refs[str(rel)] = ref_file.read_text(encoding="utf-8", errors="replace")
    return refs


def create_skill(workspace_path: str, name: str, description: str, body: str) -> bool:
    """创建新 Skill。"""
    try:
        d = Path(workspace_path).resolve() / ".claude" / "skills" / name
        d.mkdir(parents=True, exist_ok=True)
        content = f"---\nname: {name}\ndescription: {description}\n---\n\n{body}\n"
        (d / "SKILL.md").write_text(content, encoding="utf-8")
        return True
    except Exception:
        return False


def delete_skill(workspace_path: str, name: str) -> bool:
    """删除 Skill。"""
    try:
        import shutil
        d = Path(workspace_path).resolve() / ".claude" / "skills" / name
        if d.exists():
            shutil.rmtree(d)
            return True
        return False
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Hooks 系统 — 对标 Claude Code Hooks (唯一的硬约束层)
# ---------------------------------------------------------------------------

HOOK_EVENTS = [
    "PreToolUse",      # 工具调用前 (可阻断)
    "PostToolUse",     # 工具成功后 (可反馈)
    "SessionStart",    # 会话开始
    "SessionEnd",      # 会话结束
    "UserPromptSubmit", # 用户提交提示词后 (可清除)
    "Stop",            # Agent 准备结束回合 (可阻止)
    "PreCompact",      # 上下文压缩前 (可阻断)
    "PostCompact",     # 上下文压缩后
    "SubagentStart",   # 子代理启动
    "SubagentStop",    # 子代理结束
]


def load_hooks(workspace_path: str) -> list[dict[str, Any]]:
    """加载工作区 Hooks 配置。

    从 .claude/settings.json 的 hooks 键读取。
    """
    workspace = Path(workspace_path).resolve()
    sf = workspace / ".claude" / "settings.json"
    if not sf.exists():
        return []
    try:
        settings = json.loads(sf.read_text(encoding="utf-8"))
        hooks_cfg = settings.get("hooks", {})
        result: list[dict[str, Any]] = []
        for event, handlers in hooks_cfg.items():
            if event not in HOOK_EVENTS:
                continue
            for handler in handlers:
                matcher = handler.get("matcher", "")
                for h in handler.get("hooks", []):
                    result.append({
                        "event": event,
                        "matcher": matcher,
                        "type": h.get("type", "command"),
                        "command": h.get("command"),
                        "url": h.get("url"),
                    })
        return result
    except Exception:
        return []


async def execute_hook(
    event: str,
    hook_config: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    """执行单个 Hook。

    Args:
        event: 事件名 (PreToolUse/PostToolUse/...)
        hook_config: Hook 配置 (type/command/url)
        context: 上下文 (tool_name/tool_input/prompt 等)

    Returns:
        {"allow": bool, "feedback": str}
        - allow=False 时阻断操作 (PreToolUse 中拦截工具调用)
        - feedback 反馈给 Agent

    exit code 语义 (command 类型):
        0 = 放行 (stdout 可输出 JSON 决策)
        2 = 阻断 (stderr 反馈给 Agent)
        1 = 非阻断错误 (执行照常)
    """
    ht = hook_config.get("type", "command")

    if ht == "command":
        cmd = hook_config.get("command", "")
        if not cmd:
            return {"allow": True, "feedback": ""}
        try:
            proc = await asyncio.to_thread(
                subprocess.run, cmd,
                input=json.dumps(context),
                capture_output=True, text=True, timeout=10, shell=True,
            )
            if proc.returncode == 0:
                # 尝试解析 JSON 决策
                try:
                    decision = json.loads(proc.stdout)
                    return {
                        "allow": decision.get("permissionDecision", "allow") != "deny",
                        "feedback": decision.get("feedback", ""),
                    }
                except json.JSONDecodeError:
                    return {"allow": True, "feedback": proc.stdout[:500]}
            elif proc.returncode == 2:
                return {"allow": False, "feedback": proc.stderr[:500]}
            else:
                return {"allow": True, "feedback": ""}
        except subprocess.TimeoutExpired:
            return {"allow": False, "feedback": "Hook 超时"}
        except Exception as e:
            return {"allow": True, "feedback": f"Hook 错误: {e}"}

    elif ht == "http":
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(hook_config.get("url", ""), json=context)
                d = r.json()
                return {"allow": d.get("allow", True), "feedback": d.get("feedback", "")}
        except Exception as e:
            return {"allow": True, "feedback": f"HTTP Hook 错误: {e}"}

    elif ht == "prompt":
        # prompt 类型 hook: 在 LLM context 中插入额外指令 (不阻断, 仅注入)
        # 配置: {"prompt": "请始终使用 TypeScript strict mode"}
        extra_prompt = hook_config.get("prompt", "")
        if extra_prompt:
            return {"allow": True, "feedback": extra_prompt}
        return {"allow": True, "feedback": ""}

    return {"allow": True, "feedback": ""}


async def run_hooks(
    workspace_path: str,
    event: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    """运行指定事件的所有 Hook。

    Returns:
        {"allow": bool, "feedback": str}
        任一 Hook 阻断则整体阻断。
    """
    hooks = load_hooks(workspace_path)
    relevant = [h for h in hooks if h["event"] == event]

    # matcher 过滤 (仅 PreToolUse/PostToolUse)
    tool_name = context.get("tool_name", "")
    if event in ("PreToolUse", "PostToolUse") and tool_name:
        relevant = [
            h for h in relevant
            if not h["matcher"] or h["matcher"] == "*" or tool_name == h["matcher"]
        ]

    for h in relevant:
        result = await execute_hook(event, h, context)
        if not result["allow"]:
            return result  # 阻断, 不继续执行后续 Hook

    return {"allow": True, "feedback": ""}


# ---------------------------------------------------------------------------
# 辅助
# ---------------------------------------------------------------------------

def _parse_frontmatter(content: str) -> tuple[dict[str, Any], str]:
    """解析 YAML frontmatter (--- 分隔)。"""
    if not content.startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    fm_text = parts[1].strip()
    body = parts[2].strip()
    result: dict[str, Any] = {}
    for line in fm_text.split("\n"):
        line = line.strip()
        if ":" in line:
            k, v = line.split(":", 1)
            result[k.strip()] = v.strip().strip("\"'")
    return result, body


def _parse_list(value: str | None) -> list[str] | None:
    """解析逗号分隔的列表。"""
    if not value:
        return None
    return [v.strip() for v in value.split(",") if v.strip()]
