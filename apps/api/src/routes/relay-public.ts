/**
 * /api/relay/* 公开端点(P0-5g,2026-07-29 立)。
 *
 * 无需鉴权(公开),用于前端模型市场展示中转站已上架模型清单 + 定价倍率。
 *
 * 端点清单:
 * 1. GET /api/relay/models/public — 中转站已上架模型清单(isRelayPublic=true AND enabled=true)
 *    返回字段:modelId / displayName / providerCode / contextLength /
 *            inputPricePer1k / outputPricePer1k(基础价)/ relayPriceMultiplier /
 *            relayInputPricePer1k / relayOutputPricePer1k(中转站定价 = 基础价 × 倍率)
 *
 * 前端模型市场消费此端点,在 Model 卡片上展示"中转站可用"徽章 +
 * 中转站定价(基础价 × 倍率)+ "获取 API Key"快捷入口。
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { aiModelConfigModels, aiModelConfig } from '@ihui/database'
import { success } from '../utils/response.js'

/** 公开返回的模型条目结构(前端 Model 类型扩展用) */
interface PublicRelayModelItem {
  /** 模型 id(与 /v1/chat/completions 的 model 参数一致) */
  modelId: string
  /** 中转站展示名(relayDisplayName > displayName > modelId) */
  displayName: string
  /** 厂商 provider code(openai / anthropic / stepfun / ...) */
  providerCode: string
  /** 上下文长度 */
  contextLength: number
  /** 基础输入价(分/千 token,来自 aiModelConfigModels.inputPricePer1k) */
  inputPricePer1k: number
  /** 基础输出价(分/千 token) */
  outputPricePer1k: number
  /** 中转站定价倍率(1.0=原价,1.2=加价 20%) */
  relayPriceMultiplier: number
  /** 中转站输入价(分/千 token,= inputPricePer1k × relayPriceMultiplier) */
  relayInputPricePer1k: number
  /** 中转站输出价(分/千 token,= outputPricePer1k × relayPriceMultiplier) */
  relayOutputPricePer1k: number
  /** 中转站展示排序(越小越靠前) */
  relaySortOrder: number
}

/** 数字字符串 → number,容错 */
function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

const relayPublicRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /models/public — 中转站已上架模型清单
   *
   * 公开访问(无 auth),5min 服务端缓存建议(由前端 next.revalidate 实现)。
   * 返回结构:{ items: PublicRelayModelItem[] }
   */
  server.get('/models/public', async (_request, reply) => {
    try {
      const rows = await dbRead
        .select({
          modelId: aiModelConfigModels.modelId,
          displayName: aiModelConfigModels.displayName,
          relayDisplayName: aiModelConfigModels.relayDisplayName,
          contextLength: aiModelConfigModels.contextLength,
          inputPricePer1k: aiModelConfigModels.inputPricePer1k,
          outputPricePer1k: aiModelConfigModels.outputPricePer1k,
          relayPriceMultiplier: aiModelConfigModels.relayPriceMultiplier,
          relaySortOrder: aiModelConfigModels.relaySortOrder,
          providerCode: aiModelConfig.providerCode,
          configName: aiModelConfig.name,
        })
        .from(aiModelConfigModels)
        .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
        .where(
          and(
            eq(aiModelConfigModels.isRelayPublic, true),
            eq(aiModelConfigModels.enabled, true),
            eq(aiModelConfig.enabled, true),
          ),
        )
        .orderBy(aiModelConfigModels.relaySortOrder, aiModelConfigModels.modelId)

      const items: PublicRelayModelItem[] = rows.map((r) => {
        const multiplier = Math.max(0, toNumber(r.relayPriceMultiplier, 1))
        const inputBase = toNumber(r.inputPricePer1k, 0)
        const outputBase = toNumber(r.outputPricePer1k, 0)
        return {
          modelId: r.modelId,
          displayName:
            r.relayDisplayName ?? r.displayName ?? r.modelId,
          providerCode: r.providerCode ?? r.configName ?? 'unknown',
          contextLength: toNumber(r.contextLength, 0),
          inputPricePer1k: inputBase,
          outputPricePer1k: outputBase,
          relayPriceMultiplier: multiplier,
          relayInputPricePer1k: Math.round(inputBase * multiplier),
          relayOutputPricePer1k: Math.round(outputBase * multiplier),
          relaySortOrder: toNumber(r.relaySortOrder, 0),
        }
      })

      return reply.send(success({ items }))
    } catch {
      // 失败时返回空清单(前端降级到无徽章状态)
      return reply.send(success({ items: [] }))
    }
  })
}

export { relayPublicRoutes }
