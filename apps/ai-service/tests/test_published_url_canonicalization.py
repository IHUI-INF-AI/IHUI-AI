# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""发布后 URL → 内容 id / 公开链接 的取法(唯一出口 `published_url.py`)。

立票实证形态(逐字取自 `publish_tasks` 里 2026-09-14/15 四条知乎记录):
    published_url            = https://zhuanlan.zhihu.com/p/2083161745141535682/edit
    platform_content_id      = "edit"
DOM 流发布后浏览器停在**编辑页**，旧实现按"路径最后一段"取 id ⇒ 把词 `edit` 当 id 存进库，
并把一条**要登录才打得开**的编辑页 URL 当公开链接回传。`success=true` 一切照常，
只有事后想"点开看看是否真发布了"或按 id 回收数据时才会发现那格是空的。
"""
from __future__ import annotations

from app.services.publish.published_url import content_id_after_segment, public_view_url

# 真仓实测值(不是自造夹具)：§22c 的"判据的对象是真实文件形态时，输入必须逐字取自真件"
ZHIHU_EDIT_URL = "https://zhuanlan.zhihu.com/p/2083161745141535682/edit"
ZHIHU_PUBLIC_URL = "https://zhuanlan.zhihu.com/p/2083161745141535682"
CSDN_TRACKED_URL = "https://blog.csdn.net/qq_12345678/article/details/140000001?spm=1018.2226.3001.5502"


def test_id_is_taken_by_segment_name_not_by_position() -> None:
    """核心判据：`/p/<数字>` 才算 id；末段是词就返回空串，绝不把词当 id。"""
    assert content_id_after_segment(ZHIHU_EDIT_URL, "p") == "2083161745141535682"
    assert content_id_after_segment(ZHIHU_PUBLIC_URL, "p") == "2083161745141535682"
    assert content_id_after_segment(ZHIHU_PUBLIC_URL + "/", "p") == "2083161745141535682"
    # 反向：旧写法的产出正是这三型
    assert content_id_after_segment("https://zhuanlan.zhihu.com/p/edit", "p") == ""
    assert content_id_after_segment("https://zhuanlan.zhihu.com/", "p") == ""
    assert content_id_after_segment("https://www.zhihu.com/question/1/answer/2", "p") == ""


def test_public_url_drops_edit_page_and_tracking_tail() -> None:
    """编辑页要归一化成公开页；拿不到 id 时至少剥掉 `?spm=` / `#` 尾巴。"""
    assert public_view_url(ZHIHU_EDIT_URL, segment="p") == ZHIHU_PUBLIC_URL
    # CSDN 的路径前缀在 /details/ 之前(用户名 + article)，不拼 host 也要能还原
    assert (
        public_view_url(CSDN_TRACKED_URL, segment="details")
        == "https://blog.csdn.net/qq_12345678/article/details/140000001"
    )
    # 取不到 id：不得把带跟踪参数的串原样回传
    stripped = public_view_url("https://blog.csdn.net/x/article/preview?spm=1.2#c", segment="details")
    assert "?" not in stripped and "#" not in stripped
    assert stripped.endswith("/x/article/preview")


def test_explicit_host_wins_over_derived_prefix() -> None:
    """知乎 DOM 流可能停在 `www.zhihu.com` 域上，但公开读法只有 `zhuanlan` 子域 —— 显式 host 优先。"""
    assert (
        public_view_url(
            "https://www.zhihu.com/p/999/edit",
            segment="p",
            host="https://zhuanlan.zhihu.com",
        )
        == "https://zhuanlan.zhihu.com/p/999"
    )


def test_garbage_input_degrades_to_empty_not_to_a_fake_id() -> None:
    """`urlsplit` 真会抛 ValueError 的那一型(残缺 IPv6)⇒ 判据落空串，绝不编一个 id 出来。

    反面教材：带 NUL 或超范围端口的串在这里**不抛**（实测），所以 `except ValueError`
    只覆盖 IPv6 那一型 —— 本例用的就是这个能抛的输入，而不是想象出来的输入。
    """
    bad = "http://[::1/p/123"
    assert content_id_after_segment(bad, "p") == ""
    assert public_view_url(bad, segment="p") == bad
