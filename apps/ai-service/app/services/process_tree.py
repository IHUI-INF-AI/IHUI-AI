# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""进程树清理 + 禁窗启动标志(2026-10-05 机主拍板④,承 G-998124 票4)。

拍板纪律(G-1058610 ④):
- **不引入新运行时依赖**(禁 psutil 一类);进程树用**系统自带工具**取:
  Windows = `taskkill /PID <pid> /T /F`,POSIX = 进程组 `os.killpg`(退化 `os.kill`)。
- **禁窗形态按语言分**:Python 侧是 `CREATE_NO_WINDOW`(asyncio/Popen 的
  `creationflags`),Node 侧才是 `windowsHide` —— 两者不可互抄,照抄必 TypeError。

语义约定:
- `kill_process_tree` 是**清理兜底路径**,幂等安全:目标已死 / 无权限 / 工具
  不存在都只记 warning 不抛 —— 清理路径上抛错会盖掉调用方的主异常。
"""

import asyncio
import logging
import os
import signal
import subprocess

logger = logging.getLogger(__name__)

# Windows 专用启动标志:给子进程不分配控制台窗口。
# 非 Windows 平台恒为 0(creationflags 参数传 0 无副作用,POSIX 下亦可安全传)。
CREATE_NO_WINDOW: int = getattr(subprocess, "CREATE_NO_WINDOW", 0)


async def kill_process_tree(pid: int) -> None:
    """强制终止整个进程树(幂等,绝不抛)。

    Windows 走系统自带 taskkill(/T 连树、/F 强制);POSIX 优先杀进程组,
    拿不到组再退化为单进程 SIGKILL。
    """
    if pid <= 0:
        return
    # POSIX 系统调用(os.getpgid/os.kill)的 pid 形参是 C int;超过 INT_MAX 的 pid
    # 在 raise 系统调用前就被 CPython 以 OverflowError 拒掉,而清理路径的契约是
    # "幂等,绝不抛"(CI run 38084051334 实证:kill_process_tree(4_000_000_000) 在
    # Linux 上抛 OverflowError)。这种 pid 必不存在 ⇒ 与"已死 pid"同档,直接幂等返回。
    if pid > 0x7FFFFFFF:
        return
    if os.name == "nt":
        try:
            proc = await asyncio.create_subprocess_exec(
                "taskkill",
                "/PID",
                str(pid),
                "/T",
                "/F",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
                creationflags=CREATE_NO_WINDOW,
            )
            await proc.wait()
            # rc 128 = "找不到该进程" —— 目标已死,幂等成功而非失败。
            if proc.returncode not in (0, 128):
                logger.warning(
                    "taskkill 树杀未完全成功 pid=%s rc=%s(已忽略,清理路径不抛)",
                    pid,
                    proc.returncode,
                )
        except OSError as e:
            logger.warning("taskkill 启动失败 pid=%s: %s(清理路径不抛)", pid, e)
        return
    # POSIX:先按进程组杀(子进程同组时整组退场),拿不到组再单杀。
    # os.getpgid/killpg 是 POSIX-only,Windows 的 mypy 存根没有 —— 静态存根缺位,非真错误。
    try:
        pgid = os.getpgid(pid)  # type: ignore[attr-defined, unused-ignore]
    except ProcessLookupError:
        return
    except OSError:
        pgid = None
    try:
        if pgid:
            os.killpg(pgid, signal.SIGKILL)  # type: ignore[attr-defined, unused-ignore]
        else:
            os.kill(pid, signal.SIGKILL)  # type: ignore[attr-defined, unused-ignore]
    except ProcessLookupError:
        pass
    except OSError as e:
        logger.warning("killpg/kill 失败 pid=%s: %s(清理路径不抛)", pid, e)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
