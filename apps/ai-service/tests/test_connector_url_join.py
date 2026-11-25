# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器 URL 拼接去重(2026-11-25)。

平台台账里部分 API 的 path 自带与 base_url 相同的路径段(飞书 /open-apis、
企微 /cgi-bin),旧执行层 f"{base_url}{path}" 拼出双前缀,上游必 404。
本文件钉住 _join_url 的通用去重行为及"无重复时绝不改行为"的边界。
"""
from __future__ import annotations

import pytest

from app.services.connectors.custom_http import _join_url


@pytest.mark.parametrize(
    "base_url, path, expected",
    [
        # 飞书双前缀:台账 base_url=/open-apis 且 path=/open-apis/...
        (
            "https://open.feishu.cn/open-apis",
            "/open-apis/im/v1/messages",
            "https://open.feishu.cn/open-apis/im/v1/messages",
        ),
        # 企微双前缀:base_url=/cgi-bin 且 path=/cgi-bin/...
        (
            "https://qyapi.weixin.qq.com/cgi-bin",
            "/cgi-bin/message/send",
            "https://qyapi.weixin.qq.com/cgi-bin/message/send",
        ),
        # path 恰好等于 base path:去掉整段后为空,回落 "/"
        (
            "https://open.feishu.cn/open-apis",
            "/open-apis",
            "https://open.feishu.cn/open-apis/",
        ),
        # base_url 带尾部斜杠:应先 rstrip 再去重
        (
            "https://open.feishu.cn/open-apis/",
            "/open-apis/im/v1/messages",
            "https://open.feishu.cn/open-apis/im/v1/messages",
        ),
        # base path 为空(www.feishu.cn + /approval/...):原样拼接,不改行为
        (
            "https://www.feishu.cn",
            "/approval/openapi/v1/approvalInstances",
            "https://www.feishu.cn/approval/openapi/v1/approvalInstances",
        ),
        # base path 为空(oapi.dingtalk.com + /topapi/...):原样拼接,不改行为
        (
            "https://oapi.dingtalk.com",
            "/topapi/processinstance/create",
            "https://oapi.dingtalk.com/topapi/processinstance/create",
        ),
        # base path 非空但 path 不以其开头:原样拼接(如飞书取 token 的 path)
        (
            "https://open.feishu.cn/open-apis",
            "/auth/v3/tenant_access_token/internal",
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        ),
        # 只去整段,不误删相似前缀(/apix 不是 /api 的子路径)
        (
            "https://example.invalid/api",
            "/apix/foo",
            "https://example.invalid/api/apix/foo",
        ),
    ],
)
def test_join_url_dedupes_base_path_prefix(base_url, path, expected):
    """去重只发生在"path 开头整段等于 base_url 的 URL path"时。"""
    assert _join_url(base_url, path) == expected


def test_join_url_trailing_slash_on_bare_host():
    """裸 host 带尾斜杠时 rstrip,仍不引入额外斜杠。"""
    assert (
        _join_url("https://www.feishu.cn/", "/approval/openapi/v1/x")
        == "https://www.feishu.cn/approval/openapi/v1/x"
    )
