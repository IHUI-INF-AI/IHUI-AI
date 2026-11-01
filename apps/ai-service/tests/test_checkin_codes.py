# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到「今日已签到」幂等码单源判据(2026-11-01 立)。

`is_already_checked_in` 是三个引擎(trae/workbuddy/minimax)唯一允许的「已签标志」判据;
本文件把它钉死,防止任一引擎把码值硬编码回去、或把未知码/布尔/字符串误判成已签。

核心不变量:
- 只认 int(排除 bool):`True == 1`、`False == 0` 会误命中极小码值(minimax 的 2),必须挡掉;
- 未登记平台 / 非 int 类型 / 不在集合内 ⇒ False(判不了就是判不了,绝不洗白);
- 各平台成功码(0)绝不落入已签。
"""

from __future__ import annotations

import pytest

from app.services.checkin_codes import (
    ALREADY_CHECKED_IN_CODES,
    PLATFORM_MINIMAX,
    PLATFORM_TRAE,
    PLATFORM_WORKBUDDY,
    is_already_checked_in,
)


class TestSingleSourceCoverage:
    def test_three_platforms_registered(self):
        assert set(ALREADY_CHECKED_IN_CODES) == {
            PLATFORM_TRAE,
            PLATFORM_WORKBUDDY,
            PLATFORM_MINIMAX,
        }

    @pytest.mark.parametrize(
        "platform,marker",
        [
            (PLATFORM_TRAE, 9095),
            (PLATFORM_WORKBUDDY, 10001),
            (PLATFORM_MINIMAX, 2),
        ],
    )
    def test_known_already_codes_are_recognized(self, platform, marker):
        assert is_already_checked_in(platform, marker) is True

    @pytest.mark.parametrize(
        "platform,marker",
        [
            (PLATFORM_TRAE, 0),  # 成功码,不是已签
            (PLATFORM_TRAE, 9096),  # 邻近码,未登记
            (PLATFORM_WORKBUDDY, 0),
            (PLATFORM_WORKBUDDY, 10002),
            (PLATFORM_MINIMAX, 0),  # 新领取成功,不是已领
            (PLATFORM_MINIMAX, 1),  # 1 不在集合,且不能让 True 误命中
            (PLATFORM_MINIMAX, 3),
        ],
    )
    def test_non_already_codes_rejected(self, platform, marker):
        assert is_already_checked_in(platform, marker) is False


class TestTypeGuards:
    """类型守门:bool / str / None / float 一律不算已签,否则 True==1、字符串"9095"会洗白。"""

    @pytest.mark.parametrize("marker", [True, False])
    def test_bool_never_matches(self, marker):
        # 尤其 minimax 的 2:若漏掉 bool 守门,True(==1)虽不命中 2;但严谨起见全平台挡 bool
        assert is_already_checked_in(PLATFORM_TRAE, marker) is False
        assert is_already_checked_in(PLATFORM_MINIMAX, marker) is False
        assert is_already_checked_in(PLATFORM_WORKBUDDY, marker) is False

    @pytest.mark.parametrize("marker", ["9095", "10001", "2", 9095.0, 10001.0, 2.0])
    def test_non_int_never_matches(self, marker):
        assert is_already_checked_in(PLATFORM_TRAE, marker) is False
        assert is_already_checked_in(PLATFORM_WORKBUDDY, marker) is False
        assert is_already_checked_in(PLATFORM_MINIMAX, marker) is False

    def test_none_never_matches(self):
        assert is_already_checked_in(PLATFORM_TRAE, None) is False

    def test_unknown_platform_never_matches(self):
        assert is_already_checked_in("some-new-platform", 9095) is False
        assert is_already_checked_in("", 10001) is False
