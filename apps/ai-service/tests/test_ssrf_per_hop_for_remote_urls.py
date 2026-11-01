# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""2026-11-01 安全强化:两格裸 httpx 取远端可控 URL 的 SSRF 收口。

射程:
- `app/services/scan_login.py` 取**远端登录页 DOM** 里的 `el.src` / canvas dataURL;
- `app/services/figma_transcoder.py` 取 **Figma 响应 meta.images** 里的地址。
两处此前都是 `follow_redirects=True` 的裸调,而本仓的 SSRF 尺
(`app/services/screenshot_service.py::_validate_url_ssrf`)只在入口看首跳 —— httpx 自己跟的
第二跳绕不过前置判断,所以本枚同时装"入口判一次"与"每跳再过一次"(`event_hooks["request"]`)。

判据只有一份:httpx 侧新增的出口直接调用那把既有的尺,不复制"什么算内网"(§0.6)。
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

import pytest

from app.services import figma_transcoder
from app.services.screenshot_service import (
    SsrfBlockedError,
    _validate_url_ssrf,
    httpx_ssrf_request_hook,
)

SERVICE_DIR = Path(figma_transcoder.__file__).resolve().parent


class _FakeRequest:
    def __init__(self, url: str) -> None:
        self.url = url


class TestHookIsSameRuler:
    @pytest.mark.parametrize(
        "url",
        [
            "http://127.0.0.1/x",
            "http://169.254.169.254/latest/meta-data/",
            "http://10.0.0.8/internal",
            "http://[::1]/x",
        ],
    )
    def test_internal_hop_raises(self, url: str) -> None:
        with pytest.raises(SsrfBlockedError):
            httpx_ssrf_request_hook(_FakeRequest(url))

    def test_public_target_passes(self) -> None:
        """正向对照:整片抛错的钩子也能骗过上面那一组。"""
        httpx_ssrf_request_hook(_FakeRequest("https://www.example.com/a.png"))

    @pytest.mark.parametrize("url", ["http://169.254.169.254/", "http://127.0.0.1/"])
    def test_hook_and_entry_judge_agree(self, url: str) -> None:
        """钩子与入口判据必须同形:两把尺子给出不同结论,就等于没有尺。"""
        ok, _ = _validate_url_ssrf(url)
        assert ok is False


class TestFigmaDownload:
    async def test_internal_url_never_opens_a_client(self, monkeypatch: pytest.MonkeyPatch) -> None:
        touched: list[str] = []

        class _NoClient:
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                touched.append("client-built")

            async def __aenter__(self) -> Any:
                raise AssertionError("内网地址竟然走到了 httpx 客户端")

            async def __aexit__(self, *args: Any) -> None:
                return None

        monkeypatch.setattr(figma_transcoder.httpx, "AsyncClient", _NoClient)
        with pytest.raises(figma_transcoder.FigmaTranscodeError) as caught:
            await figma_transcoder.download_image_data_uri("http://169.254.169.254/latest/meta-data/")
        assert caught.value.code == "FIGMA_FETCH_BLOCKED"
        assert touched == [], "判据应在建客户端之前拦下"

    async def test_wiring_lock_client_carries_per_hop_hook(self) -> None:
        """接线锁(射程 = download_image_data_uri 自己):取远端可控地址那条必须挂逐跳钩子。"""
        src = (SERVICE_DIR / "figma_transcoder.py").read_text(encoding="utf-8")
        tree = ast.parse(src)
        fn = next(
            n
            for n in ast.walk(tree)
            if isinstance(n, ast.AsyncFunctionDef) and n.name == "download_image_data_uri"
        )
        clients = [
            node.items[0].context_expr
            for node in ast.walk(fn)
            if isinstance(node, ast.AsyncWith)
            and isinstance(node.items[0].context_expr, ast.Call)
            and isinstance(node.items[0].context_expr.func, ast.Attribute)
            and node.items[0].context_expr.func.attr == "AsyncClient"
        ]
        assert clients, "射程失效:该函数里已没有 AsyncClient 构造点"
        for call in clients:
            assert "event_hooks" in {k.arg for k in call.keywords}, (
                "AsyncClient 建了却没挂 event_hooks ⇒ 重定向第二跳无人复检"
            )

    def test_shape_lock_figma_api_base_stays_a_literal_constant(self) -> None:
        """同文件的 `_get_json` 走的是**常量主机**,故不挂钩子;这一格钉住它别悄悄变成可配值。

        摘掉本断言的后果不是"少一条红",而是"图省事把 base 改成 env 那一格,顺手把 SSRF
        又开了一个口,而没有任何尺子会响"。真要改成可配,必须同时给那条路径接上逐跳钩子。
        """
        src = (SERVICE_DIR / "figma_transcoder.py").read_text(encoding="utf-8")
        tree = ast.parse(src)
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for t in node.targets:
                    if isinstance(t, ast.Name) and t.id == "FIGMA_API_BASE":
                        assert isinstance(node.value, ast.Constant), (
                            "FIGMA_API_BASE 不再是字面量常量 ⇒ _get_json 那格需要逐跳钩子"
                        )
                        return
        pytest.fail("找不到 FIGMA_API_BASE 常量 ⇒ 本锁的射程已失效")


class TestScanLoginWiring:
    def test_dom_sourced_internal_url_never_opens_a_client(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """越权面的等价物:DOM 给一枚内网地址时,**一个客户端都不许建**(不是"建了但被拦")。"""
        import httpx

        from app.services import scan_login, screenshot_service
        from app.services.scan_login import _extract_qr_image

        built: list[str] = []

        class _BoomClient:
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                built.append("built")
                raise AssertionError("内网 data_url 竟然开始建客户端取图")

        monkeypatch.setattr(httpx, "Client", _BoomClient)

        class _Page:
            def locator(self, _sel: str) -> Any:
                return self

            def count(self) -> int:
                return 1

            def nth(self, _i: int) -> Any:
                return self

            def evaluate(self, _js: str) -> str:
                return "http://169.254.169.254/latest/meta-data/iam/"

        got = _extract_qr_image(_Page(), ("img",))  # type: ignore[arg-type]
        assert got is None or got == "", f"内网地址被当图取回了:{got!r}"
        assert built == [], "入口判据应在建客户端之前就说 No"
        # 反证:判据本体确实说 No(若哪天 _validate_url_ssrf 变哑,上面那条断言就永远成立)
        ok, _ = screenshot_service._validate_url_ssrf("http://169.254.169.254/latest/meta-data/")
        assert ok is False
        assert hasattr(scan_login, "_extract_qr_image")

    def test_dom_sourced_url_is_validated_before_fetch(self) -> None:
        """DOM 取来的 data_url 必须先过尺再 fetch,且客户端带逐跳钩子(源码形状锁)。"""
        src = (SERVICE_DIR / "scan_login.py").read_text(encoding="utf-8")
        assert "_validate_url_ssrf(data_url)" in src, "入口判据没接上"
        assert "httpx_ssrf_request_hook" in src, "逐跳复检没接上"
        tree = ast.parse(src)
        # 射程 = _extract_qr_image 自己(data_url 就是从 DOM 里取出来的那一支)。文件里还有
        # 别的 httpx.Client(取的是本服务自己的常量地址),把它们一起算进这条锁会把判据
        # 撑成"整文件所有客户端都必须挂钩子"—— 那不是本票要判的东西,而是另一条待证的射程。
        fn = next(
            n
            for n in ast.walk(tree)
            if isinstance(n, ast.FunctionDef) and n.name == "_extract_qr_image"
        )
        clients = [
            node
            for node in ast.walk(fn)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "Client"
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "httpx"
        ]
        assert clients, "射程失效:_extract_qr_image 里已没有 httpx.Client 构造点"
        for call in clients:
            assert "event_hooks" in {k.arg for k in call.keywords}, (
                "httpx.Client 建了却没挂 event_hooks ⇒ 重定向第二跳绕开判据"
            )

    def test_module_level_httpx_get_cannot_carry_the_hook(self) -> None:
        """反例档(为什么必须显式 Client):`httpx.get()` 的**类型签名**不吃 event_hooks。

        实测形态:mypy 在 `httpx._api.get` 上报 call-arg,而 `Client.__init__` 有这一参数。
        这一格钉的是"取哪一条 API"的依据,不是品味 —— 便捷 API 靠 **kwargs 透传,类型面上
        不存在,写下去就是一道每次都靠运行时才发现的坑(scan_login 外层是宽 except,
        TypeError 会被静默吞成"这枚候选不行"⇒ 判据看起来接了,实际从没跑过)。
        """
        import inspect

        import httpx

        params = inspect.signature(httpx.get).parameters
        assert "event_hooks" not in params
        assert "event_hooks" in inspect.signature(httpx.Client.__init__).parameters

    def test_reverse_control_ruler_rejects_metadata_endpoint(self) -> None:
        """反例档:判据本体对 169.254.169.254 必须说 False(否则上面的"已接线"只是接了个哑尺)。"""
        ok, _reason = _validate_url_ssrf("http://169.254.169.254/latest/meta-data/")
        assert ok is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
