# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器自动化点位包(2026-11-24 补口)。

为什么单独一份:
    `finance_tools.PLATFORM_TARGETS` 只有"步骤叙述 + 运行时自己找选择器",模型每轮都要
    从截图重新猜入口,同一步在不同会话里点出两种结果;导出/回执也没有统一采集口径。
    本文件把每个对外平台的**点位**固化成结构化包:
        entry(入口/登录态探测) → points(带候选定位器、探测顺序、期望态、回执) → guards(红线)。

设计纪律:
    1. 选择器一律是**候选**(各省页面不同),必须按 probe_order 逐个试,命中即记录;
       连续两轮不中即停目标上报 SELECTOR_NOT_FOUND,绝不换路径绕过验证码/人脸/U 盾。
    2. `never_click` 是绝对红线:缴款、作废、删除、红字上传等资金/不可逆动作
       即使页面上有同名按钮也不点。
    3. `manual_gate` 是人工闸:最终提交/缴费确认只能停在按钮前,由人点击。
    4. 回执必须可追溯:截图 + 受理号/回执号文本 + 下载文件名三者至少一项,
       拿不到就标 `receipt_missing`,不得口头宣称"已申报成功"。
"""

from __future__ import annotations

from typing import Any

POINT_PACK_VERSION = "2026.11.24"

#: 所有目标共用的探测与回执纪律
COMMON_CONTRACT: dict[str, Any] = {
    "locate_before_act": "先 browser_screenshot / browser_extract_dom 探明再动作;坐标与选择器不得凭空写",
    "probe_order": ["role+name", "text_exact", "text_contains", "css_candidate", "xpath_contains"],
    "max_probe_attempts": 2,
    "on_selector_miss": "停该目标,回报 SELECTOR_NOT_FOUND + 当前截图 + 已试定位器;禁止改用猜测坐标",
    "frame_policy": "入口/表单可能在 iframe:extract_dom 返回 frame 信息时先切 frame 再定位",
    "login_policy": "检测到登录页/二维码/人脸/短信/CA 提示 ⇒ request_human_login,不代填账号密码",
    "receipt_policy": "每目标结束必须留 receipt(kind=download|confirmation_no|screenshot);缺一即 receipt_missing",
    "amount_check": "平台测算税额/缴费额与本系统草案逐项比对;差额 > 0.01 元即停,如实上报差异字段",
}

#: 平台无关的入口探测点(登录态、验证码、会话失效)
_LOGIN_POINTS: list[dict[str, Any]] = [
    {
        "key": "login_state",
        "stage": "preflight",
        "intent": "确认是否已登录且为正确企业身份",
        "locators": [
            {"by": "url_contains", "value": "login", "means": "not_logged_in"},
            {"by": "text_contains", "value": "扫码登录", "means": "not_logged_in"},
            {"by": "text_contains", "value": "退出登录", "means": "logged_in"},
            {"by": "text_contains", "value": "纳税人名称", "means": "logged_in"},
        ],
        "on_not_logged_in": "request_human_login",
        "receipt": "screenshot",
    },
    {
        "key": "captcha_or_gate",
        "stage": "preflight",
        "intent": "识别验证码/人脸/U 盾/短信拦截",
        "locators": [
            {"by": "text_contains", "value": "验证码"},
            {"by": "text_contains", "value": "人脸识别"},
            {"by": "text_contains", "value": "请插入税控设备"},
        ],
        "on_hit": "stop_and_request_human",
        "receipt": "screenshot",
    },
]


def _point(
    key: str,
    stage: str,
    intent: str,
    locators: list[dict[str, str]],
    *,
    action: str = "click",
    expect: str = "",
    receipt: str = "screenshot",
    value_template: str = "",
    optional: bool = False,
) -> dict[str, Any]:
    return {
        "key": key,
        "stage": stage,
        "intent": intent,
        "action": action,
        "locators": locators,
        "probe_order": COMMON_CONTRACT["probe_order"],
        "expect": expect,
        "receipt": receipt,
        "value_template": value_template,
        "optional": optional,
    }


#: 8 个对外平台点位包。id 与 finance_tools.PLATFORM_TARGETS 对齐(新增 housing_fund)。
PLAYBOOKS: dict[str, dict[str, Any]] = {
    "etax_invoice_ledger": {
        "label": "电子税务局·发票底账取数",
        "surface": "browser",
        "entry": {"url": "{etax_portal}", "path_hint": "我要办税 > 税务数字账户 > 发票业务/发票查询统计"},
        "points": [
            *_LOGIN_POINTS,
            _point(
                "open_tax_digital_account",
                "navigate",
                "进入税务数字账户",
                [
                    {"by": "text_exact", "value": "税务数字账户"},
                    {"by": "text_contains", "value": "数字账户"},
                    {"by": "css_candidate", "value": "a[href*='digital-account'],a[href*='fphx']"},
                ],
                expect="出现发票查询/勾选入口",
            ),
            _point(
                "open_invoice_query",
                "navigate",
                "进入发票查询统计(全量发票/取得发票/开具发票)",
                [
                    {"by": "text_exact", "value": "发票查询统计"},
                    {"by": "text_contains", "value": "全量发票查询"},
                    {"by": "text_contains", "value": "发票查询"},
                ],
                expect="出现发票查询表单(开票日期/发票号码/购销方)",
            ),
            _point(
                "fill_period",
                "form",
                "按税款所属期查询(期间格式按平台:YYYY-MM 或 YYYY-MM-DD 起止)",
                [
                    {"by": "label", "value": "开票日期起"},
                    {"by": "label", "value": "开票日期止"},
                    {"by": "label", "value": "所属期"},
                    {"by": "css_candidate", "value": "input[name*='startDate'],input[id*='startDate']"},
                ],
                action="type_text",
                value_template="{period}",
                expect="两个日期控件均已赋值",
            ),
            _point(
                "run_query",
                "query",
                "执行查询",
                [
                    {"by": "role+name", "value": "button:查询"},
                    {"by": "text_exact", "value": "查询"},
                ],
                expect="出现结果表格或空结果提示(空结果也要截图)",
            ),
            _point(
                "export_ledger",
                "receipt",
                "导出销项/进项明细(Excel/PDF)",
                [
                    {"by": "role+name", "value": "button:导出"},
                    {"by": "text_exact", "value": "导出"},
                    {"by": "text_contains", "value": "下载明细"},
                ],
                expect="下载任务出现/文件落盘",
                receipt="download",
            ),
        ],
        "guards": {
            "never_click": ["作废", "红字发票开具", "发票勾选确认提交"],
            "manual_gate": ["发票用途勾选确认"],
            "notes": "只取数与导出;勾选确认会改变进项抵扣状态,必须由人确认后另行执行",
        },
        "receipt": {"kind": "download", "accept": [".xls", ".xlsx", ".csv", ".pdf"]},
        "feeds": "ai_bookkeeping transactions;ai_tax_filing 销项/进项",
    },
    "bank_statement": {
        "label": "企业网银·回单与流水取数",
        "surface": "browser",
        "entry": {"url": "{bank_portal}", "path_hint": "账户管理 > 账户明细/电子回单"},
        "points": [
            *_LOGIN_POINTS,
            _point(
                "open_account_detail",
                "navigate",
                "进入账户明细",
                [
                    {"by": "text_exact", "value": "账户明细"},
                    {"by": "text_contains", "value": "交易明细"},
                    {"by": "text_contains", "value": "明细查询"},
                ],
                expect="出现账户选择与日期区间",
            ),
            _point(
                "fill_period",
                "form",
                "选择账户与期间",
                [
                    {"by": "label", "value": "起始日期"},
                    {"by": "label", "value": "结束日期"},
                    {"by": "label", "value": "账号"},
                ],
                action="type_text",
                value_template="{period}",
            ),
            _point(
                "export_statement",
                "receipt",
                "导出流水/回单",
                [
                    {"by": "role+name", "value": "button:导出"},
                    {"by": "text_contains", "value": "下载"},
                ],
                receipt="download",
            ),
        ],
        "guards": {
            "never_click": ["转账", "付款", "批量代发", "缴费", "签约"],
            "manual_gate": [],
            "notes": "网银只读:任何资金动作页面一律不进入;U 盾/短信由人完成",
        },
        "receipt": {"kind": "download", "accept": [".xls", ".xlsx", ".csv", ".pdf"]},
        "feeds": "ai_bookkeeping 银行流水自动对账",
    },
    "etax_vat_declaration": {
        "label": "电子税务局·增值税及附加税费申报",
        "surface": "browser",
        "entry": {"url": "{etax_portal}", "path_hint": "我要办税 > 税费申报及缴纳 > 增值税及附加税费申报"},
        "points": [
            *_LOGIN_POINTS,
            _point(
                "open_declaration_list",
                "navigate",
                "进入申报清册",
                [
                    {"by": "text_exact", "value": "税费申报及缴纳"},
                    {"by": "text_contains", "value": "申报清册"},
                    {"by": "text_contains", "value": "增值税及附加税费申报"},
                ],
                expect="出现本期应申报列表",
            ),
            _point(
                "open_vat_form",
                "navigate",
                "打开增值税及附加税费申报表",
                [
                    {"by": "text_contains", "value": "增值税及附加税费申报表"},
                    {"by": "text_contains", "value": "增值税申报"},
                ],
                expect="出现主表 + 附列资料页签",
            ),
            _point(
                "compare_prefill",
                "verify",
                "平台预填数与本系统草案逐项比对",
                [{"by": "text_contains", "value": "本期销售额"}, {"by": "text_contains", "value": "本期应纳税额"}],
                action="extract_dom",
                expect="取到平台预填值;差额 >0.01 即停",
                receipt="dom_snapshot",
            ),
            _point(
                "fill_difference",
                "form",
                "仅填差异字段(草案值),不整表覆盖",
                [
                    {"by": "label", "value": "本期销售额"},
                    {"by": "label", "value": "本期应纳税额"},
                    {"by": "css_candidate", "value": "input[name*='sales'],input[name*='tax']"},
                ],
                action="type_text",
                value_template="{values_to_fill}",
            ),
            _point(
                "run_consistency_check",
                "verify",
                "申报前一致性校验",
                [{"by": "text_contains", "value": "一致性校验"}, {"by": "text_contains", "value": "申报前检查"}],
                expect="校验通过或逐条列出差异",
            ),
        ],
        "guards": {
            "never_click": ["缴款", "作废申报", "更正申报提交"],
            "manual_gate": ["提交申报"],
            "notes": "提交前必须复述期间/销售额/应纳税额;差异字段如实上报,不擅改平台预填",
        },
        "submit": {"intent": "提交申报", "requires_human": True},
        "receipt": {"kind": "confirmation_no", "patterns": [r"受理(编号|号)[:：]?\s*(\w{8,})", r"申报成功"]},
        "feeds": "申报表草案 tmp/artifacts/tax-filing-*.html",
    },
    "etax_cit_quarterly": {
        "label": "电子税务局·企业所得税季度预缴申报",
        "surface": "browser",
        "entry": {"url": "{etax_portal}", "path_hint": "税费申报及缴纳 > 企业所得税月(季)度预缴纳税申报"},
        "points": [
            *_LOGIN_POINTS,
            _point(
                "open_cit_form",
                "navigate",
                "打开企业所得税季度预缴表(A 类)",
                [
                    {"by": "text_contains", "value": "企业所得税月(季)度预缴"},
                    {"by": "text_contains", "value": "企业所得税季度"},
                ],
                expect="出现 A 类申报表",
            ),
            _point(
                "fill_cit_facts",
                "form",
                "填从业人数/资产总额/利润总额/弥补亏损",
                [
                    {"by": "label", "value": "从业人数"},
                    {"by": "label", "value": "资产总额"},
                    {"by": "label", "value": "利润总额"},
                ],
                action="type_text",
                value_template="{values_to_fill}",
            ),
            _point(
                "compare_tax_due",
                "verify",
                "平台测算应补(退)所得税额与草案比对",
                [{"by": "text_contains", "value": "应补(退)所得税额"}],
                action="extract_dom",
                receipt="dom_snapshot",
            ),
        ],
        "guards": {
            "never_click": ["缴款", "作废申报"],
            "manual_gate": ["提交申报"],
        },
        "submit": {"intent": "提交申报", "requires_human": True},
        "receipt": {"kind": "confirmation_no", "patterns": [r"受理(编号|号)[:：]?\s*(\w{8,})"]},
    },
    "etax_iit_declaration": {
        "label": "自然人电子税务局·工资薪金个税扣缴申报",
        "surface": "browser_or_client",
        "entry": {"url": "{etax_portal}", "path_hint": "自然人电子税务局(扣缴端) > 综合所得申报 > 正常工资薪金"},
        "points": [
            *_LOGIN_POINTS,
            _point(
                "open_withholding_module",
                "navigate",
                "进入综合所得申报",
                [
                    {"by": "text_exact", "value": "综合所得申报"},
                    {"by": "text_contains", "value": "正常工资薪金所得"},
                ],
                expect="出现人员明细/导入入口",
            ),
            _point(
                "import_or_fill_payroll",
                "form",
                "导入工资表或逐人填列应发/社保/专项附加",
                [
                    {"by": "text_contains", "value": "导入"},
                    {"by": "text_contains", "value": "添加"},
                ],
                action="click",
                optional=True,
                receipt="screenshot",
            ),
            _point(
                "calc_tax",
                "compute",
                "点击税款计算",
                [{"by": "text_exact", "value": "税款计算"}, {"by": "role+name", "value": "button:税款计算"}],
                expect="逐人本期预扣额与草案 withheld 一致",
            ),
            _point(
                "compare_withheld",
                "verify",
                "核对报送结果与收入属期",
                [{"by": "text_contains", "value": "本期应预扣预缴税额"}],
                action="extract_dom",
                receipt="dom_snapshot",
            ),
        ],
        "guards": {
            "never_click": ["删除人员", "作废申报"],
            "manual_gate": ["申报提交", "发送申报"],
            "notes": "自然人电子税务局可能有客户端形态;客户端走 computer_* 桌面面并人在旁",
        },
        "submit": {"intent": "申报提交", "requires_human": True},
        "receipt": {"kind": "confirmation_no", "patterns": [r"申报成功", r"受理(编号|号)[:：]?\s*(\w{8,})"]},
    },
    "social_insurance": {
        "label": "社保(五险)·单位网报增减员与申报缴费",
        "surface": "browser_or_client",
        "entry": {"url": "{social_portal}", "path_hint": "单位网报 > 人员管理 > 人员增减/缴费申报"},
        "points": [
            *_LOGIN_POINTS,
            _point(
                "open_unit_workspace",
                "navigate",
                "进入单位网报工作台并核对单位信息",
                [
                    {"by": "text_contains", "value": "单位信息"},
                    {"by": "text_contains", "value": "参保单位"},
                ],
                action="extract_dom",
                expect="单位名称/统一社会信用代码与客户档一致",
                receipt="dom_snapshot",
            ),
            _point(
                "open_headcount_change",
                "navigate",
                "进入人员增减申报",
                [
                    {"by": "text_exact", "value": "人员增减"},
                    {"by": "text_contains", "value": "增员"},
                    {"by": "text_contains", "value": "减员"},
                ],
                expect="出现增员/减员页签",
            ),
            _point(
                "fill_headcount_rows",
                "form",
                "按增减员台账逐人填列(姓名/证件号/参保基数/账期)",
                [
                    {"by": "label", "value": "姓名"},
                    {"by": "label", "value": "证件号码"},
                    {"by": "label", "value": "缴费基数"},
                ],
                action="type_text",
                value_template="{social_changes}",
            ),
            _point(
                "preview_amount",
                "verify",
                "生成应缴测算并与费率口径比对",
                [{"by": "text_contains", "value": "应缴金额"}, {"by": "text_contains", "value": "缴费明细"}],
                action="extract_dom",
                receipt="dom_snapshot",
            ),
        ],
        "guards": {
            "never_click": ["缴费", "批量扣款", "终止参保", "删除人员"],
            "manual_gate": ["申报提交", "缴费确认"],
            "notes": "增减员以 hr_social_insurance_change 台账为准;平台人数与台账差异必须点名",
        },
        "submit": {"intent": "申报提交/缴费确认", "requires_human": True},
        "receipt": {"kind": "confirmation_no", "patterns": [r"受理(编号|号)[:：]?\s*(\w{8,})", r"申报成功"]},
        "feeds": "hr_social_insurance_change(增减员台账回执回填)",
    },
    "medical_insurance": {
        "label": "医保·单位增减员与申报缴费",
        "surface": "browser_or_client",
        "entry": {"url": "{medical_portal}", "path_hint": "单位网厅 > 参保管理 > 人员增减/缴费申报"},
        "points": [
            *_LOGIN_POINTS,
            _point(
                "open_unit_panel",
                "navigate",
                "进入单位参保管理",
                [
                    {"by": "text_contains", "value": "参保管理"},
                    {"by": "text_contains", "value": "单位申报"},
                ],
            ),
            _point(
                "fill_headcount_rows",
                "form",
                "与社保同口径逐人填列,两侧人数差异点名",
                [
                    {"by": "text_contains", "value": "增员"},
                    {"by": "label", "value": "姓名"},
                ],
                action="type_text",
                value_template="{social_changes}",
            ),
        ],
        "guards": {
            "never_click": ["缴费", "终止参保"],
            "manual_gate": ["申报提交", "缴费确认"],
        },
        "submit": {"intent": "申报提交/缴费确认", "requires_human": True},
        "receipt": {"kind": "confirmation_no", "patterns": [r"受理(编号|号)[:：]?\s*(\w{8,})"]},
    },
    "housing_fund": {
        "label": "住房公积金·单位网厅增减员与汇缴",
        "surface": "browser_or_client",
        "entry": {"url": "{housing_fund_portal}", "path_hint": "单位网厅 > 缴存登记 > 人员变更/汇缴"},
        "points": [
            *_LOGIN_POINTS,
            _point(
                "open_unit_account",
                "navigate",
                "进入单位公积金账户",
                [
                    {"by": "text_contains", "value": "单位账户"},
                    {"by": "text_contains", "value": "缴存登记"},
                ],
            ),
            _point(
                "open_headcount_change",
                "navigate",
                "进入人员变更(开户/启封/封存/转移)",
                [
                    {"by": "text_exact", "value": "人员变更"},
                    {"by": "text_contains", "value": "启封"},
                    {"by": "text_contains", "value": "封存"},
                ],
                expect="出现人员变更类型选择",
            ),
            _point(
                "fill_fund_rows",
                "form",
                "按增减员台账逐人填列基数与比例",
                [
                    {"by": "label", "value": "缴存基数"},
                    {"by": "label", "value": "缴存比例"},
                ],
                action="type_text",
                value_template="{social_changes}",
            ),
            _point(
                "preview_fund_amount",
                "verify",
                "生成汇缴测算并与公积金配置比对",
                [{"by": "text_contains", "value": "汇缴金额"}, {"by": "text_contains", "value": "应缴"}],
                action="extract_dom",
                receipt="dom_snapshot",
            ),
        ],
        "guards": {
            "never_click": ["汇缴支付", "注销账户"],
            "manual_gate": ["申报提交", "汇缴确认"],
            "notes": "此前公积金没有平台目标:tax-filing 专家包把公积金当触发词却无处可去;本目标补齐",
        },
        "submit": {"intent": "申报提交/汇缴确认", "requires_human": True},
        "receipt": {"kind": "confirmation_no", "patterns": [r"受理(编号|号)[:：]?\s*(\w{8,})"]},
    },
}


def list_targets() -> list[dict[str, Any]]:
    """列出全部点位包(给工具/前端做选择项)。"""
    return [
        {
            "id": tid,
            "label": pb["label"],
            "surface": pb["surface"],
            "pointCount": len(pb["points"]),
            "hasSubmitGate": bool(pb.get("submit")),
        }
        for tid, pb in PLAYBOOKS.items()
    ]


def build_point_pack(
    target_id: str,
    facts: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """返回可直接嵌入自动化计划的点位包;模板位按 facts 替换,缺位保留占位并点名。"""
    if target_id not in PLAYBOOKS:
        raise ValueError(f"未注册点位包 {target_id!r};可选 {sorted(PLAYBOOKS)}")
    facts = facts or {}
    missing: list[str] = []
    pack = PLAYBOOKS[target_id]

    def fill(value: Any) -> Any:
        if not isinstance(value, str) or "{" not in value:
            return value
        text = value
        for key, raw in facts.items():
            text = text.replace("{" + key + "}", str(raw))
        # 未替换的模板位保留并点名(不猜地址/金额)
        import re

        for token in re.findall(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}", text):
            name = token.strip("{}")
            if name not in missing:
                missing.append(name)
        return text

    def walk(node: Any) -> Any:
        if isinstance(node, dict):
            return {k: walk(v) for k, v in node.items()}
        if isinstance(node, list):
            return [walk(v) for v in node]
        return fill(node)

    resolved = walk(pack)
    resolved["id"] = target_id
    resolved["version"] = POINT_PACK_VERSION
    resolved["contract"] = COMMON_CONTRACT
    if missing:
        resolved["missing_facts"] = missing
        resolved["missing_policy"] = "缺事实(入口地址/期间/填列值)的动作点不执行;先向用户或上游产物要,绝不猜"
    return resolved
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
