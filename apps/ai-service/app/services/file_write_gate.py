# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""file_write_gate — 同文件写冲突治理门(票78「同文件写冲突治理:串行化」档)。

背景(mcp_server 三个写工具 write_file / file_edit / resolve_conflict):
- 多智能体并行子模式(agent_orchestrator.run_parallel,asyncio.gather 同进程并发)
  下,两个并行 agent 写同一文件时:file_edit / resolve_conflict 有 3-way base
  检测兜底,而 write_file 是整文件覆盖、写前无任何基线比对 → 盲覆盖丢改动。
- 本门提供两道治理,算法本体只在这一处实现(调用方只接线,不各写一份):
  1) per-path 进程内 asyncio 互斥锁 get_path_write_lock:同一 resolved_path 的
     写段互斥(键 normcase+normpath,Windows 大小写不敏感)。run_parallel 的
     并发是同进程协程,进程内锁完全覆盖真实并发面。
  2) 写前基线漂移判定 classify_write_conflict(纯函数,五态):
       no-baseline — base 无记录(新文件/首次写)→ 放行
       clean       — 现盘 == base → 放行
       equivalent  — 现盘 == 拟写内容(幂等重写)→ 放行
       undecidable — 现盘读不了(二进制/权限)→ 放行(判不了不判死,如实上报)
       drifted     — 现盘 ≠ base 且 ≠ 拟写 → 并发修改,拦截(除非调用方 force)
- 注入式纪律(对齐 scripts/lib/stale-lock-claim.mjs):本模块不 import 任何
  app 模块、无 console、不碰 git;base 存储权威仍在 mcp_server._FILE_BASE_CONTENT,
  调用点把 disk / baseline / intended 三份 LF 归一化内容传进来。
"""

from __future__ import annotations

import asyncio
import os

# per-path 锁注册表:键 = normcase(normpath(resolved_path))。
# 惰性创建;进程生命周期内不清(测试用 reset_path_write_locks 显式清)。
_PATH_WRITE_LOCKS: dict[str, asyncio.Lock] = {}


def _lock_key(resolved_path: str) -> str:
    """锁键规范化:Windows 大小写不敏感 + 分隔符归一,同一文件无论传法如何同键。"""
    return os.path.normcase(os.path.normpath(resolved_path))


def get_path_write_lock(resolved_path: str) -> asyncio.Lock:
    """取(或惰性创建)该路径的写互斥锁。同一文件的写段必须全程持锁。"""
    key = _lock_key(resolved_path)
    lock = _PATH_WRITE_LOCKS.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _PATH_WRITE_LOCKS[key] = lock
    return lock


def reset_path_write_locks() -> None:
    """清空锁注册表(仅测试隔离调用;运行期清锁会破坏互斥语义)。"""
    _PATH_WRITE_LOCKS.clear()


def classify_write_conflict(
    disk_lf: str | None,
    baseline_lf: str | None,
    intended_lf: str,
) -> str:
    """写前基线漂移判定(纯函数)。

    参数均为 LF 归一化内容(调用点负责,与 mcp_server._normalize_eol 同一口径):
      disk_lf     — 现盘内容;None = 文件不存在 或 读不了(二进制/IO 错误)
      baseline_lf — agent 视角 base(mcp_server._FILE_BASE_CONTENT);None = 无记录
      intended_lf — 本次拟写入的内容

    判定顺序(一步都不能少):
      1. baseline 缺席 → no-baseline(新文件/首次写是合法用例,放行);
      2. disk 缺席但 base 在 → undecidable(文件被外部删除或读不了;
         "被删除"与"读不了"此处同形,都判不了 → 放行但如实上报,不静默折成 clean);
      3. disk == baseline → clean(自 base 以来无外部改动);
      4. disk == intended → equivalent(幂等重写,覆盖的是同样内容);
      5. 其余 → drifted(并发修改:别人在我 base 之后改了盘,我要写的又与现状不同
         → 盲覆盖会丢别人的改动,拦截)。
    """
    if baseline_lf is None:
        return "no-baseline"
    if disk_lf is None:
        return "undecidable"
    if disk_lf == baseline_lf:
        return "clean"
    if disk_lf == intended_lf:
        return "equivalent"
    return "drifted"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
