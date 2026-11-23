# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型可见的文件沙箱策略块(对齐 DSH `dsh-sandbox-policy` 的 `sandbox:policy` 贡献)。

DSH 在每个模型请求的运行时上下文快照里放一段当前文件策略,说明:
- 当前模式(read-only / workspace-write / danger-full-access);
- `workspace-write` 下的会话工作区绝对路径;
- 显式授权的额外可写目录。

本仓已有 `SandboxPolicy` / `permission_mode` 作为执行面真源,但模型此前看不到
这些边界,只能在工具被拒后反推。这里只做**只读呈现**,不改变任何执行判定:
执行面仍由 permission_mode、path_guard、patch_safety 各自裁决。

纪律:
- 块用固定标记包裹,同一 system 消息内只保留一份;
- 策略没变时幂等不重复追加,策略变了原地替换旧块;
- 非 git / 无工作区 / 异常一律不注入,零行为变化。
"""

from __future__ import annotations

import re
from collections.abc import Iterable

SANDBOX_POLICY_OPEN = "<!-- IHUI-SANDBOX-POLICY -->"
SANDBOX_POLICY_CLOSE = "<!-- /IHUI-SANDBOX-POLICY -->"

_BLOCK_RE = re.compile(
    re.escape(SANDBOX_POLICY_OPEN) + r".*?" + re.escape(SANDBOX_POLICY_CLOSE),
    re.DOTALL,
)


def _policy_mode(permission_mode: str | None) -> str:
    """把权限模式映射为 DSH 的三档文件策略名。"""
    try:
        from app.core.permission_mode import normalize_permission_mode

        mode = normalize_permission_mode(permission_mode or "default")
    except Exception:
        mode = permission_mode or "default"
    if mode == "plan":
        return "read-only"
    if mode == "bypassPermissions":
        return "danger-full-access"
    return "workspace-write"


def render_sandbox_policy_context(
    permission_mode: str | None,
    workspace: str | None,
    extra_roots: Iterable[str] = (),
) -> str:
    """生成一段模型可见的文件策略块;无工作区时返回空串。"""
    root = (workspace or "").strip()
    if not root:
        return ""
    policy = _policy_mode(permission_mode)
    roots = [r.strip() for r in extra_roots if isinstance(r, str) and r.strip()]
    if policy == "read-only":
        body = (
            "当前文件策略:只读。受本策略约束的工具不能修改会话工作区内的文件;"
            "需要修改时先按工具返回的拒绝/升权指引申请更宽权限,不要仅凭本策略直接拒绝任务。"
        )
    elif policy == "danger-full-access":
        body = (
            "当前文件策略:完全访问。受本策略约束的可用操作不限制文件修改;"
            "仍须遵守用户指令与工具自身的路径护栏。"
        )
    else:
        body = (
            f'当前文件策略:工作区写入。受本策略约束的工具可修改会话工作区内的文件:"{root}"。'
        )
        if roots:
            quoted = ", ".join(f'"{r}"' for r in roots)
            body += f"额外可写目录:[{quoted}]。"
        body += (
            "工作区外路径被拒绝时,按工具返回的拒绝/升权指引处理,不要自行绕过。"
        )
    return f"{SANDBOX_POLICY_OPEN}\n{body}\n{SANDBOX_POLICY_CLOSE}"


def inject_sandbox_policy_context(
    messages: list[dict[str, object]], block: str
) -> bool:
    """把策略块放进首条 system 消息;重复调用幂等,策略变化时原地替换。

    返回是否发生改动。``block`` 为空时不做任何事。
    """
    if not block:
        return False
    target: dict[str, object] | None = None
    for msg in messages:
        if (
            isinstance(msg, dict)
            and msg.get("role") == "system"
            and SANDBOX_POLICY_OPEN in str(msg.get("content") or "")
        ):
            target = msg
            break
    if target is not None:
        content = str(target.get("content") or "")
        if block in content:
            return False
        cleaned = _BLOCK_RE.sub("", content).strip()
        target["content"] = f"{cleaned}\n\n{block}" if cleaned else block
        # 同一条/其它 system 里残留的旧块一并清掉,只保留新块。
        for msg in messages:
            if msg is target or not isinstance(msg, dict) or msg.get("role") != "system":
                continue
            other = str(msg.get("content") or "")
            if SANDBOX_POLICY_OPEN in other:
                msg["content"] = _BLOCK_RE.sub("", other).strip()
        return True
    if (
        messages
        and isinstance(messages[0], dict)
        and messages[0].get("role") == "system"
    ):
        existing = str(messages[0].get("content") or "")
        messages[0]["content"] = f"{existing}\n\n{block}" if existing else block
    else:
        messages.insert(0, {"role": "system", "content": block})
    return True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
