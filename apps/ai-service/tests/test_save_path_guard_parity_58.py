# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

"""落盘后缀白名单「唯一权威源」守卫(2026-09-21 由跨实现 parity 改写)。

历史与本测试的形态变化:
- 原形态:断言 `image_saver._SAVE_PATH_EXTENSIONS` 与 `mcp_server._IMAGE_EXTENSIONS`
  逐元素相同 —— 起因是仓里存在**两份** save_path 校验实现,且未接线那份的黑名单比
  权威源少 `.next`(拿宽松版替换严格版会静默削掉防线,本仓出过同类事故)。
- 当日按 §7 收敛:线上 3 个图片工具走的是 `mcp_server._validate_image_save_path`,
  等价实现确实存在 ⇒ 删除零消费方的 `app/services/image_saver.py` 与
  `app/services/dispatch_helper.py`。两份实现变一份,"两处必须一致"的断言随之失效,
  本文件改为钉**权威源自身**的取值/形式/行为,并拦截"第二份副本被重新引入"。
- 敏感目录黑名单那条轴由 `test_path_guard_parity_58.py` 继续守卫(它断言
  `file_editor._SENSITIVE_DIR_PATTERNS is path_guard.SENSITIVE_DIR_PATTERN`,
  即对象同一而非复制字面量)。
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import mcp_server as ms  # noqa: E402

# 线上唯一权威源应锁定的落盘后缀(扩充需显式改这里 + 说明理由)
_PINNED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def test_live_extension_whitelist_is_exactly_the_pinned_set() -> None:
    assert set(ms._IMAGE_EXTENSIONS) == _PINNED_EXTENSIONS


def test_extensions_are_lowercase_and_dotted() -> None:
    """形式约束:小写 + 带前导点,否则 `splitext(...).lower()` 比对会静默失效。"""
    for ext in ms._IMAGE_EXTENSIONS:
        assert ext.startswith("."), f"{ext} 缺少前导点"
        assert ext == ext.lower(), f"{ext} 必须小写"


@pytest.mark.parametrize("bad_path", ["out/img.gif", "out/img.bmp", "out/img", "/tmp/x.EXE"])
def test_validator_rejects_every_non_whitelisted_suffix(bad_path: str) -> None:
    ok, _resolved, err = ms._validate_image_save_path(bad_path)
    assert ok is False
    assert err == "INVALID_EXTENSION", f"{bad_path} 未在后缀白名单内却未被拦(实得 {err})"


@pytest.mark.parametrize("suffix", sorted(_PINNED_EXTENSIONS))
def test_validator_accepts_whitelisted_suffixes_past_the_extension_gate(suffix: str) -> None:
    """白名单内后缀不得再被判 INVALID_EXTENSION(工作区闸门是否放行由各自测试负责)。"""
    _ok, _resolved, err = ms._validate_image_save_path(f"out/pic{suffix}")
    assert err != "INVALID_EXTENSION"


def test_no_second_implementation_reappears() -> None:
    """防回潮:被删的两份未接线副本不得被重新引入而不做说明。

    若确有需要再写一份,必须先让它**复用** path_guard / mcp_server 的权威源,
    并在本测试里说明为何不能直接调用权威源 —— 复制字面量正是当年漂移的成因。
    """
    for gone in ("app.services.image_saver", "app.services.dispatch_helper"):
        assert importlib.util.find_spec(gone) is None, f"{gone} 又出现了第二份实现"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
