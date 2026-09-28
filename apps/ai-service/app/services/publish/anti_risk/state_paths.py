# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""反风控状态文件路径的唯一解析出口 —— **与进程 cwd 无关**。

同一族缺陷的第三维(前两维:身份键 `account_identity`、画像根 `account_profile`)。
`anti_risk/` 里 5 个状态文件模块此前各自写着

    _XXX_FILE = Path(os.environ.get("<ENV>", ".ihui-agent/tmp/xxx.json")).resolve()

`Path(相对路径).resolve()` 按**进程当前工作目录**解析,而
`pnpm --filter @ihui/ai-service dev` 的 dev 脚本 cwd 就是 `apps/ai-service` ——
于是真实状态一直长在 `apps/ai-service/.ihui-agent/tmp/`(2026-09-27 实测:
该处的 device_graph.json 有 2975 B 真数据,仓库根那份根本不存在)。

后果不是"路径难看",而是**判定基准随启动姿势归零**:设备图谱是"这两个账号是不是
同一个人"的依据,冷却状态是"刚发过要等多久"的依据。换一次启动目录 ⇒ 图谱与冷却从零
开始 —— 联动检测看不见既有关联、冷却看不见刚发过的事,恰好制造出本层要防的行为。
本模块把"路径怎么算"收成一个纯函数出口,5 个模块只许经它取值。

三态规则(与 `account_profile.resolve_profile_root()` 同形,一条也不看 cwd):

1. ``raw`` 为 None 或空白(环境变量未设 / 被设成空串)→
   ``<仓库根>/<relative_default>``(AGENTS.md §15:临时产物放 .ihui-agent/tmp/)
2. ``raw`` 为**相对路径** → 锚定**仓库根**解析。不得按 cwd 解析 —— 那正是本缺陷本体。
3. ``raw`` 为**绝对路径** → 原样采用(仅 resolve() 做路径规范化)。

模块导入期**零副作用**:不 mkdir、不搬数据、不读环境变量(env 由调用方自己取好传进来),
建目录仍发生在各模块首次写入时(``<file>.parent.mkdir(parents=True, exist_ok=True)``)。
"""
from __future__ import annotations

from pathlib import Path

__all__ = ["resolve_state_path"]


def _repo_root() -> Path:
    """仓库根 —— `anti_risk/**` 里**唯一**一处上溯计数,由源码面锁看守。

    判据不许有第二份:tests/test_anti_risk_state_paths_are_cwd_independent.py 扫
    anti_risk/ 全部模块的**代码面**(剥注释与 docstring),要求上溯计数只出现在本文件。
    本文件位于 <root>/apps/ai-service/app/services/publish/anti_risk/,故上溯 6 层;
    数错了不会静默漂开 —— 在两个不同 cwd 下比对解析结果的用例会当场点名它。
    """
    return Path(__file__).resolve().parents[6]


def resolve_state_path(raw: str | None, relative_default: str) -> Path:
    """状态文件路径解析的**唯一出口** —— 纯函数:不读 env、不碰文件系统、与进程 cwd 无关。

    Args:
        raw: 调用方从环境变量取到的原始值。None / 空串 / 纯空白一律按"未设置"处理
            (旧实现把空串解析成 **cwd 本身**,状态文件会直接长在启动目录里)。
        relative_default: 默认相对路径,相对**仓库根**,如
            `.ihui-agent/tmp/device_graph.json`。

    Returns:
        绝对化并规范化后的 `Path`。三态规则见模块 docstring。

    Raises:
        ValueError: `relative_default` 给了绝对路径 —— 默认值必须是能随仓库根一起搬家的
            相对档,把绝对值写进默认参数等于把锚点藏进每个调用方(两处真相必漂移)。
    """
    if Path(relative_default).is_absolute():
        msg = f"状态文件默认值必须是相对仓库根的相对路径,不得给绝对值:{relative_default}"
        raise ValueError(msg)
    root = _repo_root()
    if raw is None or not raw.strip():
        return (root / relative_default).resolve()
    candidate = Path(raw)
    if candidate.is_absolute():
        return candidate.resolve()
    return (root / candidate).resolve()
