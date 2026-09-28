# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-707: HTTP-date 先验形 + 解析后 canonical 回比(票面验收夹具,2026-09-29 立)。

票面判据:宽松解析(Date.parse / email.utils)接受但**实际不存在**的日期
(如 `Fri, 32 Jan 2026 10:00:00 GMT`)必须回落 None,不得固化成合法等待时长;
正向对照(RFC-1123/IMF-fixdate 合法值)给出正确秒数。另钉一类旧实现**真的放过**
的形态:星期与日历矛盾(`Mon, 06 Nov 2022`,该日实为 Sunday)—— 裸
`parsedate_to_datetime` 照样接受,canonical 回比必拒。
纯函数测试,无 DB / 网络(不触生产 PG 8810 / Redis 8811)。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from email.utils import format_datetime

from app.core.retry_after import (
    _parse_http_date_seconds,
    extract_server_retry_hint,
    parse_retry_after_seconds,
)

NONEXISTENT_DATE = "Fri, 32 Jan 2026 10:00:00 GMT"


def test_nonexistent_date_returns_none() -> None:
    """票面夹具:32 Jan 2026 不存在 ⇒ None,三层出口一致(私有/公开/完整 hint 链)。"""
    assert _parse_http_date_seconds(NONEXISTENT_DATE) is None
    assert parse_retry_after_seconds(NONEXISTENT_DATE) is None
    hint = extract_server_retry_hint({"Retry-After": NONEXISTENT_DATE})
    assert hint.retry_after_s is None
    # 明示不重试与否不受影响(坏 date 只让等待指示回落 None,不干预 should_retry)
    assert hint.should_retry is True


def test_valid_imf_fixdate_returns_expected_seconds() -> None:
    """正向对照:RFC-1123 合法值 ⇒ 距今约 30s(窗口留时钟抖动余量)。"""
    when = datetime.now(UTC) + timedelta(seconds=30)
    raw = format_datetime(when, usegmt=True)
    value = parse_retry_after_seconds(raw)
    assert value is not None
    assert 20.0 <= value <= 31.5


def test_past_valid_date_clamped_to_zero() -> None:
    when = datetime.now(UTC) - timedelta(seconds=120)
    assert parse_retry_after_seconds(format_datetime(when, usegmt=True)) == 0.0


def test_weekday_mismatch_rejected_but_true_weekday_accepted() -> None:
    """回比的牙:2026-04-29 实为 Wednesday。

    旧实现(裸 parsedate)把 "Tue, 29 Apr 2026 ..." 当合法值接受 —— 星期与日历矛盾
    是坏表头/篡改头的形态之一;canonical 回比不等 ⇒ None。
    同一时刻配正确星期 ⇒ 仍解析(证明拦的是星期字段,不是整个形态判不进)。
    """
    when = datetime(2026, 4, 29, 10, 0, 0, tzinfo=UTC)
    canonical = format_datetime(when, usegmt=True)
    assert canonical.startswith("Wed"), f"夹具前提不成立:{canonical!r}"
    mismatched = canonical.replace("Wed", "Tue", 1)
    assert parse_retry_after_seconds(mismatched) is None
    assert parse_retry_after_seconds(canonical) == 0.0  # 过去时刻夹 0,仍是合法形态


def test_rfc850_legacy_two_digit_year_still_valid() -> None:
    """RFC 850 是合法 HTTP-date:两位年份按 _parsedate_tz 同规则展开后回比必须相等。"""
    # 2022-11-06(Sunday),过去 ⇒ 0.0
    assert _parse_http_date_seconds("Sunday, 06-Nov-22 08:34:01 GMT") == 0.0


def test_asctime_legacy_form_still_valid() -> None:
    """asctime 是合法 HTTP-date(无时区,按既有语义当 UTC)。"""
    assert _parse_http_date_seconds("Sun Nov  6 08:34:01 2022") == 0.0


def test_non_utc_offset_and_garbage_rejected() -> None:
    """HTTP-date 规范时区只有 GMT:偏移/乱码/空串一律 None(回落本地退避曲线)。"""
    assert _parse_http_date_seconds("Sun, 06 Nov 2022 08:34:01 +0800") is None
    assert _parse_http_date_seconds("not a date") is None
    assert _parse_http_date_seconds("") is None


def test_out_of_range_numbers_rejected() -> None:
    """越界数字(旧实现靠 datetime 构造器巧合兜底;现在有形状预验+回比双保险)。"""
    assert _parse_http_date_seconds("Sun, 06 Nov 2022 25:34:01 GMT") is None
    assert _parse_http_date_seconds("Sun, 30 Feb 2026 08:34:01 GMT") is None
    assert _parse_http_date_seconds("Sun, 06 Nov 2022 08:34:60 GMT") is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
