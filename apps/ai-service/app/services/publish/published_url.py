# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""发布后 URL → 内容 id / 可分享公开链接 的唯一出口。

为什么单独一份(而不是各适配器自己 `url.split("/")[-1]`):**"最后一段就是 id"是个假事实**。
知乎 DOM 流发布后浏览器停在 `https://zhuanlan.zhihu.com/p/<id>/edit` —— 末段是字面量 `edit`,
于是库里 `platform_content_id` 记成 `"edit"`、`published_url` 记成一条**要登录才打得开的编辑页**
(实测 `publish_tasks` id 20–23 四条知乎记录全是这个形态)。后果不止难看:数据回收与
"点开看看是否真发布了"都按这个 id 走,拿 `"edit"` 去查永远查不到 —— 而成功位是 `success=true`,
账面读起来像发出去了。CSDN 同形风险在 query:`.../details/<id>?spm=…` 不剥串就把参数带进 id。

判据要点:**按"段名后面那一段是不是数字"取 id,而不是按位置取末段**;取不到就如实返回空串,
绝不猜(把 `edit` 当 id 就是猜出来的)。
"""
from __future__ import annotations

from urllib.parse import urlsplit

__all__ = ["content_id_after_segment", "public_view_url"]


def content_id_after_segment(url: str, segment: str) -> str:
    """返回 ``/<segment>/<数字>`` 里的那串数字;形态不符一律空串。

    数字校验是判据的全部价值:末段是 ``edit`` / ``edit#comment`` / 空的时候,按位置取会
    把一个词当 id 存进库,而"存了个词"和"存对了 id"在类型上完全同形(都是 str),之后
    没有任何一层会喊。
    """
    try:
        parts = [p for p in urlsplit(url).path.split("/") if p]
    except ValueError:
        return ""
    try:
        i = parts.index(segment)
    except ValueError:
        return ""
    if i + 1 >= len(parts):
        return ""
    candidate = parts[i + 1]
    return candidate if candidate.isdigit() else ""


def public_view_url(url: str, *, segment: str, content_id: str = "", host: str = "") -> str:
    """规范化成**任何人可看**的落地页 URL(剥掉 query 与 fragment)。

    - 拿到 id:统一成 ``<host>/<segment>/<id>``(编辑页 ``/edit`` 自然被丢掉)。``host`` 缺省时
      取该 URL 自己的"协议://域 + /<segment> 之前的路径",所以 CSDN 那种
      ``blog.csdn.net/<用户名>/details/<id>`` 不必调用方再拼一遍用户名。
    - 拿不到 id:至少把 ``?spm=`` / ``#`` 这类尾巴剥掉,别把带跟踪参数的串当公开链接回传。
    """
    cid = content_id or content_id_after_segment(url, segment)
    try:
        parts = urlsplit(url)
    except ValueError:
        return url
    if cid:
        prefix = host.rstrip("/") if host else f"{parts.scheme}://{parts.netloc}"
        if not host:
            seg_parts = [p for p in parts.path.split("/") if p]
            if segment in seg_parts:
                before = "/".join(seg_parts[: seg_parts.index(segment)])
                if before:
                    prefix = f"{prefix}/{before}"
        return f"{prefix}/{segment}/{cid}"
    return f"{parts.scheme}://{parts.netloc}{parts.path}".rstrip("/") or url
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
