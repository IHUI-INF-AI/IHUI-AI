# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""财务动作工具:持久化账套 + 税务申报(2026-11-23 立)。

与既有财务工具的分工(不要混用):
  · ai_bookkeeping / ai_tax_filing —— "算":把流水/工资算成凭证与报表文本,不落库;
  · **finance_ledger_ops / finance_tax_ops(本文件)** —— "存":把算好的东西写进正式账套
    (客户/账套/科目/期初/凭证/复核/结账/发票/银行对账/税种核定/申报日历),
    跨期连续性由"上期期末 = 下期期初"保证。

权限:每个端点由 apps/api 的 RBAC 逐请求现问(finance:ledger:view / finance:ledger:manage),
本工具不做二次鉴权,也不缓存结果。
"""

from __future__ import annotations

from typing import Any

from .api_ops_common import dispatch

# --- 账套主干(客户/科目/期初/凭证/报表/结账/复核) ---
FINANCE_LEDGER_ROUTES: dict[str, tuple[str, str]] = {
    "client.create": ("POST", "/api/fin-accounting/clients"),
    "client.list": ("GET", "/api/fin-accounting/clients"),
    "client.get": ("GET", "/api/fin-accounting/clients/:id"),
    "client.update": ("PATCH", "/api/fin-accounting/clients/:id"),
    "client.archive": ("POST", "/api/fin-accounting/clients/:id/archive"),
    "ledger.create": ("POST", "/api/fin-accounting/ledgers"),
    "ledger.list": ("GET", "/api/fin-accounting/ledgers"),
    "ledger.get": ("GET", "/api/fin-accounting/ledgers/:id"),
    "ledger.update": ("PATCH", "/api/fin-accounting/ledgers/:id"),
    "account.list": ("GET", "/api/fin-accounting/ledgers/:id/accounts"),
    "account.create": ("POST", "/api/fin-accounting/ledgers/:id/accounts"),
    "account.update": ("PATCH", "/api/fin-accounting/ledgers/:id/accounts/:code"),
    "opening.get": ("GET", "/api/fin-accounting/ledgers/:id/opening"),
    "opening.set": ("PUT", "/api/fin-accounting/ledgers/:id/opening"),
    "opening.summary": ("GET", "/api/fin-accounting/ledgers/:id/opening/summary"),
    "voucher.create": ("POST", "/api/fin-accounting/ledgers/:id/vouchers"),
    "voucher.list": ("GET", "/api/fin-accounting/ledgers/:id/vouchers"),
    "voucher.import": ("POST", "/api/fin-accounting/ledgers/:id/vouchers/import"),
    "voucher.get": ("GET", "/api/fin-accounting/vouchers/:id"),
    "voucher.update": ("PATCH", "/api/fin-accounting/vouchers/:id"),
    "voucher.delete": ("DELETE", "/api/fin-accounting/vouchers/:id"),
    "voucher.post": ("POST", "/api/fin-accounting/vouchers/:id/post"),
    "voucher.postBatch": ("POST", "/api/fin-accounting/ledgers/:id/vouchers/post-batch"),
    "voucher.reverse": ("POST", "/api/fin-accounting/vouchers/:id/reverse"),
    "report.trialBalance": ("GET", "/api/fin-accounting/ledgers/:id/trial-balance"),
    "report.balanceSheet": ("GET", "/api/fin-accounting/ledgers/:id/balance-sheet"),
    "report.incomeStatement": ("GET", "/api/fin-accounting/ledgers/:id/income-statement"),
    "period.close": ("POST", "/api/fin-accounting/ledgers/:id/close"),
    "period.reopen": ("POST", "/api/fin-accounting/ledgers/:id/reopen"),
    "period.list": ("GET", "/api/fin-accounting/ledgers/:id/periods"),
    "review.submit": ("POST", "/api/fin-accounting/vouchers/:id/submit-review"),
    "review.approve": ("POST", "/api/fin-accounting/vouchers/:id/approve-review"),
    "review.reject": ("POST", "/api/fin-accounting/vouchers/:id/reject-review"),
    "review.queue": ("GET", "/api/fin-accounting/ledgers/:id/review-queue"),
    "review.summary": ("GET", "/api/fin-accounting/ledgers/:id/review-summary"),
}

# --- 发票 / 银行对账 / 税种核定 / 申报日历 ---
FINANCE_TAX_ROUTES: dict[str, tuple[str, str]] = {
    "invoice.create": ("POST", "/api/fin-accounting/ledgers/:id/invoices"),
    "invoice.list": ("GET", "/api/fin-accounting/ledgers/:id/invoices"),
    "invoice.import": ("POST", "/api/fin-accounting/ledgers/:id/invoices/import"),
    "invoice.summary": ("GET", "/api/fin-accounting/ledgers/:id/invoices/summary"),
    "invoice.status": ("PATCH", "/api/fin-accounting/invoices/:id/status"),
    "invoice.linkVoucher": ("POST", "/api/fin-accounting/invoices/:id/link-voucher"),
    "invoice.delete": ("DELETE", "/api/fin-accounting/invoices/:id"),
    "bank.account.create": ("POST", "/api/fin-accounting/ledgers/:id/bank-accounts"),
    "bank.account.list": ("GET", "/api/fin-accounting/ledgers/:id/bank-accounts"),
    "bank.statement.list": ("GET", "/api/fin-accounting/ledgers/:id/statements"),
    "bank.autoMatch": ("POST", "/api/fin-accounting/ledgers/:id/statements/auto-match"),
    "bank.statement.match": ("POST", "/api/fin-accounting/statements/:id/match"),
    "bank.statement.unmatch": ("POST", "/api/fin-accounting/statements/:id/unmatch"),
    "bank.statement.ignore": ("POST", "/api/fin-accounting/statements/:id/ignore"),
    "bank.attach": ("POST", "/api/fin-accounting/statements/attach"),
    "bank.reconcile": ("GET", "/api/fin-accounting/ledgers/:id/reconcile"),
    "tax.profile.upsert": ("POST", "/api/fin-accounting/clients/:id/tax-profiles"),
    "tax.profile.list": ("GET", "/api/fin-accounting/clients/:id/tax-profiles"),
    "tax.profile.update": ("PATCH", "/api/fin-accounting/tax-profiles/:id"),
    "tax.profile.deactivate": ("POST", "/api/fin-accounting/tax-profiles/:id/deactivate"),
    "filing.calendar.ensure": ("POST", "/api/fin-accounting/clients/:id/filing-calendar"),
    "filing.calendar.backfill": ("POST", "/api/fin-accounting/filing-calendar/backfill"),
    "client.bindLedger": ("POST", "/api/fin-accounting/clients/:id/bind-ledger"),
    "filing.task.list": ("GET", "/api/fin-accounting/filing-tasks"),
    "filing.task.update": ("PATCH", "/api/fin-accounting/filing-tasks/:id"),
    "filing.deadlines": ("GET", "/api/fin-accounting/filing/deadlines"),
    "filing.summary": ("GET", "/api/fin-accounting/filing/summary"),
}

FINANCE_LEDGER_DESCRIPTION = (
    "正式账套的动作入口(持久化,区别于只算不存的 ai_bookkeeping)。"
    "调 apps/api /api/fin-accounting,权限由后端 RBAC 现问。"
    "action 取值:" + ", ".join(sorted(FINANCE_LEDGER_ROUTES)) + "。"
    "payload 放该动作的参数;路径参数(client/ledger/voucher 的 id、科目 code)也放在 payload 同名键里,"
    "其余键自动成为 query(GET) 或 JSON body。"
    "典型串法:客户上线 = client.create → ledger.create → account.list(自动带 63 科目模板)"
    "→ opening.set(期初)→ voucher.create/import → voucher.post → period.close;"
    "需要复核的账套先 review.submit 再 review.approve(复核人须≠制单人)。"
    "金额一律用「元」字符串(如 \"1234.56\"),不要传浮点数。"
)

FINANCE_TAX_DESCRIPTION = (
    "发票、银行对账与税务申报动作入口(持久化)。"
    "调 apps/api /api/fin-accounting,权限由后端 RBAC 现问。"
    "action 取值:" + ", ".join(sorted(FINANCE_TAX_ROUTES)) + "。"
    "payload 放该动作参数;路径参数(ledger/client/invoice/statement/taxProfile 的 id)放同名键。"
    "典型串法:① 发票 = invoice.import → invoice.summary(销项/进项/待认证)→ invoice.status(认证/作废);"
    "② 银行 = bank.account.create → bank.statement.list → bank.autoMatch → 未匹配逐条 "
    "bank.statement.match / ignore → bank.reconcile;"
    "③ 申报 = tax.profile.upsert(税种核定,同税种新建自动停用旧档)→ filing.calendar.ensure"
    "(按月/季/年生成申报任务)→ filing.task.list(到期日)→ filing.task.update(状态推进:"
    "pending→computed→drafted→submitted→accepted)。"
)


async def finance_ledger_ops(arguments: Any) -> dict[str, Any]:  # noqa: ARG001
    """账套主干动作(客户/科目/期初/凭证/报表/结账/复核)。"""
    return await dispatch("finance_ledger_ops", arguments, FINANCE_LEDGER_ROUTES)


async def finance_tax_ops(arguments: Any) -> dict[str, Any]:  # noqa: ARG001
    """发票/银行对账/税种核定/申报日历动作。"""
    return await dispatch("finance_tax_ops", arguments, FINANCE_TAX_ROUTES)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
