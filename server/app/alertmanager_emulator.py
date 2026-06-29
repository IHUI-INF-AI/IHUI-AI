"""alertmanager 端到端 e2e (建议 147) - app/alertmanager_emulator.py.

设计:
  - 在测试或 CI 环境中, 起一个本地 alertmanager 模拟器 (in-process HTTP server)
  - 接受 Prometheus alert push, 应用 inhibit_rules, 转发到 webhook
  - 复用真实的 AlertInhibitor (app/alert_inhibition.py) + 真实 YAML (docker/alertmanager/alertmanager.yml)
  - 测试覆盖 "Prometheus alert → alertmanager(抑制) → webhook → push" 全链路

用法:
    from app.alertmanager_emulator import AlertmanagerEmulator

    emu = AlertmanagerEmulator(
        rules_yaml=Path("docker/alertmanager/alertmanager.yml"),
        webhook_url="http://localhost:8000/monitor/alerts/webhook",
    )
    emu.start()  # 启动 HTTP server
    emu.push_alert({"labels": {"alertname": "ZHSRollbackActive", "severity": "critical"}, ...})
    # → alertmanager 内部 alertmanager_inhibitor 抑制
    # → 转发到 webhook
    emu.stop()
"""

from __future__ import annotations

import json
import logging
import threading
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib import request as urlrequest
from urllib.error import URLError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# YAML 解析复用 check_inhibition_rules 的逻辑
# ---------------------------------------------------------------------------


def _load_inhibition_rules_from_yaml(yaml_path: Path) -> list:
    """从 alertmanager.yml 加载 inhibit_rules, 转成 InhibitionRule 列表.

    复用了 scripts/ci/check_inhibition_rules.py 的解析能力.

    Raises:
        FileNotFoundError: yaml_path 不存在
    """
    from app.alert_inhibition import InhibitionRule
    from scripts.ci.check_inhibition_rules import _parse_inhibit_rules

    p = Path(yaml_path)
    if not p.exists():
        raise FileNotFoundError(f"rules yaml not found: {p}")
    parsed = _parse_inhibit_rules(p)
    rules: list[InhibitionRule] = []
    for r in parsed:
        sm = r.get("source_match", {})
        tm = r.get("target_match", {})
        eq = r.get("equal") or None
        if not eq:
            # alertmanager 经典默认
            eq = ["alertname"]
        rule = InhibitionRule(
            source_matchers=sm,
            target_matchers=tm,
            equal=eq,
            name=r.get("_name", ""),
        )
        rules.append(rule)
    return rules


# ---------------------------------------------------------------------------
# 内存告警存储 + 抑制引擎
# ---------------------------------------------------------------------------


class _AlertStore:
    """alertmanager 内存中的 alert 存储."""

    def __init__(self):
        self._lock = threading.Lock()
        self._alerts: dict[tuple, dict] = {}  # (alertname, service) -> alert
        self._history: list[dict] = []  # 全部历史

    def add(self, alert: dict) -> bool:
        """添加告警, 返回是否新增 (False=已存在更新)."""
        labels = alert.get("labels", {})
        key = (
            labels.get("alertname", ""),
            labels.get("service", ""),
            labels.get("severity", ""),
        )
        with self._lock:
            existed = key in self._alerts
            self._alerts[key] = alert
            self._history.append(alert)
        return not existed

    def list_active(self) -> list[dict]:
        with self._lock:
            return list(self._alerts.values())

    def get_history(self) -> list[dict]:
        with self._lock:
            return list(self._history)

    def clear(self) -> None:
        with self._lock:
            self._alerts.clear()
            self._history.clear()


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------


def _make_handler(store: _AlertStore, inhibitor, webhook_url: str | None, fired_callback: Callable | None = None):
    """构造 alertmanager 兼容的 HTTP handler."""

    class AlertmanagerHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            # 静默默认 logger, 改用我们的 logger
            logger.debug(f"[alertmanager-emu] {format % args}")

        def _json(self, code: int, body: dict) -> None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _read_body(self) -> dict:
            length = int(self.headers.get("Content-Length", 0))
            if length == 0:
                return {}
            raw = self.rfile.read(length)
            return json.loads(raw.decode("utf-8"))

        # ---- GET /api/v1/alerts: 列出 active alerts ----
        def do_GET(self):
            if self.path.startswith("/api/v1/alerts"):
                self._json(200, {"status": "success", "data": store.list_active()})
                return
            if self.path.startswith("/health"):
                self._json(200, {"status": "ok"})
                return
            self._json(404, {"status": "error", "error": "not found"})

        # ---- POST /api/v1/alerts: 接收 Prometheus alert ----
        def do_POST(self):
            if not self.path.startswith("/api/v1/alerts"):
                self._json(404, {"status": "error", "error": "not found"})
                return
            try:
                body = self._read_body()
            except Exception as e:
                self._json(400, {"status": "error", "error": f"bad json: {e}"})
                return
            # body 可能是 list (alertmanager 风格) 或 dict (Prometheus style {"alerts": [...]})
            if isinstance(body, list):
                alerts = body
            elif isinstance(body, dict):
                alerts = body.get("alerts", [body])
            else:
                alerts = []
            if not isinstance(alerts, list):
                alerts = [alerts]
            new_alerts = []
            for a in alerts:
                # 加 status 字段
                if "status" not in a:
                    a["status"] = "firing"
                store.add(a)
                new_alerts.append(a)
            # 应用抑制
            active = store.list_active()
            surviving = inhibitor.apply(active)
            # 找新增的告警 (在 surviving 里的)
            new_surviving = [a for a in new_alerts if a in surviving]
            # 转发到 webhook
            forwarded = 0
            if webhook_url:
                for a in new_surviving:
                    try:
                        data = json.dumps([a], ensure_ascii=False).encode("utf-8")
                        req = urlrequest.Request(
                            webhook_url,
                            data=data,
                            headers={"Content-Type": "application/json"},
                            method="POST",
                        )
                        urlrequest.urlopen(req, timeout=5).read()
                        forwarded += 1
                    except (URLError, Exception) as e:
                        logger.warning(f"[alertmanager-emu] webhook forward failed: {e}")
            # callback (测试用)
            if fired_callback:
                try:
                    fired_callback(new_surviving)
                except Exception as e:
                    logger.warning(f"[alertmanager-emu] callback failed: {e}")
            self._json(
                200,
                {
                    "status": "success",
                    "received": len(new_alerts),
                    "after_inhibition": len(new_surviving),
                    "forwarded": forwarded,
                },
            )

    return AlertmanagerHandler


# ---------------------------------------------------------------------------
# 模拟器主类
# ---------------------------------------------------------------------------


class AlertmanagerEmulator:
    """本地 alertmanager 模拟器 (用于 e2e 测试).

    Args:
        rules_yaml: alertmanager.yml 路径
        webhook_url: 抑制后转发的目标 URL
        host: 监听地址
        port: 监听端口 (0 = 自动分配)
    """

    def __init__(
        self,
        rules_yaml: Path,
        webhook_url: str | None = None,
        host: str = "127.0.0.1",
        port: int = 0,
    ):
        from app.alert_inhibition import AlertInhibitor

        self._yaml_path = Path(rules_yaml)
        self._webhook_url = webhook_url
        self._host = host
        self._port = port
        self._rules: list = []
        self._inhibitor: AlertInhibitor | None = None
        self._store = _AlertStore()
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._fired_alerts: list[dict] = []
        self._fired_lock = threading.Lock()

    def _on_alert_fired(self, alerts: list[dict]) -> None:
        with self._fired_lock:
            self._fired_alerts.extend(alerts)

    def _setup(self) -> None:
        from app.alert_inhibition import AlertInhibitor

        if not self._yaml_path.exists():
            raise FileNotFoundError(f"rules yaml not found: {self._yaml_path}")
        self._rules = _load_inhibition_rules_from_yaml(self._yaml_path)
        self._inhibitor = AlertInhibitor(self._rules)
        handler = _make_handler(
            self._store,
            self._inhibitor,
            self._webhook_url,
            fired_callback=self._on_alert_fired,
        )
        self._server = ThreadingHTTPServer((self._host, self._port), handler)
        # 拿到实际端口 (0 时自动分配)
        self._port = self._server.server_address[1]

    def start(self) -> str:
        """启动 HTTP server, 返回 base_url."""
        if self._server is not None:
            return self.base_url
        self._setup()
        self._thread = threading.Thread(
            target=self._server.serve_forever,  # type: ignore[attr-defined]
            daemon=True,
            name="alertmanager-emu",
        )
        self._thread.start()
        logger.info(f"[alertmanager-emu] started at {self.base_url}")
        return self.base_url

    def stop(self) -> None:
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
            self._server = None
        if self._thread is not None:
            self._thread.join(timeout=3.0)
            self._thread = None

    @property
    def base_url(self) -> str:
        return f"http://{self._host}:{self._port}"

    @property
    def rules(self) -> list:
        return list(self._rules)

    @property
    def fired_alerts(self) -> list[dict]:
        with self._fired_lock:
            return list(self._fired_alerts)

    def clear_fired(self) -> None:
        with self._fired_lock:
            self._fired_alerts.clear()
        self._store.clear()

    # ---- 测试便捷方法 ----

    def push_alert(self, alert: dict) -> None:
        """直接走 in-process 接口推送告警 (跳过 HTTP).

        等价于: HTTP POST /api/v1/alerts + 应用抑制 + 转发到 webhook.
        """
        if "status" not in alert:
            alert["status"] = "firing"
        self._store.add(alert)
        active = self._store.list_active()
        surviving = self._inhibitor.apply(active) if self._inhibitor else active
        if alert in surviving:
            with self._fired_lock:
                self._fired_alerts.append(alert)
            # 同步转发到 webhook (与 HTTP 路径行为一致)
            if self._webhook_url:
                self._forward_to_webhook(alert)

    def _forward_to_webhook(self, alert: dict) -> None:
        """转发单条告警到 webhook URL."""
        try:
            data = json.dumps([alert], ensure_ascii=False).encode("utf-8")
            req = urlrequest.Request(
                self._webhook_url,  # type: ignore[arg-type]
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urlrequest.urlopen(req, timeout=5).read()
        except (URLError, Exception) as e:
            logger.warning(f"[alertmanager-emu] webhook forward failed: {e}")

    def get_active_alerts(self) -> list[dict]:
        return self._store.list_active()

    def get_history(self) -> list[dict]:
        return self._store.get_history()


# ---------------------------------------------------------------------------
# Context manager 便捷用法
# ---------------------------------------------------------------------------


def run_emulator(rules_yaml: Path, webhook_url: str | None = None) -> AlertmanagerEmulator:
    """启动并返回 emu (调用方负责 stop)."""
    emu = AlertmanagerEmulator(rules_yaml, webhook_url=webhook_url)
    emu.start()
    return emu
