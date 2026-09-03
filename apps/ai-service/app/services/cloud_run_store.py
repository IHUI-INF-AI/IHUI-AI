# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P0-7 云托管 Agent 会话运行记录存储(进程内 dict + JSON 文件持久化)。

对标 OpenAI Codex Cloud:每次 agent 运行建立一条持久化记录(run_id / agent 类型 /
输入任务 / 状态 / 最终输出 / 起止时间 / 会话别名),支持跨端(web/cli)恢复与历史查看,
而非仅当前进程内存态。

存储策略:
- 主存储:进程内 dict[run_id -> CloudRun](读快、跨请求可见)
- 持久化:每次变更把全量记录写回 data/cloud_runs.json(ai-service 数据目录),
  进程重启后可从文件恢复,跨请求/跨进程可读;文件缺失/损坏时静默降级为空存储。
- 上限:仅保留最近 RUN_LIMIT 条(超出丢最旧的已完成记录,running 保持可见)。
- 并发:threading.Lock 保护 dict 与 JSON 读写的原子性(变更全量重写,量小无压力)。

不引入新技术:复用项目 data/ 目录 JSON 落盘(mcp_store.py 同款),不依赖 DB 迁移,
最小可行闭环。
"""

from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 保留的最近运行记录上限
RUN_LIMIT = 500
# 最终输出与错误信息的单条长度上限(防单条超大撑爆文件)
OUTPUT_LIMIT = 50_000
ERROR_LIMIT = 5_000
TASK_LIMIT = 2_000

# JSON 持久化文件(ai-service 根下的 data/cloud_runs.json)
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_RUNS_FILE = _DATA_DIR / "cloud_runs.json"


def _now_iso() -> str:
    """当前 UTC 时间 ISO8601(秒级)。"""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


@dataclass
class CloudRun:
    """单次云托管 agent 运行记录。"""

    run_id: str
    task: str
    status: str = "running"  # running / done / error
    agent_type: str = "loop_v2"
    output: str = ""
    error: str = ""
    session_alias: str = ""
    user_id: str = ""
    started_at: str = ""
    ended_at: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """序列化为可 JSON 化的 dict。"""
        return asdict(self)


class CloudRunStore:
    """云托管 agent 运行记录存储(进程内 dict + JSON 文件)。"""

    def __init__(self, file_path: Path | None = None) -> None:
        self._runs: dict[str, CloudRun] = {}
        self._file = file_path or _RUNS_FILE
        self._lock = threading.Lock()
        self._loaded = False

    # ---------------- 内部 ----------------

    def _load(self) -> None:
        """从 JSON 文件懒加载到内存(仅首次;损坏/缺失降级为空)。"""
        if self._loaded:
            return
        try:
            if self._file.exists():
                raw = json.loads(self._file.read_text(encoding="utf-8"))
                if isinstance(raw, list):
                    fields = set(CloudRun.__dataclass_fields__)
                    for item in raw:
                        if not isinstance(item, dict) or not item.get("run_id"):
                            continue
                        clean = {k: v for k, v in item.items() if k in fields}
                        self._runs[item["run_id"]] = CloudRun(**clean)
        except Exception as e:
            logger.warning("cloud_run_store 读取失败(降级为空): %s", e)
        finally:
            self._loaded = True

    def _persist(self) -> None:
        """把内存全量记录写回 JSON 文件(尽力,失败降级内存保留)。"""
        try:
            self._file.parent.mkdir(parents=True, exist_ok=True)
            data = [r.to_dict() for r in self._runs.values()]
            self._file.write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception as e:
            logger.warning("cloud_run_store 写盘失败(内存保留): %s", e)

    def _trim_to_limit(self) -> None:
        """超出 RUN_LIMIT 时删除最旧的已完成记录(running 保持可见)。"""
        completed = sorted(
            (r for r in self._runs.values() if r.status != "running"),
            key=lambda r: r.started_at,
        )
        overflow = len(self._runs) - RUN_LIMIT
        for r in completed[:overflow]:
            self._runs.pop(r.run_id, None)

    # ---------------- 写入 ----------------

    def start(
        self,
        task: str,
        *,
        run_id: str | None = None,
        agent_type: str = "loop_v2",
        session_alias: str = "",
        user_id: str = "",
    ) -> CloudRun:
        """创建并记录一次运行(状态 running)。返回记录。"""
        run = CloudRun(
            run_id=run_id or uuid.uuid4().hex,
            task=(task or "")[:TASK_LIMIT],
            status="running",
            agent_type=agent_type,
            session_alias=session_alias or run_id,
            user_id=user_id or "",
            started_at=_now_iso(),
        )
        with self._lock:
            self._load()
            self._runs[run.run_id] = run
            if len(self._runs) > RUN_LIMIT:
                self._trim_to_limit()
            self._persist()
        return run

    def complete(
        self,
        run_id: str,
        *,
        status: str = "done",
        output: str = "",
        error: str = "",
    ) -> CloudRun | None:
        """结束一次运行(更新状态/最终输出/结束时间)。幂等;记录不存在则忽略。"""
        with self._lock:
            self._load()
            run = self._runs.get(run_id)
            if run is None:
                return None
            run.status = status if status in ("done", "error") else "done"
            if output:
                run.output = output[:OUTPUT_LIMIT]
            if error:
                run.error = error[:ERROR_LIMIT]
            run.ended_at = _now_iso()
            self._persist()
            return run

    # ---------------- 读取 ----------------

    def get(self, run_id: str) -> CloudRun | None:
        """按 run_id 取单条记录(深拷贝返回,避免调用方污染内部)。"""
        with self._lock:
            self._load()
            run = self._runs.get(run_id)
            return CloudRun(**asdict(run)) if run else None

    def list(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> dict[str, Any]:
        """列出运行记录(新→旧分页,可选 status 过滤)。"""
        with self._lock:
            self._load()
            items = list(self._runs.values())
        if status:
            items = [r for r in items if r.status == status]
        items.sort(key=lambda r: r.started_at, reverse=True)
        total = len(items)
        page = max(1, page or 1)
        page_size = min(max(1, page_size or 20), 100)
        start = (page - 1) * page_size
        page_items = items[start : start + page_size]
        return {
            "list": [r.to_dict() for r in page_items],
            "total": total,
            "page": page,
            "pageSize": page_size,
        }


# 全局单例(router 与 agents.py 埋点共用)
cloud_run_store = CloudRunStore()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
