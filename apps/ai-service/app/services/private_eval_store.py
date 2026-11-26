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
from dataclasses import asdict, dataclass
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
_TEMPLATE_DATASET_NAME = "pairwise-dataset.TEMPLATE.jsonl"
# 模板行的 item_id 前缀:装载器**主动跳过**,不计入可用题。
# 为什么必须跳过而不是照判:有人会把模板直接改名成正式题库就跑,那几行占位文字
# 会被裁判当成真题出胜率 —— 账面一个数,实际什么都没测(§0.3 的另一种形:冒绿)。
_TEMPLATE_PREFIX = "TEMPLATE-"


def is_template_row(item_id: str) -> bool:
    return str(item_id).startswith(_TEMPLATE_PREFIX)


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


@dataclass
class DatasetScan:
    """题库体检结果 —— **只有计数,没有任何题面文字**(保密轴:计数可以进日志/终端,题目不行)。"""

    total: int = 0
    usable: int = 0
    template: int = 0
    duplicate: int = 0
    malformed: int = 0
    missing_field: int = 0

    def to_dict(self) -> dict[str, int]:
        return asdict(self)

    @property
    def verdict(self) -> str:
        if self.usable > 0:
            return "usable"
        if self.template > 0 and self.duplicate == 0 and self.malformed == 0:
            return "template-only"
        return "empty"


def _scan_rows(path: Path) -> tuple[list[EvalItem], DatasetScan]:
    """一次读盘同时给出条目与计数(体检与真跑共用同一把尺,不各写一份 §0.6)。

    按 item_id 去重保序:同 id 重复 = 一份题被两批数据带进来,在分母里是两条但其实是
    同一题,会让胜率虚高 ⇒ 折到首枚并计入 duplicate 报数。
    """
    scan = DatasetScan()
    items: list[EvalItem] = []
    seen: set[str] = set()
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        scan.total += 1
        try:
            obj: Any = json.loads(line)
        except json.JSONDecodeError:
            scan.malformed += 1
            continue
        if not isinstance(obj, dict):
            scan.malformed += 1
            continue
        if not all(k in obj for k in ("item_id", "instruction", "candidate", "reference")):
            scan.missing_field += 1
            continue
        item_id = str(obj["item_id"])
        if is_template_row(item_id):
            scan.template += 1
            continue
        if item_id in seen:
            scan.duplicate += 1
            continue
        seen.add(item_id)
        scan.usable += 1
        items.append(
            EvalItem(
                item_id=item_id,
                instruction=str(obj["instruction"]),
                candidate=str(obj["candidate"]),
                reference=str(obj["reference"]),
            )
        )
    return items, scan


def load_dataset(path: Path) -> list[EvalItem]:
    """读 jsonl 题库成 EvalItem 列表(模板行/坏行/重复行一律不进取用集)。"""
    return _scan_rows(path)[0]


def scan_dataset(path: Path) -> DatasetScan:
    """只体检不裁决:给出可用/模板/重复/坏行计数(供 --validate 与机主建库时自查)。"""
    return _scan_rows(path)[1]


def template_path(env: dict[str, str] | None = None) -> Path:
    """模板落点(与正式题库同批准根,但文件名不同 ⇒ 装载器永远读不到它)。"""
    env = dict(os.environ if env is None else env)
    return Path(_roots(env)[0]) / _TEMPLATE_DATASET_NAME


def write_template(path: Path) -> int:
    """生成**占位**模板:题面写明是待替换的示例,不冒充真题库。返回写入行数。"""
    rows = [
        {
            "item_id": "TEMPLATE-1",
            "instruction": "〔把这里换成真实用户会问的话〕",
            "candidate": "〔待测版本的回答〕",
            "reference": "〔当作基线的回答(旧版或人工好答案)〕",
        },
        {
            "item_id": "TEMPLATE-2",
            "instruction": "〔换一题:要求助手解释一个概念〕",
            "candidate": "〔新版回答〕",
            "reference": "〔基线回答〕",
        },
        {
            "item_id": "TEMPLATE-3",
            "instruction": "〔换一题:情绪support类,考察是否自然体贴〕",
            "candidate": "〔新版回答〕",
            "reference": "〔基线回答〕",
        },
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    return len(rows)


def trend_ledger_path(env: dict[str, str] | None = None) -> Path:
    """趋势账落在与题库同一批准根下的 trend.jsonl(仓外,不进 git)。"""
    env = dict(os.environ if env is None else env)
    root = Path(_roots(env)[0])
    root.mkdir(parents=True, exist_ok=True)
    return root / "pairwise-trend.jsonl"


__test__ = {
    "resolve_dataset_path": resolve_dataset_path,
    "load_dataset": load_dataset,
    "scan_dataset": scan_dataset,
    "is_template_row": is_template_row,
    "write_template": write_template,
    "template_path": template_path,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
