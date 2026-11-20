# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""tools 包: LLM 工具调用实现集合。

当前导出:
- generate_chart: 图表生成工具(chart_tools);
- generate_report: 报表/汇报文档生成工具(report_tools,PROJECT_PLAN #81 最小一环);
- parse_document: 文档解析工具(document_tools);
- sheet_formula_eval / sheet_formula_validate: xlsx 公式重算/校验(spreadsheet_formula,
  逐格 provenance + 依赖图 + 结构化错误,零新增依赖);
- init_agents_md: AGENTS.md 草稿生成器(init_agents_md,D118 /init 式生成器);
- create_artifact: G3 统一交付物工具(artifact_tools,html_report/slides/sheet/doc/video_ref);
- create_automation: G2 对话式自动化创建工具(automation_tools,经 apps/api automations 端点);
- ai_bookkeeping / ai_tax_filing: 财务部板块插件(RP-46,2026-11-12,finance_tools,
  AI 一键代账/一键报税,分阶段可续跑,过程经 tool-call 帧实时回显);
- ai_reimbursement: AI 一键报账报销(reimbursement_tools,费用明细 → 进项抵扣 +
  个税口径 + 合规校验 + 分录草案,财务部五腿扩展);
- social_insurance_calc: 社保医保月度缴费精算(social_insurance_tools,逐人五险一金
  + 医保个人账户/统筹拆分 + 基数封顶保底,财务部五腿扩展);
- special_deduction_calc: 个税七项专项附加扣除计算(special_deduction_tools,
  逐人七项明细 + 互斥合规校验,合计直接喂 ai_tax_filing 工资表,财务部五腿扩展)。
"""

from .artifact_tools import create_artifact
from .automation_tools import create_automation
from .browser_selfcheck import capture_screenshot, selfcheck_report
from .chart_tools import generate_chart
from .document_asset_tools import document_tables, extract_document_assets
from .document_tools import parse_document
from .finance_tools import (
    AI_BOOKKEEPING_DESCRIPTION,
    AI_TAX_FILING_DESCRIPTION,
    ai_bookkeeping,
    ai_tax_filing,
)
from .hr_tools import (
    HR_INSURANCE_READINESS_DESCRIPTION,
    HR_MY_ATTENDANCE_DESCRIPTION,
    HR_MY_LEAVES_DESCRIPTION,
    HR_MY_PAYROLL_DESCRIPTION,
    HR_MY_PAYROLL_PERIODS_DESCRIPTION,
    HR_PAYROLL_CALC_DESCRIPTION,
    hr_insurance_readiness,
    hr_my_attendance,
    hr_my_leaves,
    hr_my_payroll,
    hr_my_payroll_periods,
    hr_payroll_calc,
)
from .init_agents_md import init_agents_md
from .payroll_handoff_tools import ai_payroll_handoff
from .reimbursement_tools import AI_REIMBURSEMENT_DESCRIPTION, ai_reimbursement
from .report_tools import generate_report
from .social_insurance_tools import SOCIAL_INSURANCE_DESCRIPTION, social_insurance_calc
from .special_deduction_tools import SPECIAL_DEDUCTION_DESCRIPTION, special_deduction_calc
from .spreadsheet_formula import sheet_formula_eval, sheet_formula_validate
from .web_crawl_tools import crawl_site, extract_web, fetch_readable, map_site

__all__ = [
    "create_artifact",
    "create_automation",
    "generate_chart",
    "generate_report",
    "parse_document",
    "sheet_formula_eval",
    "sheet_formula_validate",
    "extract_document_assets",
    "document_tables",
    "fetch_readable",
    "map_site",
    "crawl_site",
    "extract_web",
    "capture_screenshot",
    "selfcheck_report",
    "init_agents_md",
    "ai_bookkeeping",
    "ai_tax_filing",
    "ai_payroll_handoff",
    "ai_reimbursement",
    "social_insurance_calc",
    "special_deduction_calc",
    "hr_my_payroll",
    "hr_my_payroll_periods",
    "hr_my_attendance",
    "hr_my_leaves",
    "hr_payroll_calc",
    "hr_insurance_readiness",
    "AI_BOOKKEEPING_DESCRIPTION",
    "AI_TAX_FILING_DESCRIPTION",
    "AI_REIMBURSEMENT_DESCRIPTION",
    "SOCIAL_INSURANCE_DESCRIPTION",
    "SPECIAL_DEDUCTION_DESCRIPTION",
    "HR_INSURANCE_READINESS_DESCRIPTION",
    "HR_MY_PAYROLL_DESCRIPTION",
    "HR_MY_PAYROLL_PERIODS_DESCRIPTION",
    "HR_MY_ATTENDANCE_DESCRIPTION",
    "HR_MY_LEAVES_DESCRIPTION",
    "HR_PAYROLL_CALC_DESCRIPTION",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
