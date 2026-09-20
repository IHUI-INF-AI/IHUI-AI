# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""环境上下文片段(批56 扩展,对标 codex context/world_state/environment.rs
+ context/environment_context.rs)。

批56 补齐(此前仅 cwd/current_date/timezone 三个子元素):
- <shell_version>:shell 版本字符串(可选,PowerShell 场景由调用方探测后传入)
- <network enabled="true"><allowed>a,b</allowed><denied>c</denied></network>
  (NetworkContext 渲染,allowed/denied 空则省略对应子元素)
- <filesystem><workspace_roots><root>…</root></workspace_roots>
  <permission_profile type="managed|disabled|external">…</permission_profile>
  </filesystem>(FileSystemContext 渲染)
- <subagents> 多行子代理上下文(- {ref}[: {nick}] 行)
- 多环境形态:>1 个环境时包 <environments><environment id="…" primary=…>,
  消失的环境渲染 <environment id="…" status="unavailable" />
- diff 语义:EnvironmentSnapshot 逐字段比较(shell_version/current_date/
  timezone/network/filesystem 任一变化即重渲染;子环境按 has_same_diff_value)

渲染格式逐行对齐 codex RenderedEnvironments::body():两空格缩进、
xml 五字符转义(& < > " ')、前导换行。可选元素缺省即省略
(push_optional_element 语义)。片段角色 = user,文本以 <environment_context>
开头,被 stream_events.USER_CONTEXTUAL_PREFIXES 归约集识别。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from xml.sax.saxutils import escape as _sax_escape

__all__ = [
    "ENVIRONMENT_CONTEXT_OPEN_TAG",
    "ENVIRONMENT_CONTEXT_CLOSE_TAG",
    "build_environment_context_fragment",
    "format_local_date",
    "is_environment_context_fragment",
    "EnvironmentStateTracker",
    "EnvironmentSnapshot",
    "NetworkContext",
    "FileSystemContext",
    "push_xml_escaped_text",
]

ENVIRONMENT_CONTEXT_OPEN_TAG = "<environment_context>"
ENVIRONMENT_CONTEXT_CLOSE_TAG = "</environment_context>"


def push_xml_escaped_text(rendered: list[str], value: str) -> None:
    """XML 五字符转义(对齐 codex push_xml_escaped_text:& < > " ')。"""
    for ch in value:
        if ch == "&":
            rendered.append("&amp;")
        elif ch == "<":
            rendered.append("&lt;")
        elif ch == ">":
            rendered.append("&gt;")
        elif ch == '"':
            rendered.append("&quot;")
        elif ch == "'":
            rendered.append("&apos;")
        else:
            rendered.append(ch)


def _esc(value: str) -> str:
    parts: list[str] = []
    push_xml_escaped_text(parts, value)
    return "".join(parts)


def _optional_element(name: str, value: str | None, indent: str = "  ") -> str:
    """push_optional_element 语义:None/空即省略。"""
    if not value:
        return ""
    return f"{indent}<{name}>{_esc(value)}</{name}>\n"


@dataclass
class NetworkContext:
    """网络策略上下文(对齐 codex NetworkContext;enabled 恒 true 语义)。"""

    allowed_domains: list[str] = field(default_factory=list)
    denied_domains: list[str] = field(default_factory=list)

    def render(self) -> str:
        rendered = '<network enabled="true">'
        if self.allowed_domains:
            rendered += f"<allowed>{','.join(self.allowed_domains)}</allowed>"
        if self.denied_domains:
            rendered += f"<denied>{','.join(self.denied_domains)}</denied>"
        rendered += "</network>"
        return rendered

    def render_line(self) -> str:
        return f"  {self.render()}\n"

    def diff_value(self) -> str:
        return self.render()


@dataclass
class FileSystemEntry:
    """文件系统沙箱条目(access=read|write|deny;path/glob/special 三选一)。"""

    access: str
    path: str | None = None
    glob: str | None = None
    special: str | None = None

    def render(self) -> str:
        rendered = f'<entry access="{_esc(self.access)}"'
        if self.access == "deny":
            rendered += ' escalatable="false"'
        rendered += ">"
        if self.path is not None:
            rendered += f"<path>{_esc(self.path)}</path>"
        elif self.glob is not None:
            rendered += f"<glob>{_esc(self.glob)}</glob>"
        elif self.special is not None:
            rendered += f"<special>{_esc(self.special)}</special>"
        rendered += "</entry>"
        return rendered


@dataclass
class FileSystemContext:
    """文件系统上下文(对齐 codex FileSystemContext)。"""

    workspace_roots: list[str] = field(default_factory=list)
    permission_profile_type: str = "managed"  # managed|disabled|external
    file_system_type: str = "unrestricted"  # restricted|unrestricted|external
    entries: list[FileSystemEntry] = field(default_factory=list)
    glob_scan_max_depth: int | None = None

    def render(self) -> str:
        rendered = "<filesystem>"
        if self.workspace_roots:
            rendered += "<workspace_roots>"
            for root in self.workspace_roots:
                rendered += f"<root>{_esc(root)}</root>"
            rendered += "</workspace_roots>"
        rendered += f'<permission_profile type="{_esc(self.permission_profile_type)}">'
        if self.permission_profile_type == "managed":
            if self.file_system_type == "restricted":
                if not self.entries and self.glob_scan_max_depth is None:
                    rendered += '<file_system type="restricted" />'
                else:
                    rendered += '<file_system type="restricted"'
                    if self.glob_scan_max_depth is not None:
                        rendered += f' glob_scan_max_depth="{self.glob_scan_max_depth}"'
                    rendered += ">"
                    for entry in self.entries:
                        rendered += entry.render()
                    rendered += "</file_system>"
            else:
                rendered += f'<file_system type="{_esc(self.file_system_type)}" />'
        elif self.permission_profile_type == "disabled":
            rendered += '<file_system type="unrestricted" />'
        elif self.permission_profile_type == "external":
            rendered += '<file_system type="external" />'
        rendered += "</permission_profile>"
        rendered += "</filesystem>"
        return rendered

    def render_line(self) -> str:
        return f"  {self.render()}\n"

    def diff_value(self) -> str:
        return self.render()


@dataclass
class EnvironmentSnapshot:
    """单环境快照(对齐 codex EnvironmentSnapshot;has_same_diff_value 语义)。"""

    cwd: str
    status: str = "available"  # starting|available|failed
    shell: str | None = None
    error: str | None = None
    is_primary: bool = False

    def has_same_diff_value(self, other: "EnvironmentSnapshot") -> bool:
        return (
            self.cwd == other.cwd
            and self.status == other.status
            and self.error == other.error
            and self.is_primary == other.is_primary
            and self.shell == other.shell
        )


def _render_environment_values(env: EnvironmentSnapshot, indent: str) -> str:
    rendered = f"{indent}<cwd>{_esc(env.cwd)}</cwd>\n"
    if env.status == "starting":
        rendered += f"{indent}<status>starting</status>\n"
    if env.status == "failed":
        rendered += f"{indent}<status>failed</status>\n"
    if env.error:
        rendered += f"{indent}<error>{_esc(env.error)}</error>\n"
    if env.shell:
        rendered += f"{indent}<shell>{_esc(env.shell)}</shell>\n"
    return rendered


def _render_environment_body(
    cwd: str,
    current_date: str | None,
    timezone: str | None,
    *,
    shell_version: str | None = None,
    network: NetworkContext | None = None,
    filesystem: FileSystemContext | None = None,
    subagents: str | None = None,
    environments: dict[str, EnvironmentSnapshot] | None = None,
) -> str:
    """渲染片段正文(对齐 RenderedEnvironments::body() 元素顺序)。

    多环境(environments 传入且 len>1)时子环境包 <environments>;
    单环境走 legacy 直排(仅 cwd 等基础值)。
    """
    rendered = "\n"
    if environments and len(environments) > 1:
        rendered += "  <environments>\n"
        for env_id, env in environments.items():
            rendered += f'    <environment id="{_esc(env_id)}"'
            if env.is_primary:
                rendered += ' primary="true"'
            else:
                rendered += ' primary="false"'
            if env.status == "unavailable":
                rendered += ' status="unavailable" />\n'
                continue
            rendered += ">\n"
            rendered += _render_environment_values(env, "      ")
            rendered += "    </environment>\n"
        rendered += "  </environments>\n"
    else:
        single = EnvironmentSnapshot(cwd=cwd)
        rendered += _render_environment_values(single, "  ")
    rendered += _optional_element("shell_version", shell_version)
    rendered += _optional_element("current_date", current_date)
    rendered += _optional_element("timezone", timezone)
    if network is not None:
        rendered += network.render_line()
    if filesystem is not None:
        rendered += filesystem.render_line()
    if subagents:
        rendered += "  <subagents>\n"
        for line in subagents.splitlines():
            rendered += f"    {line}\n"
        rendered += "  </subagents>\n"
    return rendered


def build_environment_context_fragment(
    cwd: str,
    current_date: str | None = None,
    timezone: str | None = None,
    *,
    shell_version: str | None = None,
    network: NetworkContext | None = None,
    filesystem: FileSystemContext | None = None,
    subagents: str | None = None,
    environments: dict[str, EnvironmentSnapshot] | None = None,
) -> dict[str, Any]:
    """构造环境上下文片段(user 角色、带标记;批56 扩展字段全部可选,缺省零差异)。"""
    body = _render_environment_body(
        cwd,
        current_date,
        timezone,
        shell_version=shell_version,
        network=network,
        filesystem=filesystem,
        subagents=subagents,
        environments=environments,
    )
    return {
        "type": "message",
        "role": "user",
        "content": [
            {
                "type": "input_text",
                "text": f"{ENVIRONMENT_CONTEXT_OPEN_TAG}{body}{ENVIRONMENT_CONTEXT_CLOSE_TAG}",
            }
        ],
    }


def format_local_date() -> str:
    """本地日期 YYYY-MM-DD(对标 read_clock_for_context("environment_date") 的
    with_timezone(Local).format("%Y-%m-%d") 语义)。"""
    return datetime.now().astimezone().strftime("%Y-%m-%d")


def is_environment_context_fragment(text: str) -> bool:
    """判断文本是否为环境上下文片段(供 contextual 归约集/裁剪逻辑使用)。"""
    return text.lstrip().startswith(ENVIRONMENT_CONTEXT_OPEN_TAG)


class EnvironmentStateTracker:
    """环境状态变化检测器(对标 world_state render_diff 的最小等价实现)。

    批56:maybe_fragment 接受全部扩展字段;与上次渲染体逐字节比较,
    仅变化时产出新片段。shell_version/current_date/timezone/network/
    filesystem/subagents 任一变化均触发重注入。
    """

    def __init__(self) -> None:
        self._last_rendered: str | None = None

    def reset(self) -> None:
        """重置记忆(压缩发生后调用:产物可能已不含早前片段,强制下次重注入)。"""
        self._last_rendered = None

    def maybe_fragment(
        self,
        cwd: str,
        current_date: str | None = None,
        timezone: str | None = None,
        *,
        shell_version: str | None = None,
        network: NetworkContext | None = None,
        filesystem: FileSystemContext | None = None,
        subagents: str | None = None,
        environments: dict[str, EnvironmentSnapshot] | None = None,
    ) -> dict[str, Any] | None:
        rendered = _render_environment_body(
            cwd,
            current_date,
            timezone,
            shell_version=shell_version,
            network=network,
            filesystem=filesystem,
            subagents=subagents,
            environments=environments,
        )
        if rendered == self._last_rendered:
            return None
        self._last_rendered = rendered
        return build_environment_context_fragment(
            cwd,
            current_date,
            timezone,
            shell_version=shell_version,
            network=network,
            filesystem=filesystem,
            subagents=subagents,
            environments=environments,
        )
