# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""私有成对评测 —— 装载器 + 趋势账路径(仓外批准目录,agent 工作树读不到)。

为什么要仓外(复现原文「Swarm 不知道评测存在」):
    原文把 SmolTalkBench 跑在 Hugging Face Jobs 上、控制器/提示词/工作区都不提评测,
    确保被评的 Swarm 看不到题也无法过拟合题。本仓 agent 会话能 `git grep` 整个工作树,
    所以保密轴等价实现 = 题库与趋势账**落在仓外批准目录**(不进 git、不在工作树),
    候选路径解析复用 scripts/lib/key-dir.mjs 的「存在即真 + env 覆盖」纪律,但取不到时
    一律显式 UNDETERMINED(§0.3),绝不回落工作树去"凑一份",也不把"读不到题"说成"评测通过"。
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.services.pairwise_eval import EvalItem

# 候选根目录(按本机历史排序;存在即真,不枚举盘符 —— 同 key-dir 立因)。
# C 最后兜底。环境变量 PRIVATE_EVAL_DIR 显式覆盖优先。
_ROOT_CANDIDATES = [
    "D:/DevEnv/private-eval",
    "F:/DevEnv/private-eval",
    "E:/DevEnv/private-eval",
    "C:/DevEnv/private-eval",
]
_DATASET_NAME = "pairwise-dataset.jsonl"


@dataclass
class DatasetResolution:
    """题库路径解析结果,带出处(winnerIndex/tried),便于把"读不到"讲清楚。"""

    path: Path | None
    tried: list[str]
    winner_index: int

    @property
    def found(self) -> bool:
        return self.path is not None


def _roots(env: dict[str, str]) -> list[str]:
    override = env.get("PRIVATE_EVAL_DIR")
    if override:
        return [override.replace("\\", "/")]
    return list(_ROOT_CANDIDATES)


def resolve_dataset_path(env: dict[str, str] | None = None) -> DatasetResolution:
    """返回第一个**真实存在**的题库绝对路径;全不存在 ⇒ path=None。

    三态判读:winner_index==-1 ⇒ 根都没挂/目录缺失(无法判定,非"没有进步");
    winner_index>=0 且 path=None ⇒ 根存在但该根下暂无题库文件(先放题再跑)。
    """
    env = dict(os.environ if env is None else env)
    roots = _roots(env)
    tried: list[str] = []
    chosen_root: Path | None = None
    winner_index = -1
    for i, root in enumerate(roots):
        dataset = Path(root) / _DATASET_NAME
        tried.append(str(dataset).replace("\\", "/"))
        if Path(root).exists():
            winner_index = i
            chosen_root = Path(root)
            break
    if chosen_root is None:
        return DatasetResolution(None, tried, -1)
    candidate = chosen_root / _DATASET_NAME
    return DatasetResolution(candidate if candidate.exists() else None, tried, winner_index)


def load_dataset(path: Path) -> list[EvalItem]:
    """读 jsonl 题库成 EvalItem 列表;坏行丢弃并计坏行数(不因一行崩读废整轮)。

    返回前按 item_id 去重保序:同 id 重复 = 一份题被两个会话/两批数据带进来,
    在分母里是两条但其实是同一题,会让胜率虚高/失真 —— 折到第一枚,重复数单列回报。
    """
    items: list[EvalItem] = []
    seen: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj: dict[str, Any] = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not all(k in obj for k in ("item_id", "instruction", "candidate", "reference")):
            continue
        item_id = str(obj["item_id"])
        if item_id in seen:
            continue
        seen.add(item_id)
        items.append(
            EvalItem(
                item_id=item_id,
                instruction=str(obj["instruction"]),
                candidate=str(obj["candidate"]),
                reference=str(obj["reference"]),
            )
        )
    return items


def trend_ledger_path(env: dict[str, str] | None = None) -> Path:
    """趋势账落在与题库同一批准根下的 trend.jsonl(仓外,不进 git)。"""
    env = dict(os.environ if env is None else env)
    root = Path(_roots(env)[0])
    root.mkdir(parents=True, exist_ok=True)
    return root / "pairwise-trend.jsonl"


__test__ = {"resolve_dataset_path": resolve_dataset_path, "load_dataset": load_dataset}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
