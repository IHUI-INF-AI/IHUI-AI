<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

---

name: finance-tax-automation
description: "执行电子税务局/社保/医保/公积金/企业网银的浏览器自动化: 取发票底账与银行流水、增值税/企业所得税/个税申报预填、社保公积金增减员与汇缴。用结构化点位包(入口/候选定位器/探测顺序/期望态/回执/红线)驱动 browser_* 工具,人工闸前停手,回执可追溯。Use when the user asks to 报税、申报、取数、对账、社保增减员、公积金汇缴, or to run AI 代账/报税 automation on external platforms."
license: Apache-2.0
metadata:
version: "1.0"
author: IHUI-AI
---

# Finance / Tax Platform Automation

对外平台的每一步都由**点位包**驱动，不靠模型临场猜选择器。点位包唯一真相源：
`apps/ai-service/app/tools/browser_playbooks.py` 的 `PLAYBOOKS`。计划入口：
`ai_tax_filing` 的 `phase=automation`（或 `ai_bookkeeping` 取数腿），返回的每个 target 都带 `point_pack`。

## 何时用

- 用户说“报税/申报/一键报税/增值税/所得税/个税/社保/医保/公积金/增减员/发票底账/银行回单”。
- 需要把平台数据取回本系统（发票台账、银行流水、申报回执）。
- 需要把本系统台账推到平台（社保/公积金增减员），但**最终提交必须人点**。

不适用：纯计算（走 `ai_tax_filing` 的 compute/validate/draft）、纯文档（走文档工具）。

## 三条硬红线

1. **不代提交**：`submit_gate` 出现即停。`manual_gate` 由人点击；`user_confirmed` 也必须先复述“目标/期间/金额”，得到明示确认后才点，并留回执截图。
2. **不绕验证**：出现验证码/人脸/U 盾/短信/CA，立即 `request_human_login`；禁止代填账号密码、禁止换路径绕过。
3. **不猜事实**：缺 `{etax_portal}`/`{period}`/填列值时，`point_pack.missing_facts` 会点名；先向用户或上游草案要，缺一不动作。差额 > 0.01 元即停并上报差异字段。

## 执行循环（每个 point 一次）

1. `browser_screenshot` 或 `browser_extract_dom` 观察当前页面；有 iframe 先切 frame。
2. 按 `point.probe_order` 依次试 `locators`：`role+name` → `text_exact` → `text_contains` → `css_candidate` → `xpath_contains`。
3. 命中后执行 `point.action`（click / type_text / extract_dom）；`type_text` 用 `value_template` 已解析值。
4. 核对 `point.expect`；不满足即停，不带着错误态继续。
5. 收 `point.receipt`：`screenshot` / `dom_snapshot` / `download` / `confirmation_no`。
6. 连续 2 次不中 ⇒ `SELECTOR_NOT_FOUND`，停该目标，附当前截图与已试定位器。

## 目标矩阵

| target                 | 平台                    | 关键点位                                                                 | 回执              |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------ | ----------------- |
| `etax_invoice_ledger`  | 电子税务局·税务数字账户 | 登录态 → 数字账户 → 发票查询统计 → 期间 → 查询 → 导出                    | 下载文件          |
| `bank_statement`       | 企业网银                | 登录态 → 账户明细 → 期间 → 导出                                          | 下载文件          |
| `etax_vat_declaration` | 电子税务局              | 申报清册 → 增值税表 → 预填比对 → 差异填列 → 一致性校验 → **人工提交**    | 受理号/截图       |
| `etax_cit_quarterly`   | 电子税务局              | 企业所得税季度 A 类 → 填从业人数/资产/利润 → 应补退比对 → **人工提交**   | 受理号/截图       |
| `etax_iit_declaration` | 自然人电子税务局        | 综合所得 → 工资薪金 → 税款计算 → 逐人比对 → **人工提交**                 | 申报成功/受理号   |
| `social_insurance`     | 省社保单位网报          | 单位信息 → 人员增减 → 逐人基数 → 应缴比对 → **人工提交**                 | 受理号 → 回填台账 |
| `medical_insurance`    | 省医保单位网厅          | 参保管理 → 增减 → 与社保人数差异点名 → **人工提交**                      | 受理号            |
| `housing_fund`         | 公积金单位网厅          | 单位账户 → 人员变更(开户/启封/封存) → 基数比例 → 汇缴测算 → **人工提交** | 受理号            |

## 与其他模块的接线

- 发票底账导出 → `parse_document`/`document_tables` → `finance_ledger_ops` 记账或 `finance_tax_ops` 申报取数。
- 银行流水导出 → 银行流水对账（`finance_ledger_ops`）。
- 社保/公积金增减员：先读 `hr_gap_ops social.list`（台账 `hr_social_insurance_change`），平台报完用 `social.submit` 回填 `platformRef`，受理后用 `social.accepted`；退回用 `social.failed` 写原因。
- 申报回执：把受理号/截图路径写回任务备注；没有回执一律 `receipt_missing`，不得宣称“已申报成功”。
- 账→表取数已打通确定性链路：`finance_tax_ops` 的 `filing.task.derive` / `filing.deriveBulk`（VAT/附加/印花/企所从账票推导；IIT 从**已批准工资批次**回流，未批工资直接 fail-closed）。月折旧走 `finance_ledger_ops` 的 `asset.depreciationPreview`→`asset.depreciate`（批次幂等），到期提醒由每日 job 自动发站内信，可用 `filing.remindNow` 手动补跑。

## 失败与续跑

| 现象                   | 处理                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| `TARGET_NOT_CONNECTED` | 请用户打开 AI 面板所在页面/扩展，按 `target.step_index` 从断点续跑 |
| `SELECTOR_NOT_FOUND`   | 停该目标；重探一次仍不中即回报，不改猜坐标                         |
| `RECEIPT_MISSING`      | 目标不算完成；补截图/下载/受理号后再报完成                         |
| 平台预填与草案差额     | 停，逐字段列差额；不擅改平台数，也不改草案迁就平台                 |
| 登录态失效             | `request_human_login`，保留已完成点位与回执，登录后续跑            |

## 维护点位包

新增省份/平台差异时只改 `browser_playbooks.py`：

1. 在 `PLAYBOOKS` 加 target（`entry`/`points`/`guards`/`submit`/`receipt`）。
2. 定位器一律写**候选**并给 `by`；不写“唯一正确”假设。
3. `never_click` 覆盖资金/不可逆动作；`manual_gate` 覆盖最终提交。
4. 同步 `finance_tools.PLATFORM_TARGETS` 的叙述步骤与默认目标集；跑 `py_compile` 与点位包解析自检。

## 自检

```bash
python -m py_compile apps/ai-service/app/tools/browser_playbooks.py apps/ai-service/app/tools/finance_tools.py
python -c "from app.tools.browser_playbooks import list_targets,build_point_pack;print(len(list_targets()));print(build_point_pack('etax_vat_declaration',{'period':'2026-10','etax_portal':'https://etax.example.gov.cn'})['points'][0]['key'])"
```

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
