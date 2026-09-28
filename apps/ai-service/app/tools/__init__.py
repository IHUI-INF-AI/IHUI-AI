# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""tools 包: LLM 工具调用实现集合。

当前导出:
- generate_chart: 图表生成工具(chart_tools);
- generate_report: 报表/汇报文档生成工具(report_tools,PROJECT_PLAN #81 最小一环);
- parse_document: 文档解析工具(document_tools)。
"""

from .browser_selfcheck import capture_screenshot, selfcheck_report
from .chart_tools import generate_chart
from .document_asset_tools import document_tables, extract_document_assets
from .document_tools import parse_document
from .report_tools import generate_report
from .web_crawl_tools import crawl_site, extract_web, fetch_readable, map_site

__all__ = [
    "generate_chart",
    "generate_report",
    "parse_document",
    "extract_document_assets",
    "document_tables",
    "fetch_readable",
    "map_site",
    "crawl_site",
    "extract_web",
    "capture_screenshot",
    "selfcheck_report",
]
