// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 财务代账路由(前缀 /api/fin-accounting)。
 *
 * 权限两档:
 *   · finance:ledger:view   —— 读客户/账套/余额/报表/凭证
 *   · finance:ledger:manage —— 建客户/账套、改科目、写期初、制单、过账、结账
 * 系统管理员(roleId>=1)按 requirePermission 的既定语义直接放行。
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { requirePermission } from '../plugins/require-permission.js'
import { AppError } from '../errors/AppError.js'
import { success } from '../utils/response.js'
import {
  archiveClient,
  createAccount,
  createClient,
  createLedger,
  getClient,
  getLedger,
  getOpeningBalances,
  listAccounts,
  listClients,
  listLedgers,
  setOpeningBalances,
  summarizeOpening,
  updateAccount,
  updateClient,
  updateLedger,
} from '../services/fin-accounting/ledger-service.js'
import {
  createVoucher,
  deleteVoucher,
  getVoucher,
  importVouchers,
  listVouchers,
  postVoucher,
  postVouchers,
  reverseVoucher,
  updateVoucher,
} from '../services/fin-accounting/voucher-service.js'
import {
  buildBalanceSheet,
  buildIncomeStatement,
  closePeriod,
  computeTrialBalance,
  getPeriodStatus,
  materializeBalances,
  reopenPeriod,
} from '../services/fin-accounting/balance-service.js'
import {
  createInvoice,
  deleteInvoice,
  importInvoices,
  linkInvoiceToVoucher,
  listInvoices,
  setInvoiceStatus,
  summarizeInvoices,
} from '../services/fin-accounting/invoice-service.js'
import {
  attachStatementsToVoucher,
  autoMatch,
  createBankAccount,
  ignoreStatement,
  importStatements,
  listBankAccounts,
  listStatements,
  manualMatch,
  reconcileSummary,
  unmatchStatement,
} from '../services/fin-accounting/bank-service.js'
// 税务服务只在 fin-tax-routes.ts 用;本文件不 import(拆出后未用会 TS6133)
import {
  approveReview,
  rejectReview,
  reviewQueue,
  reviewSummary,
  submitReview,
} from '../services/fin-accounting/review-service.js'
import {
  getCashFlowStatement,
  getDetailLedger,
  getGeneralLedger,
  getJournal,
  getAuxiliaryBalances,
} from '../services/fin-accounting/ledger-report-service.js'
import { closeYear, getYearEnd, listYearEnds } from '../services/fin-accounting/year-end-service.js'
import {
  addVoucherAttachment,
  listVoucherAttachments,
  removeVoucherAttachment,
} from '../services/fin-accounting/voucher-attachment-service.js'
import { verifyInvoice } from '../services/fin-accounting/invoice-verify-service.js'
import {
  assetSummary,
  createAsset,
  disposeAsset,
  getAsset,
  listAssets,
  postPeriodDepreciation,
  previewPeriodDepreciation,
  updateAsset,
} from '../services/fin-accounting/fixed-asset-service.js'

// 共享 schema/helper 在 fin-accounting-shared.ts(拆自本文件的 99~236 行)
import {
  MANAGE,
  PERIOD,
  VIEW,
  accountBody,
  badRequest,
  clientBody,
  guard,
  importBody,
  invoiceBody,
  ledgerBody,
  lineBody,
  money,
  openingBody,
  statementBody,
  userIdOf,
  voucherBody,
} from './fin-accounting-shared.js'
// 税务域在 fin-tax-routes.ts(单文件行数门)
import { finTaxRoutes } from './fin-tax-routes.js'

export const finAccountingRoutes: FastifyPluginAsync = async (server) => {
  // ============================ 客户 ============================
  server.post('/clients', { preHandler: requirePermission(MANAGE) }, async (request, reply) => {
    const parsed = clientBody.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
    await guard(reply, () => createClient(parsed.data, userIdOf(request)))
  })

  server.get('/clients', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const q = request.query as { page?: string; limit?: string; keyword?: string; status?: string }
    await guard(reply, () =>
      listClients({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        keyword: q.keyword,
        status: q.status,
      }),
    )
  })

  server.get('/clients/:id', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await guard(reply, () => getClient(id))
  })

  server.patch(
    '/clients/:id',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = clientBody.partial().safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => updateClient(id, parsed.data))
    },
  )

  server.post(
    '/clients/:id/archive',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => archiveClient(id))
    },
  )

  // ============================ 账套 ============================
  server.post('/ledgers', { preHandler: requirePermission(MANAGE) }, async (request, reply) => {
    const parsed = ledgerBody.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
    await guard(reply, () => createLedger(parsed.data, userIdOf(request)))
  })

  server.get('/ledgers', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const q = request.query as { clientId?: string }
    await guard(reply, () => listLedgers(q.clientId))
  })

  server.get('/ledgers/:id', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await guard(reply, () => getLedger(id))
  })

  server.patch(
    '/ledgers/:id',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          name: z.string().min(1).max(100).optional(),
          accountingStandard: z.enum(['small_business', 'general']).optional(),
          status: z.enum(['active', 'paused', 'closed']).optional(),
          reviewRequired: z.boolean().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => updateLedger(id, parsed.data))
    },
  )

  // ============================ 科目 ============================
  server.get(
    '/ledgers/:id/accounts',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { category?: string; enabled?: string }
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        listAccounts(id, {
          category: q.category,
          enabled: q.enabled === undefined ? undefined : q.enabled === 'true',
        }),
      )
    },
  )

  server.post(
    '/ledgers/:id/accounts',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = accountBody.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => createAccount(id, parsed.data))
    },
  )

  server.patch(
    '/ledgers/:id/accounts/:code',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          name: z.string().min(1).max(100).optional(),
          aux: z.record(z.string(), z.boolean()).optional(),
          enabled: z.boolean().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id, code } = request.params as { id: string; code: string }
      await guard(reply, () => updateAccount(id, code, parsed.data))
    },
  )

  // ============================ 期初余额 ============================
  server.get(
    '/ledgers/:id/opening',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, () => getOpeningBalances(id, q.period))
    },
  )

  server.put(
    '/ledgers/:id/opening',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = openingBody.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => setOpeningBalances(id, parsed.data.period, parsed.data.rows))
    },
  )

  server.get(
    '/ledgers/:id/opening/summary',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, () => summarizeOpening(id, q.period))
    },
  )

  // ============================ 凭证 ============================
  server.post(
    '/ledgers/:id/vouchers',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = voucherBody.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => createVoucher(id, parsed.data, userIdOf(request)))
    },
  )

  server.get(
    '/ledgers/:id/vouchers',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string; status?: string; page?: string; limit?: string }
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        listVouchers(id, {
          period: q.period,
          status: q.status,
          page: q.page ? Number(q.page) : undefined,
          limit: q.limit ? Number(q.limit) : undefined,
        }),
      )
    },
  )

  server.post(
    '/ledgers/:id/vouchers/import',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = importBody.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => importVouchers(id, parsed.data.vouchers, userIdOf(request)))
    },
  )

  server.post(
    '/ledgers/:id/vouchers/post-batch',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ ids: z.array(z.string().uuid()).min(1).max(500) })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () => postVouchers(parsed.data.ids, userIdOf(request)))
    },
  )

  server.get('/vouchers/:id', { preHandler: requirePermission(VIEW) }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await guard(reply, () => getVoucher(id))
  })

  // 凭证附件:文件本体走 /api/files/upload/form,这里只挂引用与指纹
  server.get(
    '/vouchers/:id/attachments',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => listVoucherAttachments(id))
    },
  )

  server.post(
    '/vouchers/:id/attachments',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          fileId: z.string().min(1).max(64),
          name: z.string().min(1).max(255),
          url: z.string().min(1).max(1000),
          mimeType: z.string().max(128).optional(),
          size: z.number().int().min(0).optional(),
          sha256: z
            .string()
            .regex(/^[a-f0-9]{64}$/i)
            .optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => addVoucherAttachment(id, parsed.data, userIdOf(request)))
    },
  )

  server.delete(
    '/vouchers/:id/attachments/:attachmentId',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id, attachmentId } = request.params as { id: string; attachmentId: string }
      await guard(reply, () => removeVoucherAttachment(id, attachmentId))
    },
  )

  server.patch(
    '/vouchers/:id',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          summary: z.string().max(500).optional(),
          voucherDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          lines: z.array(lineBody).min(2).optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => updateVoucher(id, parsed.data))
    },
  )

  server.delete(
    '/vouchers/:id',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => deleteVoucher(id))
    },
  )

  server.post(
    '/vouchers/:id/post',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => postVoucher(id, userIdOf(request)))
    },
  )

  server.post(
    '/vouchers/:id/reverse',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ period: PERIOD.optional() }).safeParse(request.body ?? {})
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => reverseVoucher(id, userIdOf(request), parsed.data.period))
    },
  )

  // ============================ 余额与报表 ============================
  server.get(
    '/ledgers/:id/trial-balance',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, async () => {
        const ledger = await getLedger(id)
        return computeTrialBalance(id, q.period ?? ledger.currentPeriod)
      })
    },
  )

  server.post(
    '/ledgers/:id/trial-balance/refresh',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ period: PERIOD }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => materializeBalances(id, parsed.data.period))
    },
  )

  server.get(
    '/ledgers/:id/balance-sheet',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, async () =>
        buildBalanceSheet(id, q.period ?? (await getLedger(id)).currentPeriod),
      )
    },
  )

  server.get(
    '/ledgers/:id/income-statement',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, async () =>
        buildIncomeStatement(id, q.period ?? (await getLedger(id)).currentPeriod),
      )
    },
  )

  // ============================ 账簿报表 ============================
  server.get(
    '/ledgers/:id/detail-ledger',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { accountCode?: string; periodFrom?: string; periodTo?: string }
      const { id } = request.params as { id: string }
      if (!q.accountCode || !q.periodFrom || !q.periodTo) {
        return badRequest(reply, 'accountCode / periodFrom / periodTo 必填')
      }
      await guard(reply, () => getDetailLedger(id, q.accountCode!, q.periodFrom!, q.periodTo!))
    },
  )

  server.get(
    '/ledgers/:id/general-ledger',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, async () =>
        getGeneralLedger(id, q.period ?? (await getLedger(id)).currentPeriod),
      )
    },
  )

  server.get(
    '/ledgers/:id/journal',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { periodFrom?: string; periodTo?: string; limit?: string }
      const { id } = request.params as { id: string }
      if (!q.periodFrom || !q.periodTo) return badRequest(reply, 'periodFrom / periodTo 必填')
      await guard(reply, () =>
        getJournal(id, q.periodFrom!, q.periodTo!, q.limit ? Number(q.limit) : undefined),
      )
    },
  )

  server.get(
    '/ledgers/:id/cash-flow',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, async () =>
        getCashFlowStatement(id, q.period ?? (await getLedger(id)).currentPeriod),
      )
    },
  )

  // ============================ 辅助核算台账 ============================
  server.get(
    '/ledgers/:id/aux-report',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { dim?: string; periodFrom?: string; periodTo?: string }
      const { id } = request.params as { id: string }
      if (!q.dim || !q.periodFrom || !q.periodTo) {
        return badRequest(reply, 'dim / periodFrom / periodTo 必填')
      }
      await guard(reply, () => getAuxiliaryBalances(id, q.dim!, q.periodFrom!, q.periodTo!))
    },
  )

  // ============================ 固定资产台账与折旧 ============================
  server.get(
    '/ledgers/:id/assets',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { status?: string }
      const { id } = request.params as { id: string }
      const st = q.status === 'active' || q.status === 'disposed' ? q.status : undefined
      await guard(reply, async () => {
        const assets = await listAssets(id, st)
        return { assets, count: assets.length }
      })
    },
  )

  server.get(
    '/ledgers/:id/assets/summary',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, async () => {
        const ledger = await getLedger(id)
        return assetSummary(id, ledger.currentPeriod)
      })
    },
  )

  server.post(
    '/ledgers/:id/assets',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          code: z.string().min(1).max(40),
          name: z.string().min(1).max(200),
          category: z.string().max(40).optional(),
          originalCost: money,
          startPeriod: PERIOD,
          usefulMonths: z.number().int().min(1).max(600),
          salvageRate: z.number().min(0).max(0.2).optional(),
          expenseAccountCode: z.string().regex(/^\d{4,8}$/).optional(),
          note: z.string().max(500).nullable().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, async () => {
        await getLedger(id)
        return createAsset(
          id,
          {
            ...parsed.data,
            originalCost: String(parsed.data.originalCost),
            salvageRate: parsed.data.salvageRate?.toFixed(4),
          },
          userIdOf(request),
        )
      })
    },
  )

  server.get(
    '/assets/:assetId',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const { assetId } = request.params as { assetId: string }
      await guard(reply, () => getAsset(assetId))
    },
  )

  server.patch(
    '/assets/:assetId',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          name: z.string().min(1).max(200).optional(),
          category: z.string().max(40).optional(),
          originalCost: money.optional(),
          startPeriod: PERIOD.optional(),
          usefulMonths: z.number().int().min(1).max(600).optional(),
          expenseAccountCode: z.string().regex(/^\d{4,8}$/).optional(),
          note: z.string().max(500).nullable().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { assetId } = request.params as { assetId: string }
      const { originalCost, ...rest } = parsed.data
      await guard(reply, () =>
        updateAsset(assetId, originalCost === undefined ? rest : { ...rest, originalCost: String(originalCost) }),
      )
    },
  )

  server.post(
    '/assets/:assetId/dispose',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ disposalPeriod: PERIOD }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { assetId } = request.params as { assetId: string }
      await guard(reply, () => disposeAsset(assetId, parsed.data.disposalPeriod))
    },
  )

  server.get(
    '/ledgers/:id/assets/depreciation-preview',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, async () =>
        previewPeriodDepreciation(id, q.period ?? (await getLedger(id)).currentPeriod),
      )
    },
  )

  server.post(
    '/ledgers/:id/assets/depreciate',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ period: PERIOD }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => postPeriodDepreciation(id, parsed.data.period, userIdOf(request)))
    },
  )

  // ============================ 结账(批量编排入口) ============================
  // 多客户逐条独立成败,一条失败不回滚其余;每条给出真值(成功 id / 错误码)。
  server.post(
    '/bulk/close-period',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          ledgerIds: z.array(z.string().uuid()).min(1).max(100),
          period: PERIOD,
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { ledgerIds, period } = parsed.data
      const results = await Promise.all(
        ledgerIds.map(async (ledgerId) => {
          try {
            const closed = await closePeriod(ledgerId, period, userIdOf(request))
            let yearEnd = null
            if (period.endsWith('-12')) {
              yearEnd = await closeYear(ledgerId, Number(period.slice(0, 4)), userIdOf(request))
            }
            return { ledgerId, ok: true, closed, yearEnd }
          } catch (e) {
            return {
              ledgerId,
              ok: false,
              code: e instanceof AppError ? e.errorCode : 'UNKNOWN',
              message: e instanceof Error ? e.message : String(e),
            }
          }
        }),
      )
      const succeeded = results.filter((r) => r.ok).map((r) => r.ledgerId)
      const missedIds = results.filter((r) => !r.ok).map((r) => r.ledgerId)
      return reply.send(
        success({ period, total: results.length, succeeded, missedIds, results }),
      )
    },
  )

  server.post(
    '/ledgers/:id/close',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ period: PERIOD }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      const period = parsed.data.period
      await guard(reply, async () => {
        const closed = await closePeriod(id, period, userIdOf(request))
        // 12 月结账成功后自动年结:3103 本年利润→3104 利润分配,并冻结年初快照。
        if (period.endsWith('-12')) {
          const year = Number(period.slice(0, 4))
          const yearEnd = await closeYear(id, year, userIdOf(request))
          return { ...closed, yearEnd }
        }
        return closed
      })
    },
  )

  server.post(
    '/ledgers/:id/reopen',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ period: PERIOD }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => reopenPeriod(id, parsed.data.period, userIdOf(request)))
    },
  )

  server.get(
    '/ledgers/:id/periods',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => getPeriodStatus(id))
    },
  )

  // ============================ 年结 ============================
  server.post(
    '/ledgers/:id/year-end',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ year: z.number().int().min(2000).max(2100) })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => closeYear(id, parsed.data.year, userIdOf(request)))
    },
  )

  server.get(
    '/ledgers/:id/year-ends',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => listYearEnds(id))
    },
  )

  server.get(
    '/ledgers/:id/year-end/:year',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const { id, year } = request.params as { id: string; year: string }
      await guard(reply, () => getYearEnd(id, Number(year)))
    },
  )

  // ============================ 发票台账 ============================
  server.post(
    '/ledgers/:id/invoices',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = invoiceBody.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => createInvoice(id, parsed.data, userIdOf(request)))
    },
  )

  server.get(
    '/ledgers/:id/invoices',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as {
        period?: string
        direction?: string
        status?: string
        page?: string
        limit?: string
      }
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        listInvoices(id, {
          period: q.period,
          direction: q.direction,
          status: q.status,
          page: q.page ? Number(q.page) : undefined,
          limit: q.limit ? Number(q.limit) : undefined,
        }),
      )
    },
  )

  server.post(
    '/ledgers/:id/invoices/import',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ invoices: z.array(invoiceBody).min(1).max(1000) })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => importInvoices(id, parsed.data.invoices, userIdOf(request)))
    },
  )

  server.get(
    '/ledgers/:id/invoices/summary',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, async () => {
        const ledger = await getLedger(id)
        return summarizeInvoices(id, q.period ?? ledger.currentPeriod)
      })
    },
  )

  server.patch(
    '/invoices/:id/status',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          status: z.enum(['unchecked', 'checked', 'certified', 'voided']),
          checkPeriod: PERIOD.optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => setInvoiceStatus(id, parsed.data.status, parsed.data.checkPeriod))
    },
  )

  server.post(
    '/invoices/:id/link-voucher',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ voucherId: z.string().uuid() }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => linkInvoiceToVoucher(id, parsed.data.voucherId))
    },
  )

  server.delete(
    '/invoices/:id',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => deleteInvoice(id))
    },
  )

  // 发票验真:本地勾稽必做;外部查验源未接时落 unavailable,不冒充 verified
  server.post(
    '/invoices/:id/verify',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ providerId: z.string().max(50).optional() })
        .safeParse(request.body ?? {})
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => verifyInvoice(id, parsed.data.providerId))
    },
  )

  // ============================ 银行流水与对账 ============================
  server.post(
    '/ledgers/:id/bank-accounts',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          bankName: z.string().min(1).max(100),
          accountNo: z.string().min(1).max(50),
          accountName: z.string().max(200).optional(),
          currency: z.string().max(8).optional(),
          isDefault: z.boolean().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => createBankAccount(id, parsed.data))
    },
  )

  server.get(
    '/ledgers/:id/bank-accounts',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => listBankAccounts(id))
    },
  )

  server.post(
    '/ledgers/:id/bank-accounts/:accountId/statements/import',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ statements: z.array(statementBody).min(1).max(2000) })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id, accountId } = request.params as { id: string; accountId: string }
      await guard(reply, () => importStatements(id, accountId, parsed.data.statements))
    },
  )

  server.get(
    '/ledgers/:id/statements',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as {
        period?: string
        matchStatus?: string
        page?: string
        limit?: string
      }
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        listStatements(id, {
          period: q.period,
          matchStatus: q.matchStatus,
          page: q.page ? Number(q.page) : undefined,
          limit: q.limit ? Number(q.limit) : undefined,
        }),
      )
    },
  )

  server.post(
    '/ledgers/:id/statements/auto-match',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ period: PERIOD, dateWindowDays: z.number().int().min(0).max(30).optional() })
        .safeParse(request.body ?? {})
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        autoMatch(id, parsed.data.period, { dateWindowDays: parsed.data.dateWindowDays }),
      )
    },
  )

  server.post(
    '/statements/:id/match',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ voucherId: z.string().uuid() }).safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => manualMatch(id, parsed.data.voucherId))
    },
  )

  server.post(
    '/statements/:id/unmatch',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => unmatchStatement(id))
    },
  )

  server.post(
    '/statements/:id/ignore',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ reason: z.string().max(200).optional() })
        .safeParse(request.body ?? {})
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => ignoreStatement(id, parsed.data.reason))
    },
  )

  server.post(
    '/statements/attach',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({
          statementIds: z.array(z.string().uuid()).min(1).max(200),
          voucherId: z.string().uuid(),
        })
        .safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      await guard(reply, () =>
        attachStatementsToVoucher(parsed.data.statementIds, parsed.data.voucherId),
      )
    },
  )

  server.get(
    '/ledgers/:id/reconcile',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, async () =>
        reconcileSummary(id, q.period ?? (await getLedger(id)).currentPeriod),
      )
    },
  )

  // ============================ 凭证复核 ============================
  server.post(
    '/vouchers/:id/submit-review',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await guard(reply, () => submitReview(id))
    },
  )

  server.post(
    '/vouchers/:id/approve-review',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z
        .object({ comment: z.string().max(2000).optional() })
        .safeParse(request.body ?? {})
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const { id } = request.params as { id: string }
      await guard(reply, () => approveReview(id, userIdOf(request), parsed.data.comment))
    },
  )

  server.post(
    '/vouchers/:id/reject-review',
    { preHandler: requirePermission(MANAGE) },
    async (request, reply) => {
      const parsed = z.object({ comment: z.string().min(2).max(2000) }).safeParse(request.body)
      if (!parsed.success)
        return badRequest(reply, parsed.error.issues[0]?.message ?? '驳回必须写复核意见')
      const { id } = request.params as { id: string }
      await guard(reply, () => rejectReview(id, userIdOf(request), parsed.data.comment))
    },
  )

  server.get(
    '/ledgers/:id/review-queue',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { status?: string; page?: string; limit?: string }
      const { id } = request.params as { id: string }
      await guard(reply, () =>
        reviewQueue({
          ledgerId: id,
          status: q.status === undefined ? undefined : Number(q.status),
          page: q.page ? Number(q.page) : undefined,
          limit: q.limit ? Number(q.limit) : undefined,
        }),
      )
    },
  )

  server.get(
    '/ledgers/:id/review-summary',
    { preHandler: requirePermission(VIEW) },
    async (request, reply) => {
      const q = request.query as { period?: string }
      const { id } = request.params as { id: string }
      await guard(reply, () => reviewSummary(id, q.period))
    },
  )

  // 税务域(税种核定/申报日历/申报任务)在 fin-tax-routes.ts,共用同一前缀
  server.register(finTaxRoutes)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
