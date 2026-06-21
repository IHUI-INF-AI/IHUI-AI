"""Bug-87: 分布式配置热更新 (本地内存版, 可扩展 Redis pub/sub).

设计:
  - 注册配置项 (key, default, validator)
  - update(key, value) 立即生效, 所有 watcher 收到通知
  - 持久化到本地 JSON, 重启自动加载
  - 提供 get / set / watch / unwatch
  - 提供 get_all / diff(vs_default) / reload_from_disk
  - 兼容 env 变量初始值
  - thread-safe

使用:
    from app.utils.hot_config import hot_config

    hot_config.register("rate_limit.llm_qps", default=10, validator=int)
    hot_config.set("rate_limit.llm_qps", 20)
    v = hot_config.get("rate_limit.llm_qps")
"""

import json
import logging
import os
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_CONFIG_PATH = os.environ.get("ZHS_AUDIT_DIR", "audit") + "/hot_config.json"
DEFAULT_WATCHER_TTL = 5.0  # watcher 异常最大存活


@dataclass
class ConfigItem:
    key: str
    default: Any
    value: Any
    updated_at: float = field(default_factory=time.time)
    updater: str = ""
    validator: Callable[[Any], Any] | None = None
    desc: str = ""
    last_set: bool = False  # 是否经过 set() 显式赋值 (磁盘加载项保持 False)


class HotConfig:
    """内存级配置中心, 支持热更新."""

    def __init__(self, persist_path: str = DEFAULT_CONFIG_PATH):
        self._lock = threading.RLock()
        self._items: dict[str, ConfigItem] = {}
        self._watchers: dict[str, list[Callable]] = {}
        self._persist_path = persist_path
        self._total_updates = 0
        self._total_reloads = 0
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        if not os.path.exists(self._persist_path):
            return
        try:
            with open(self._persist_path, encoding="utf-8") as f:
                data = json.load(f)
            for k, v in data.items():
                self._items[k] = ConfigItem(
                    key=k,
                    default=v.get("default", v.get("value")),
                    value=v.get("value"),
                    updated_at=v.get("updated_at", time.time()),
                    updater=v.get("updater", "disk"),
                    desc=v.get("desc", ""),
                )
            with self._lock:
                self._total_reloads += 1
        except Exception as e:
            logger.debug(f"hot_config load fail: {e!r}")

    def _persist(self) -> None:
        try:
            os.makedirs(os.path.dirname(self._persist_path) or ".", exist_ok=True)
            data = {}
            with self._lock:
                for k, it in self._items.items():
                    data[k] = {
                        "default": it.default,
                        "value": it.value,
                        "updated_at": it.updated_at,
                        "updater": it.updater,
                        "desc": it.desc,
                    }
            tmp = self._persist_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp, self._persist_path)
        except Exception as e:
            logger.debug(f"hot_config persist fail: {e!r}")

    def register(
        self,
        key: str,
        default: Any,
        validator: Callable[[Any], Any] | None = None,
        desc: str = "",
        env_fallback: str | None = None,
    ) -> None:
        """注册配置项. env_fallback 可指定环境变量名作为初始值."""
        with self._lock:
            if key in self._items:
                return  # 已注册
            v = default
            if env_fallback:
                env_v = os.environ.get(env_fallback)
                if env_v is not None:
                    v = env_v
            if validator is not None:
                try:
                    v = validator(v)
                except Exception as e:
                    logger.warning(f"hot_config: validate {key} fail: {e!r}, use default")
                    v = default
            self._items[key] = ConfigItem(
                key=key,
                default=default,
                value=v,
                validator=validator,
                desc=desc,
            )

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            it = self._items.get(key)
            if it is None:
                return default
            return it.value

    def set(self, key: str, value: Any, updater: str = "user", notify: bool = True) -> bool:
        with self._lock:
            it = self._items.get(key)
            old_value: Any = None
            if it is None:
                # 未注册: 延迟注册
                self._items[key] = ConfigItem(key=key, default=value, value=value, updater=updater, last_set=True)
            else:
                old_value = it.value
                if it.validator is not None:
                    try:
                        value = it.validator(value)
                    except Exception as e:
                        logger.warning(f"hot_config: validate {key} fail: {e!r}")
                        return False
                # 同值不触发 watcher (仅对 last_set=True 的项生效, 磁盘加载项视为首次)
                if it.last_set and old_value == value:
                    return True
                it.value = value
                it.updated_at = time.time()
                it.updater = updater
                it.last_set = True
            self._total_updates += 1
        self._persist()
        # 触发 watcher
        if notify:
            self._notify_with_old(key, value, old_value)
        return True

    def _notify_with_old(self, key: str, value: Any, old_value: Any) -> None:
        with self._lock:
            watchers = list(self._watchers.get(key, [])) + list(self._watchers.get("*", []))
        for cb in watchers:
            try:
                # 兼容老 API: cb 接受 (old, new) 两个位置参数
                # 新 API: cb 接受 (key, value) 两个位置参数
                # 通过 inspect 判别参数数量
                import inspect

                sig = inspect.signature(cb)
                nargs = len(
                    [p for p in sig.parameters.values() if p.kind in (p.POSITIONAL_OR_KEYWORD, p.POSITIONAL_ONLY)]
                )
                if nargs == 2:
                    # 推测签名
                    pn = list(sig.parameters.keys())
                    if "old" in pn or "new" in pn:
                        cb(old_value, value)
                    else:
                        cb(key, value)
                else:
                    cb(key, value)
            except Exception as e:
                import traceback

                logger.warning(f"hot_config watcher[{key}] fail: {e!r}\n{traceback.format_exc()}")

    def _notify(self, key: str, value: Any) -> None:
        # 复制一份 watcher 列表, 避免回调中再注册
        with self._lock:
            watchers = list(self._watchers.get(key, [])) + list(self._watchers.get("*", []))
        for cb in watchers:
            try:
                cb(key, value)
            except Exception as e:
                logger.warning(f"hot_config watcher[{key}] fail: {e!r}")

    def watch(self, key: str, callback: Callable[[str, Any], None]) -> None:
        """注册 key 的变化监听. key="*" 监听所有."""
        with self._lock:
            self._watchers.setdefault(key, []).append(callback)

    def unwatch(self, key: str, callback: Callable) -> bool:
        with self._lock:
            lst = self._watchers.get(key, [])
            if callback in lst:
                lst.remove(callback)
                return True
            return False

    def reset(self, key: str) -> bool:
        """重置回 default."""
        with self._lock:
            it = self._items.get(key)
            if it is None:
                return False
            it.value = it.default
            it.updated_at = time.time()
            it.updater = "reset"
        self._persist()
        self._notify(key, it.value)
        return True

    def diff_from_default(self) -> dict[str, Any]:
        with self._lock:
            return {
                k: {"default": it.default, "current": it.value, "changed": it.value != it.default}
                for k, it in self._items.items()
                if it.value != it.default
            }

    def get_all(self) -> dict[str, Any]:
        with self._lock:
            return {
                k: {
                    "value": it.value,
                    "default": it.default,
                    "updated_at": round(it.updated_at, 3),
                    "updater": it.updater,
                    "desc": it.desc,
                }
                for k, it in self._items.items()
            }

    def reload_from_disk(self) -> int:
        """从磁盘重新加载. 返回受影响 key 数."""
        affected = 0
        with self._lock:
            self._items.clear()
        self._load_from_disk()
        with self._lock:
            affected = len(self._items)
        return affected

    def stats(self) -> dict:
        with self._lock:
            return {
                "items": len(self._items),
                "watchers": sum(len(v) for v in self._watchers.values()),
                "total_updates": self._total_updates,
                "total_reloads": self._total_reloads,
                "persist_path": self._persist_path,
                "diff_count": len(self.diff_from_default()),
            }


# 全局单例
hot_config = HotConfig()


# ----- 顶层便捷函数 (兼容老 API, 委托到全局单例) -----


def hot_get(key: str, default: Any = None) -> Any:
    """便捷函数: 从全局 hot_config 取值. 兼容 env 兜底.

    env 查找顺序: 原 key, key.upper(), "HOT_" + key, "HOT_" + key.upper().
    智能类型推断: env key 含 "NUM"/"INT" 转 int, "BOOL" 转 bool.
    """
    v = hot_config.get(key, default=None)
    if v is None:
        # 兼容: 尝试从环境变量读取 (按多种命名约定)
        for env_name in (key, key.upper(), "HOT_" + key, "HOT_" + key.upper()):
            env_v = os.environ.get(env_name)
            if env_v is not None:
                return _coerce_env(env_name, env_v)
        return default
    return v


def _coerce_env(env_name: str, value: str) -> Any:
    """根据 env key 名智能做类型转换."""
    up = env_name.upper()
    if "NUM" in up or "INT" in up or "COUNT" in up or "PORT" in up or "QPS" in up:
        try:
            return int(value)
        except Exception:
            return value
    if "BOOL" in up or "FLAG" in up or "ENABLE" in up or "DISABLE" in up:
        return value.lower() in ("1", "true", "yes", "on")
    if "JSON" in up:
        try:
            return json.loads(value)
        except Exception:
            return value
    return value


def hot_set(key: str, value: Any, updater: str = "user", notify: bool = True) -> bool:
    """便捷函数: 设置全局 hot_config 的值. notify=False 时不触发 watcher."""
    if not notify:
        # 直接绕过 watcher, 写入即可
        with hot_config._lock:
            it = hot_config._items.get(key)
            if it is None:
                hot_config._items[key] = ConfigItem(key=key, default=value, value=value, updater=updater, last_set=True)
            else:
                if it.validator is not None:
                    try:
                        value = it.validator(value)
                    except Exception:
                        return False
                it.value = value
                it.updated_at = time.time()
                it.updater = updater
                it.last_set = True
            hot_config._total_updates += 1
        hot_config._persist()
        return True
    return hot_config.set(key, value, updater=updater, notify=notify)


def hot_register(
    key: str,
    default: Any,
    validator: Callable[[Any], Any] | None = None,
    desc: str = "",
    env_fallback: str | None = None,
) -> None:
    """便捷函数: 注册全局 hot_config 项."""
    hot_config.register(key, default, validator=validator, desc=desc, env_fallback=env_fallback)


def hot_watch(key: str, callback: Callable[[str, Any], None]) -> None:
    """便捷函数: 注册全局 hot_config 监听."""
    hot_config.watch(key, callback)


def watch(key: str, callback: Callable[[str, Any], None]) -> None:
    """兼容别名: 旧 API."""
    hot_config.watch(key, callback)


def hot_keys() -> list[str]:
    """兼容别名: 列出所有已注册 key."""
    return list(hot_config.get_all().keys())


def hot_snapshot() -> dict[str, Any]:
    """兼容别名: 返回当前所有配置的 value 字典."""
    return {k: meta["value"] for k, meta in hot_config.get_all().items()}


def reload_now() -> int:
    """便捷函数: 立即从磁盘重新加载. 返回受影响 key 数."""
    return hot_config.reload_from_disk()


# ---------------------------------------------------------------------------
# Bug-47: Hot config reloader (background thread, periodic disk reload)
# ---------------------------------------------------------------------------

_reloader_thread: threading.Thread | None = None
_reloader_stop_event: threading.Event | None = None


def start_hot_reload(interval_sec: float = 60.0) -> bool:
    """启动后台热配置重载线程.

    每隔 interval_sec 秒从磁盘重新加载 hot_config, 触发 watcher.
    在 FastAPI lifespan 中调用, 同进程内只会启动一次.
    返回 True 表示已启动, False 表示已经在运行或启动失败.
    """
    global _reloader_thread, _reloader_stop_event
    if _reloader_thread is not None and _reloader_thread.is_alive():
        logger.debug("hot_config reloader already running")
        return False
    try:
        _reloader_stop_event = threading.Event()
        interval = max(1.0, float(interval_sec))

        def _loop():
            logger.info(f"hot_config reloader started, interval={interval}s")
            while _reloader_stop_event and not _reloader_stop_event.is_set():
                try:
                    affected = hot_config.reload_from_disk()
                    if affected:
                        logger.info(f"hot_config reloaded {affected} keys from disk")
                except Exception as e:
                    logger.debug(f"hot_config reload error: {e!r}")
                # 用 wait 替代 sleep, 便于立即响应 stop
                if _reloader_stop_event:
                    _reloader_stop_event.wait(interval)
            logger.info("hot_config reloader stopped")

        t = threading.Thread(target=_loop, name="hot-config-reloader", daemon=True)
        t.start()
        _reloader_thread = t
        return True
    except Exception as e:
        logger.warning(f"start_hot_reload failed: {e!r}")
        return False


def stop_hot_reload() -> None:
    """停止后台热配置重载线程."""
    global _reloader_thread, _reloader_stop_event
    if _reloader_stop_event is not None:
        _reloader_stop_event.set()
    if _reloader_thread is not None:
        _reloader_thread.join(timeout=2.0)
    _reloader_thread = None
    _reloader_stop_event = None
