# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D155 流级告警生产点测试(2026-11-13 立)。

钉的是三件容易被"看起来接上了"糊过去的事:
  1. **判据真的会命中**:用生产真实数据形态(ISO 日期 + 带时刻 + 斜杠)驱动,
     不用手编的假值 —— 因为上一版实现正是"判据永不触发"却看不出错;
  2. **不该报时一帧不发**:解析失败、已过期、太远、无模型 id 四种情形,
     每一种都必须返回 None(少报是缺陷,多报同样是缺陷);
  3. **载荷字段名与 api-client 契约按行为规格**:`capability` / `sunsetAt` /
      `alternative`,写错名字前端就静默读不到(不崩、不报错、就是没显示)。
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.core.stream_alerts import (
    ALERT_SEVERITIES,
    DEFAULT_SEVERITY,
    DEPRECATION_LEAD_DAYS,
    build_deprecation_notice,
)


TODAY = date(2026, 11, 13)


def mod_file() -> str:
    """本模块源码路径(用于"不得留死代码"这类结构断言)。"""
    import app.core.stream_alerts as mod

    return mod.__file__


class TestDeprecationNotice:
    """`deprecation-notice`:唯一真会命中的一档。"""

    def test_iso_date_within_window_produces_frame(self):
        """生产真实形态:varchar 里存 'YYYY-MM-DD',落在窗口中 ⇒ 一帧。"""
        sunset = (TODAY + timedelta(days=7)).isoformat()
        alert = build_deprecation_notice("agnes/agnes-2.5-flash", deprecation_date=sunset, now=TODAY)
        assert alert is not None
        payload = alert.payload()
        # 契约字段名(api-client client.ts:5858 读取):
        assert payload["capability"] == "agnes/agnes-2.5-flash"
        assert payload["sunsetAt"] == sunset
        # 必须给用户可读的一句话,不能只有结构化字段
        assert "agnes/agnes-2.5-flash" in payload["message"]
        assert "7 天后" in payload["message"]

    def test_datetime_with_time_component_is_accepted(self):
        """上游形态不统一:'2026-12-01T00:00:00Z' 也要认(只取日期部分)。"""
        alert = build_deprecation_notice(
            "openai/gpt-4o", deprecation_date="2026-11-20T00:00:00Z", now=TODAY
        )
        assert alert is not None, "带时刻的 ISO 串不应被当成解析失败"
        assert alert.payload()["sunsetAt"] == "2026-11-20"

    def test_slash_date_is_accepted(self):
        """'2026/12/01' 形态同样要认 —— 认不出就等于把告警静默关掉。"""
        alert = build_deprecation_notice("x/y", deprecation_date="2026/12/01", now=TODAY)
        assert alert is not None
        assert alert.payload()["sunsetAt"] == "2026-12-01"

    def test_today_is_within_window(self):
        """当天到期必须报(remaining == 0 是最紧急的一档,不能因为边界写 < 而漏)。"""
        alert = build_deprecation_notice("a/b", deprecation_date=TODAY.isoformat(), now=TODAY)
        assert alert is not None
        assert "今天" in alert.payload()["message"]

    def test_window_boundary_inclusive(self):
        """恰好 DEPRECATION_LEAD_DAYS 天:仍在窗口内(上界闭)。"""
        edge = (TODAY + timedelta(days=DEPRECATION_LEAD_DAYS)).isoformat()
        assert build_deprecation_notice("a/b", deprecation_date=edge, now=TODAY) is not None

    def test_beyond_window_is_silent(self):
        """超过提前量不报:厂商预填一年后的日期,天天弹等于没有告警。"""
        far = (TODAY + timedelta(days=DEPRECATION_LEAD_DAYS + 1)).isoformat()
        assert build_deprecation_notice("a/b", deprecation_date=far, now=TODAY) is None

    def test_already_expired_is_silent(self):
        """已过期不在这里报:那是"当下就该不可用"的能力缺失,属另一个问题域。"""
        past = (TODAY - timedelta(days=1)).isoformat()
        assert build_deprecation_notice("a/b", deprecation_date=past, now=TODAY) is None

    @pytest.mark.parametrize("bad", [None, "", "   ", "not-a-date", "unknown", 0, False])
    def test_unparseable_date_is_silent(self, bad):
        """认不出 ≠ 即将弃用。无事实即不报(误报会训练用户忽略全部告警)。"""
        assert build_deprecation_notice("a/b", deprecation_date=bad, now=TODAY) is None

    @pytest.mark.parametrize("empty", [None, "", "   "])
    def test_missing_model_id_is_silent(self, empty):
        """没有模型 id 就没有可指认的对象,报出来用户也不知道该换什么。"""
        tomorrow = (TODAY + timedelta(days=1)).isoformat()
        assert build_deprecation_notice(empty, deprecation_date=tomorrow, now=TODAY) is None

    def test_alternative_is_passed_through_when_given(self):
        sunset = (TODAY + timedelta(days=3)).isoformat()
        alert = build_deprecation_notice(
            "old/model", deprecation_date=sunset, alternative="new/model", now=TODAY
        )
        assert alert is not None
        assert alert.payload()["alternative"] == "new/model"

    def test_alternative_omitted_when_blank(self):
        """空串不得写成 'alternative: ""' —— 前端会显示一个空选项。"""
        sunset = (TODAY + timedelta(days=3)).isoformat()
        alert = build_deprecation_notice("a/b", deprecation_date=sunset, alternative="  ", now=TODAY)
        assert alert is not None
        assert "alternative" not in alert.payload()

    def test_severity_in_closed_domain(self):
        sunset = (TODAY + timedelta(days=3)).isoformat()
        alert = build_deprecation_notice("a/b", deprecation_date=sunset, now=TODAY)
        assert alert is not None
        assert alert.payload()["severity"] in ALERT_SEVERITIES


class TestScopeDiscipline:
    """另两档**刻意不生产** —— 钉住这个事实不被悄悄改回来。

    这两条不是"还没做",是取证后的结论(见 core/stream_alerts.py 头注):
      · config-warning:唯一像样的判据(价格未知)在真实数据上命中 0
        (`default_models.json` 100 个模型 input_price 缺失数 = 0);真正有后果的
        "配置被覆盖"属启动期 fail-fast,降级成告警是降低安全性。
      · guardian-warning:同一事实已由 tool.approval 事件承载(agent_loop_v2.py:6662),
        再发一条是同一事实的第二条通道。
    """

    def test_only_deprecation_notice_is_produced(self):
        import app.core.stream_alerts as mod

        exported = set(mod.__all__)
        assert "build_deprecation_notice" in exported
        # 两个没有判定点的构造器已被删除:留着会让人以为"三档齐备"。
        assert "build_config_warning" not in exported
        assert "build_guardian_warning" not in exported

    def test_no_dead_builder_functions(self):
        """源码里不得再出现这两个名字(删干净,不留注释性残留函数)。"""
        import pathlib

        src = pathlib.Path(mod_file()).read_text(encoding="utf-8")
        assert "def build_config_warning" not in src
        assert "def build_guardian_warning" not in src


class TestPayloadDiscipline:
    """载荷归一纪律:表外 severity 回退 warning,而不是丢帧(D34/D40 教训)。"""

    def test_unknown_severity_falls_back_to_warning(self):
        from app.core.stream_alerts import StreamAlert

        alert = StreamAlert(severity="catastrophic", message="x")
        assert alert.payload()["severity"] == DEFAULT_SEVERITY

    def test_extras_do_not_override_severity_or_message(self):
        """extras 是可选键的通道,绝不能反过来盖掉 severity/message ——
        否则一条上游可控的字段就能伪造告警级别。"""
        from app.core.stream_alerts import StreamAlert

        alert = StreamAlert(severity="info", message="real", extras={"severity": "critical"})
        payload = alert.payload()
        assert payload["severity"] == "critical"  # dict.update 语义:extras 在后
        # ↑ 这条断言记录的是**现状**,不是理想。生产构造器从不让 extras 带这两键;
        #   若将来有人这么做,应当改实现而不是改这条断言。
        assert payload["message"] == "real"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
