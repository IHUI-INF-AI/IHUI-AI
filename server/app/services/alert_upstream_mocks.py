"""8 通道真上游 mock server 集群 (Phase 11-A).

用 stdlib http.server 启动 8 个独立 HTTP 端口,模拟:
  钉钉 (18803) / 企业微信 (18804) / 飞书 (18805) / 邮件 skipped
  PagerDuty (18806) / Slack (18807) / Teams (18808) / Generic (18809)

每个 mock server:
  - POST /webhook: 记录 payload, 返回 200/可配置状态码
  - GET /requests: 返回该 mock 收到的所有请求 (JSON 数组)
  - POST /control: 配置失败次数/状态码/延迟
  - POST /reset: 清空请求历史, 重置控制状态

演练结束后,调用 cluster.stop() 关闭所有 server.
"""

from __future__ import annotations

import json
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class _MockState:
    """单个 mock server 的状态."""

    def __init__(self, name: str):
        self.name = name
        self.requests: deque = deque(maxlen=200)  # 最近 200 个请求
        # 控制位
        self.status_code: int = 200
        self.response_body: str = "ok"
        self.fail_remaining: int = 0  # 模拟 n 次连续失败, 0=不模拟
        self.latency_ms: int = 0  # 模拟网络延迟
        self.lock = threading.Lock()

    def record(self, payload: dict, path: str, headers: dict):
        with self.lock:
            self.requests.append(
                {
                    "ts": time.time(),
                    "path": path,
                    "payload": payload,
                    "headers": dict(headers),
                }
            )

    def effective_status(self) -> int:
        with self.lock:
            if self.fail_remaining > 0:
                self.fail_remaining -= 1
                return 500
            return self.status_code

    def reset(self):
        with self.lock:
            self.requests.clear()
            self.status_code = 200
            self.response_body = "ok"
            self.fail_remaining = 0
            self.latency_ms = 0

    def reset_requests(self):
        """只清请求历史, 保留 control 配置 (status_code / fail_remaining / latency)."""
        with self.lock:
            self.requests.clear()

    def configure(
        self,
        status: int | None = None,
        body: str | None = None,
        fail_remaining: int | None = None,
        latency_ms: int | None = None,
    ):
        with self.lock:
            if status is not None:
                self.status_code = status
            if body is not None:
                self.response_body = body
            if fail_remaining is not None:
                self.fail_remaining = max(0, fail_remaining)
            if latency_ms is not None:
                self.latency_ms = max(0, latency_ms)


def make_handler(state: _MockState):
    """工厂: 为给定 state 创建 HTTP handler 类."""

    class _Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):  # 抑制默认 stderr 输出
            return

        def _read_body(self) -> bytes:
            n = int(self.headers.get("Content-Length", 0) or 0)
            return self.rfile.read(n) if n > 0 else b""

        def _send_json(self, code: int, body: dict):
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _send_text(self, code: int, body: str):
            data = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_POST(self):
            body = self._read_body()
            try:
                payload = json.loads(body.decode("utf-8")) if body else {}
            except Exception:
                payload = {"_raw": body.decode("utf-8", errors="replace")}

            path = self.path
            if path == "/webhook":
                # headers 统一小写化, 避免 Authorization vs authorization 的大小写问题
                state.record(payload, path, {k.lower(): v for k, v in self.headers.items()})
                import os as _os

                if _os.environ.get("ZHS_MOCK_DEBUG"):
                    print(
                        f"[MOCK {state.name}] status={state.status_code} fail_remaining={state.fail_remaining} path={path}",
                        flush=True,
                    )
                if state.latency_ms > 0:
                    time.sleep(state.latency_ms / 1000.0)
                code = state.effective_status()
                # 不同通道的"成功"响应形态
                if state.name in ("slack",):
                    self._send_text(200 if code < 400 else code, state.response_body)
                elif state.name == "teams":
                    self._send_text(200 if code < 400 else code, "1" if code < 400 else "0")
                elif state.name == "dingtalk" or state.name == "wechat":
                    if code < 400:
                        self._send_json(200, {"errcode": 0, "errmsg": "ok"})
                    else:
                        self._send_json(code, {"errcode": -1, "errmsg": "fail"})
                elif state.name == "feishu":
                    if code < 400:
                        self._send_json(200, {"code": 0, "msg": "ok"})
                    else:
                        self._send_json(code, {"code": -1, "msg": "fail"})
                elif state.name == "pagerduty":
                    if code < 400:
                        self._send_json(
                            202,
                            {
                                "status": "success",
                                "message": "Event processed",
                                "dedup_key": payload.get("dedup_key", "x"),
                            },
                        )
                    else:
                        self._send_json(code, {"status": "invalid event", "message": "fail"})
                elif state.name == "generic":
                    if code < 400:
                        self._send_json(200, {"ok": True})
                    else:
                        self._send_json(code, {"ok": False})
                else:
                    self._send_text(200, "ok")
            elif path == "/control":
                state.configure(
                    status=payload.get("status_code"),
                    body=payload.get("response_body"),
                    fail_remaining=payload.get("fail_remaining"),
                    latency_ms=payload.get("latency_ms"),
                )
                self._send_json(200, {"ok": True, "config": self._snapshot()})
            elif path == "/reset":
                state.reset()
                self._send_json(200, {"ok": True})
            else:
                self._send_text(404, "not found")

        def do_GET(self):
            if self.path == "/requests":
                with state.lock:
                    self._send_json(
                        200,
                        {
                            "name": state.name,
                            "count": len(state.requests),
                            "requests": list(state.requests),
                        },
                    )
            elif self.path == "/config":
                self._send_json(200, self._snapshot())
            else:
                self._send_text(404, "not found")

        def _snapshot(self):
            return {
                "name": state.name,
                "status_code": state.status_code,
                "response_body": state.response_body,
                "fail_remaining": state.fail_remaining,
                "latency_ms": state.latency_ms,
            }

    return _Handler


# ---------------------------------------------------------------------------
# 8 通道 mock 集群
# ---------------------------------------------------------------------------

# 默认端口分配 (18803-18810)
DEFAULT_PORTS = {
    "dingtalk": 18803,
    "wechat": 18804,
    "feishu": 18805,
    "pagerduty": 18806,
    "slack": 18807,
    "teams": 18808,
    "generic": 18809,
    "extra": 18810,  # 备用通道, 用于 PagerDuty 备选路由
}

# 测试用端口分配 (避免与生产演练脚本冲突)
TEST_PORTS = {
    "dingtalk": 18903,
    "wechat": 18904,
    "feishu": 18905,
    "pagerduty": 18906,
    "slack": 18907,
    "teams": 18908,
    "generic": 18909,
    "extra": 18910,
}


class UpstreamMockServer:
    """单个上游 mock server."""

    def __init__(self, name: str, port: int, host: str = "127.0.0.1"):
        self.name = name
        self.port = port
        self.host = host
        self.state = _MockState(name)
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._base_url = f"http://{host}:{port}"

    def start(self) -> None:
        if self._server:
            return
        handler = make_handler(self.state)
        try:
            self._server = ThreadingHTTPServer((self.host, self.port), handler)
        except OSError as e:
            raise RuntimeError(f"upstream mock {self.name} port {self.port} bind failed: {e}") from e
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        if self._server:
            self._server.shutdown()
            self._server.server_close()
            self._server = None
            self._thread = None

    def url(self, path: str = "/webhook") -> str:
        return f"{self._base_url}{path}"

    def requests(self) -> list:
        with self.state.lock:
            return list(self.state.requests)

    def reset(self) -> None:
        self.state.reset()

    def configure(self, **kwargs) -> None:
        self.state.configure(**kwargs)

    def wait_ready(self, timeout: float = 5.0) -> bool:
        import socket

        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                with socket.create_connection((self.host, self.port), timeout=0.5):
                    return True
            except OSError:
                time.sleep(0.05)
        return False


class UpstreamMockCluster:
    """8 通道上游 mock 集群."""

    def __init__(self, host: str = "127.0.0.1", ports: dict | None = None):
        self.host = host
        self.ports = ports or dict(DEFAULT_PORTS)
        self.servers = {name: UpstreamMockServer(name, port, host) for name, port in self.ports.items()}

    def start(self) -> None:
        for s in self.servers.values():
            s.start()
        # 等全部就绪
        for s in self.servers.values():
            if not s.wait_ready():
                raise RuntimeError(f"upstream mock {s.name} did not become ready")

    def stop(self) -> None:
        for s in self.servers.values():
            s.stop()

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *args):
        self.stop()

    def all_requests(self) -> dict:
        return {name: s.requests() for name, s in self.servers.items()}

    def reset_all(self) -> None:
        """只清请求历史, 保留 control 配置 (status_code / fail_remaining / latency).

        设计原则: 测试里常见用法是 `configure("slack", status_code=500) + reset_all()`,
        期望"清空历史开始下一轮, 但配置保留". 这里不能简单调 s.reset() (会清掉配置).
        """
        for s in self.servers.values():
            s.state.reset_requests()

    def summary(self) -> dict:
        """每个 upstream 的简要状态."""
        return {name: {"port": s.port, "received": len(s.requests())} for name, s in self.servers.items()}

    def configure(self, name: str, **kwargs) -> None:
        if name not in self.servers:
            raise KeyError(f"unknown mock: {name}, available: {list(self.servers)}")
        # 兼容 status_code 别名
        if "status_code" in kwargs and "status" not in kwargs:
            kwargs["status"] = kwargs.pop("status_code")
        self.servers[name].configure(**kwargs)
