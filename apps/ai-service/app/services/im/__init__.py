"""IM 平台适配器包(2026-07-31 立)。

目前包含:
- feishu_lark:飞书 lark-cli 长连接模式 adapter
  (互动卡片 / 文件 / 音视频 / 审批 4 类高级能力)
"""

from .feishu_lark import FeishuLarkAdapter

__all__ = ["FeishuLarkAdapter"]
