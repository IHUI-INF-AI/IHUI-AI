# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/shell_snapshot.py
"""Shell 环境快照(2026-09-19 第二十八批,对标 Codex shell_snapshot.rs + shell_snapshot_capture.rs)。

捕获用户真实 shell(bash/zsh/sh)登录环境——profile 加的 PATH、别名、函数、
shopt/set -o 状态——生成可 source 的快照脚本,供工具执行时重建"用户的 shell":

- **三段捕获协议**(对标 bash_snapshot_script):state(函数+set -o+shopt)
  → ``\\0`` → aliases(带计数)→ ``\\0`` → 环境快照(``env -0`` NUL 分隔,
  值可含换行不失真);
- **冲突防护**:快照首行 ``unalias -a``(先清别名,防与同名函数冲突,Codex 同款);
- **交互状态注入**:登录模式下先 source ``$HOME/.bashrc``(对标 shell_startup_script);
- **原子落盘**:tmp 写入 → 解析校验 → rename 定稿;会话级陈旧快照清理
  (对标 cleanup_stale_snapshots);
- **密钥保护**:名称匹配 KEY/SECRET/TOKEN(大小写不敏感,复用 exec_env 模式)
  的环境变量不写入快照正文,单独作为凭据返回,由调用方在执行时按策略还原
  (对标 Codex credential broker 的"凭据不落快照"原则);
- **profile 覆盖检测**:与父进程环境差分,标出 profile 修改/新增的键
  (对标 protected_startup_env 的"启动环境被 profile 覆盖"语义);
- **执行环境合成**:``build_exec_env`` 用快照环境覆盖基础环境,再过
  exec_env.ShellEnvironmentPolicy 六步过滤——与第二十六批模块组合复用。
"""

from __future__ import annotations

import os
import shlex
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

SNAPSHOT_TIMEOUT_SECS = 15.0
SNAPSHOT_DIRNAME = "shell-snapshots"

_SNAPSHOT_HEADER = "# Snapshot file"
_COMMAND_HELPER = """__ihui_snapshot_command() {
  if command -v "$1" >/dev/null 2>&1; then
    "$@"
  else
    command -p "$@"
  fi
}"""

_BASH_STARTUP_PREFIX = """if [ -z "${BASH_ENV-}" ] && [ -n "${HOME-}" ] && [ -r "$HOME/.bashrc" ]; then
  . "$HOME/.bashrc"
fi
"""

_ENV_DUMP = """if command -v env >/dev/null 2>&1; then
  "env" -0
else
  "$(PATH="$(command -p getconf PATH)" command -v env)" -0
fi
"""


def bash_snapshot_capture_script(interactive: bool = True) -> str:
    """生成 bash 登录环境捕获脚本(对标 bash_snapshot_script,三段 + NUL 分隔)。"""
    startup = _BASH_STARTUP_PREFIX if interactive else ""
    script = f"""{_COMMAND_HELPER}
{startup}echo '{_SNAPSHOT_HEADER}'
echo '# Unset all aliases to avoid conflicts with functions'
echo 'unalias -a 2>/dev/null || true'
shopt -p || true
echo '# Functions'
declare -f
echo ''
bash_opts=$(set -o | __ihui_snapshot_command awk '$2=="on"{{print $1}}')
bash_opt_count=$(printf '%s\\n' "$bash_opts" | __ihui_snapshot_command sed '/^$/d' | __ihui_snapshot_command wc -l | __ihui_snapshot_command tr -d ' ')
echo "# setopts $bash_opt_count"
if [ -n "$bash_opts" ]; then
  printf 'set -o %s\\n' $bash_opts
fi
echo ''
printf '\\0'
alias_count=$(alias -p | __ihui_snapshot_command wc -l | __ihui_snapshot_command tr -d ' ')
echo "# aliases $alias_count"
alias -p
echo ''
printf '\\0'
{_ENV_DUMP}"""
    return script


@dataclass
class ShellSnapshotData:
    """解析后的快照内容。"""

    shell_state: str = ""  # 函数/set -o/shopt 重建文本(直接 source)
    aliases: str = ""  # alias -p 输出
    env: dict[str, str] = field(default_factory=dict)
    profile_overwritten_keys: list[str] = field(default_factory=list)
    profile_added_keys: list[str] = field(default_factory=list)


@dataclass
class ShellSnapshotFile:
    """定稿快照(对标 ShellSnapshotFile)。"""

    path: str
    data: ShellSnapshotData
    credential_keys: list[str] = field(default_factory=list)

    def is_credential(self, key: str) -> bool:
        return key in self.credential_keys


def parse_snapshot(raw: bytes, parent_env: dict[str, str] | None = None) -> ShellSnapshotData | None:
    """解析捕获输出:state NUL aliases NUL (KEY=VALUE NUL)*。

    容错:缺首段标记返回 None(校验失败语义);env 段缺 NUL 结尾也接受
    (真实 shell 可能截尾)。profile 差分:与 parent_env 比较。
    """
    if not raw:
        return None
    parts = raw.split(b"\0")
    if len(parts) < 3:
        return None
    state_b, aliases_b = parts[0], parts[1]
    env_records = parts[2:]
    if _SNAPSHOT_HEADER.encode() not in state_b:
        return None

    env: dict[str, str] = {}
    for record in env_records:
        if not record:
            continue
        try:
            entry = record.decode("utf-8")
        except UnicodeDecodeError:
            continue
        if "=" not in entry:
            continue
        key, _, value = entry.partition("=")
        if not key:
            continue
        env[key] = value

    data = ShellSnapshotData(
        shell_state=state_b.decode("utf-8", errors="replace"),
        aliases=aliases_b.decode("utf-8", errors="replace"),
        env=env,
    )
    if parent_env is not None:
        for key, value in env.items():
            if key not in parent_env:
                data.profile_added_keys.append(key)
            elif parent_env.get(key) != value:
                data.profile_overwritten_keys.append(key)
    return data


def is_secret_env_key(key: str) -> bool:
    """KEY/SECRET/TOKEN 大小写不敏感匹配(与 exec_env 默认排除一致)。"""
    upper = key.upper()
    return any(m in upper for m in ("KEY", "SECRET", "TOKEN"))


def cleanup_stale_snapshots(snapshot_dir: Path, session_id: str) -> int:
    """清理本会话泄漏的快照/临时文件(Codex cleanup_stale_snapshots 对应)。"""
    removed = 0
    if not snapshot_dir.is_dir():
        return 0
    for p in snapshot_dir.iterdir():
        if not p.is_file():
            continue
        if p.name.startswith(f"{session_id}.") and (
            p.name.endswith(".sh") or ".tmp-" in p.name
        ):
            try:
                p.unlink()
                removed += 1
            except OSError:
                pass
    return removed


def capture_shell_snapshot(
    shell: str,
    cwd: str,
    snapshot_dir: str,
    session_id: str,
    parent_env: dict[str, str] | None = None,
    interactive: bool = True,
    timeout: float = SNAPSHOT_TIMEOUT_SECS,
) -> ShellSnapshotFile | None:
    """捕获→校验→原子落盘;失败返回 None(快照绝不阻塞主流程)。

    Args:
        shell: shell 可执行名/路径(如 "bash")
        cwd: 捕获工作目录
        snapshot_dir: 快照存放目录
        session_id: 会话标识(用于文件名与陈旧清理)
        parent_env: 父进程环境(差分用;默认取当前进程)
    """
    script = bash_snapshot_capture_script(interactive=interactive)
    parent_env = dict(parent_env) if parent_env is not None else dict(os.environ)
    try:
        proc = subprocess.run(
            [shell, "-lc", script],
            cwd=cwd,
            capture_output=True,
            timeout=timeout,
            env=_snapshot_spawn_env(parent_env),
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0 and not proc.stdout:
        return None
    data = parse_snapshot(proc.stdout, parent_env)
    if data is None:
        return None

    dir_path = Path(snapshot_dir)
    try:
        dir_path.mkdir(parents=True, exist_ok=True)
    except OSError:
        return None
    nonce = time.time_ns()
    final_path = dir_path / f"{session_id}.{nonce}.sh"
    tmp_path = dir_path / f"{session_id}.tmp-{nonce}"

    rendered = render_snapshot_script(data)
    try:
        tmp_path.write_text(rendered, encoding="utf-8", newline="\n")
        # 校验:回读非空且含头标记
        check = tmp_path.read_text(encoding="utf-8")
        if _SNAPSHOT_HEADER not in check:
            tmp_path.unlink(missing_ok=True)
            return None
        os.replace(tmp_path, final_path)
    except OSError:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
        return None

    credential_keys = sorted(k for k in data.env if is_secret_env_key(k))
    return ShellSnapshotFile(
        path=str(final_path), data=data, credential_keys=credential_keys
    )


def render_snapshot_script(data: ShellSnapshotData, redact_secrets: bool = True) -> str:
    """渲染可 source 的快照脚本(密钥键不写入正文)。"""
    lines = [
        _SNAPSHOT_HEADER,
        "# Unset all aliases to avoid conflicts with functions",
        "unalias -a 2>/dev/null || true",
        data.shell_state,
        data.aliases,
    ]
    for key, value in sorted(data.env.items()):
        if redact_secrets and is_secret_env_key(key):
            continue
        quoted = shlex.quote(value)
        lines.append(f"export {key}={quoted}")
    return "\n".join(lines) + "\n"


def snapshot_env_for_exec(
    snapshot: ShellSnapshotFile,
    base_env: dict[str, str],
    exclude_secrets: bool = True,
) -> dict[str, str]:
    """合成执行环境:快照环境覆盖基础环境(凭据键按需排除)。

    凭据键由调用方按安全策略显式还原(对标 restore_credentials);
    本函数默认不带凭据,防止泄入不相关子进程。
    """
    merged = dict(base_env)
    for key, value in snapshot.data.env.items():
        if exclude_secrets and key in snapshot.credential_keys:
            continue
        merged[key] = value
    return merged


def _snapshot_spawn_env(parent_env: dict[str, str]) -> dict[str, str]:
    """捕获子进程自身的环境:剥离凭据型变量,防 profile 内的命令读到密钥。"""
    return {k: v for k, v in parent_env.items() if not is_secret_env_key(k)}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
