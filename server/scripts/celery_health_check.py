"""Celery Redis 配置完整性检查 (P1 封版).

目的: 静态校验 Celery 配置文件, 提前发现封版前遗漏 / 不一致问题.

检查项:
  1. broker / result_backend 都用 Redis
  2. broker 与 result_backend 一致 (避免连接两个不同实例)
  3. 序列化器: task_serializer / result_serializer / accept_content 必须都是 json
  4. 时区: Asia/Shanghai
  5. 防丢失: task_acks_late=True
  6. 公平: worker_prefetch_multiplier=1 (防止长任务饿死其他任务)
  7. 启动重连: broker_connection_retry_on_startup=True
  8. 队列: beat schedule 任务必须声明 queue, worker -Q 必须覆盖所有 queue
  9. 任务注册: beat schedule 中的 task name 必须能在 tasks 模块中找到
 10. 任务重试: 每个任务应有 max_retries
 11. 包含模块: include 必须包含所有 task 模块
 12. celery 依赖: 缺失时降级是否正确处理

运行: python -m scripts.celery_health_check
"""
from __future__ import annotations

import importlib
import os
import re
import sys
from pathlib import Path
from typing import Any

# 允许脚本独立运行
SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))


# 颜色
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def _print_section(title: str) -> None:
    print(f"\n{BLUE}{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}{RESET}")


def _print_ok(msg: str) -> None:
    print(f"  {GREEN}[PASS]{RESET} {msg}")


def _print_warn(msg: str) -> None:
    print(f"  {YELLOW}[WARN]{RESET} {msg}")


def _print_fail(msg: str) -> None:
    print(f"  {RED}[FAIL]{RESET} {msg}")


def _parse_celery_app() -> dict[str, Any]:
    """解析 celery_app 配置, 提取关键字段."""
    out: dict[str, Any] = {
        "broker": None,
        "backend": None,
        "task_serializer": None,
        "result_serializer": None,
        "accept_content": None,
        "timezone": None,
        "task_acks_late": None,
        "worker_prefetch_multiplier": None,
        "broker_connection_retry_on_startup": None,
        "include": None,
        "beat_schedule": None,
    }
    try:
        # 强制 celery 依赖可导入
        os.environ.setdefault("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
        from app.celery_app import celery_app
        if celery_app is None:
            return out
        conf = celery_app.conf
        out["broker"] = celery_app.conf.broker_url or conf.broker_url if hasattr(conf, "broker_url") else None
        out["backend"] = conf.result_backend
        out["task_serializer"] = conf.task_serializer
        out["result_serializer"] = conf.result_serializer
        out["accept_content"] = conf.accept_content
        out["timezone"] = conf.timezone
        out["task_acks_late"] = conf.task_acks_late
        out["worker_prefetch_multiplier"] = conf.worker_prefetch_multiplier
        out["broker_connection_retry_on_startup"] = conf.broker_connection_retry_on_startup
        out["include"] = celery_app.conf.include
        out["beat_schedule"] = dict(conf.beat_schedule) if conf.beat_schedule else {}
    except Exception as e:  # noqa: BLE001
        print(f"  {RED}[FATAL]{RESET} 无法导入 celery_app: {e}")
    return out


def _get_task_queues_from_launcher() -> list[str]:
    """从 celery_launcher.py 解析 worker -Q 队列列表."""
    launcher = SERVER_DIR / "scripts" / "celery_launcher.py"
    if not launcher.exists():
        return []
    content = launcher.read_text(encoding="utf-8")
    m = re.search(r'"-Q",\s*"([^"]+)"', content)
    if m:
        return [q.strip() for q in m.group(1).split(",")]
    return []


def _get_beat_schedule_queues(beat_schedule: dict) -> set[str]:
    """从 beat_schedule 提取所有声明的 queue."""
    queues = set()
    for name, entry in beat_schedule.items():
        opts = entry.get("options") or {}
        q = opts.get("queue")
        if q:
            queues.add(q)
    return queues


def _verify_task_exists(task_name: str) -> tuple[bool, str]:
    """验证 task_name 是否能在指定模块中找到 @celery_app.task 装饰的函数."""
    if "." not in task_name:
        return False, "task 名称格式不合法 (需为 'module.func')"
    module_name, func_name = task_name.rsplit(".", 1)
    try:
        mod = importlib.import_module(module_name)
    except Exception as e:  # noqa: BLE001
        return False, f"模块 {module_name} 不可导入: {e}"
    fn = getattr(mod, func_name, None)
    if fn is None:
        return False, f"模块 {module_name} 中无 {func_name} 函数"
    return True, "OK"


def _verify_task_has_retry(task_name: str) -> tuple[bool, str]:
    """验证任务是否声明了 max_retries (源 .py 字符串扫描)."""
    if "." not in task_name:
        return False, "task 名称格式不合法"
    module_name, func_name = task_name.rsplit(".", 1)
    rel_path = Path(*module_name.split("."))  # Path("app/tasks/reconcile_tasks")
    module_path = SERVER_DIR / (str(rel_path) + ".py")
    if not module_path.exists():
        return False, f"模块文件不存在: {module_path}"
    content = module_path.read_text(encoding="utf-8")
    # 找 @celery_app.task(...func_name) 装饰器
    pattern = rf"@celery_app\.task\([^)]*?name=['\"]{re.escape(task_name)}['\"][^)]*?\)\s*\n\s*def\s+{func_name}\b"
    m = re.search(pattern, content)
    if not m:
        return False, f"未找到 @celery_app.task(name='{task_name}') 装饰器"
    decorator_text = m.group(0)
    if "max_retries" not in decorator_text:
        return False, "未声明 max_retries"
    return True, "OK"


def main() -> int:
    print(f"\n{BLUE}Celery Redis 配置完整性检查 (P1 封版){RESET}\n")
    fails = 0
    warns = 0

    cfg = _parse_celery_app()
    if cfg["broker"] is None:
        _print_fail("celery_app 不可用 (Celery 未安装或配置加载失败)")
        print(f"  {YELLOW}提示: pip install celery redis{RESET}")
        return 1

    # 1. broker / backend
    _print_section("1. broker / result_backend")
    if cfg["broker"] and cfg["broker"].startswith("redis://"):
        _print_ok(f"broker 是 Redis: {cfg['broker']}")
    else:
        _print_fail(f"broker 非 Redis: {cfg['broker']}")
        fails += 1

    if cfg["backend"] and cfg["backend"].startswith("redis://"):
        _print_ok(f"result_backend 是 Redis: {cfg['backend']}")
    else:
        _print_fail(f"result_backend 非 Redis: {cfg['backend']}")
        fails += 1

    if cfg["broker"] == cfg["backend"]:
        _print_ok("broker == result_backend (避免两个不同 Redis 实例)")
    else:
        _print_warn(
            f"broker != result_backend (broker={cfg['broker']}, backend={cfg['backend']})"
        )
        warns += 1

    # 2. 序列化
    _print_section("2. 序列化器")
    if cfg["task_serializer"] == "json":
        _print_ok(f"task_serializer = json")
    else:
        _print_fail(f"task_serializer = {cfg['task_serializer']} (推荐 json, 避免 pickle 风险)")
        fails += 1
    if cfg["result_serializer"] == "json":
        _print_ok(f"result_serializer = json")
    else:
        _print_fail(f"result_serializer = {cfg['result_serializer']}")
        fails += 1
    if cfg["accept_content"] and "json" in cfg["accept_content"]:
        _print_ok(f"accept_content 包含 json: {cfg['accept_content']}")
    else:
        _print_fail(f"accept_content 不含 json: {cfg['accept_content']}")
        fails += 1

    # 3. 时区
    _print_section("3. 时区")
    if cfg["timezone"] == "Asia/Shanghai":
        _print_ok("timezone = Asia/Shanghai")
    else:
        _print_warn(f"timezone = {cfg['timezone']} (推荐 Asia/Shanghai)")
        warns += 1

    # 4. 防丢失
    _print_section("4. 任务可靠性")
    if cfg["task_acks_late"] is True:
        _print_ok("task_acks_late = True (worker 异常时任务不丢失)")
    else:
        _print_fail(f"task_acks_late = {cfg['task_acks_late']} (必须 True)")
        fails += 1
    if cfg["worker_prefetch_multiplier"] == 1:
        _print_ok("worker_prefetch_multiplier = 1 (公平调度, 防止长任务饿死)")
    else:
        _print_warn(
            f"worker_prefetch_multiplier = {cfg['worker_prefetch_multiplier']} (推荐 1)"
        )
        warns += 1
    if cfg["broker_connection_retry_on_startup"] is True:
        _print_ok("broker_connection_retry_on_startup = True (启动时重连 broker)")
    else:
        _print_warn(
            f"broker_connection_retry_on_startup = {cfg['broker_connection_retry_on_startup']}"
        )
        warns += 1

    # 5. 队列覆盖
    _print_section("5. 队列覆盖 (worker -Q vs beat schedule)")
    worker_queues = set(_get_task_queues_from_launcher())
    beat_queues = _get_beat_schedule_queues(cfg.get("beat_schedule") or {})
    if not worker_queues:
        _print_warn("celery_launcher.py 未声明 worker -Q 队列")
        warns += 1
    else:
        _print_ok(f"worker -Q 监听: {sorted(worker_queues)}")
    if not beat_queues:
        _print_warn("beat_schedule 中无任何任务声明 queue")
        warns += 1
    else:
        _print_ok(f"beat schedule 声明 queue: {sorted(beat_queues)}")
        if beat_queues and worker_queues:
            missing = beat_queues - worker_queues
            if missing:
                _print_fail(f"beat schedule 声明的 queue 不在 worker 监听: {missing}")
                fails += 1
            else:
                _print_ok("worker 监听了所有 beat schedule 队列")
    # 额外检查: default 队列
    if "default" not in worker_queues:
        _print_warn("worker 未监听 'default' 队列 (task_default_queue 默认值)")
        warns += 1

    # 6. 任务注册
    _print_section("6. 任务注册一致性")
    beat_schedule = cfg.get("beat_schedule") or {}
    if not beat_schedule:
        _print_fail("beat_schedule 为空, 无任何定时任务")
        fails += 1
    else:
        for name, entry in beat_schedule.items():
            task_name = entry.get("task")
            if not task_name:
                _print_fail(f"beat_schedule['{name}'] 无 task 字段")
                fails += 1
                continue
            ok, reason = _verify_task_exists(task_name)
            if ok:
                _print_ok(f"任务 {task_name} 存在")
            else:
                _print_fail(f"任务 {task_name} 不存在: {reason}")
                fails += 1
            ok, reason = _verify_task_has_retry(task_name)
            if ok:
                _print_ok(f"任务 {task_name} 声明了 max_retries")
            else:
                _print_warn(f"任务 {task_name} 未声明 max_retries: {reason}")
                warns += 1

    # 7. include 模块
    _print_section("7. include 路径")
    include = cfg.get("include") or []
    if not include:
        _print_fail("include 为空, worker 不会自动发现任务模块")
        fails += 1
    else:
        for mod in include:
            try:
                importlib.import_module(mod)
                _print_ok(f"include 模块可导入: {mod}")
            except Exception as e:  # noqa: BLE001
                _print_fail(f"include 模块不可导入: {mod}: {e}")
                fails += 1

    # 汇总
    _print_section("汇总")
    if fails == 0 and warns == 0:
        print(f"  {GREEN}全部 PASS, 配置健康.{RESET}\n")
        return 0
    if fails == 0:
        print(f"  {YELLOW}全部 PASS, 但有 {warns} 项 WARN 建议优化.{RESET}\n")
        return 0
    print(f"  {RED}{fails} 项 FAIL, {warns} 项 WARN.{RESET}")
    print(f"  请按上面 FAIL 提示修复后再次运行本脚本.\n")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
