// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * F-385 回归锁(P1):模型映射后不复检 allowedModels → 绕过白名单与计费口径。
 *
 * 漏洞:API Key 白名单只含 model-a,请求 model-a 在鉴权阶段通过 checkAllowedModels,
 * 但随后 resolveModelMapping 把它改写成 targetModel=model-z,后续限流/计费/上游转发
 * 全部按 model-z 执行,全程不再校验白名单 → 低价套餐实际调用高价模型。
 *
 * 修复:v1-public 转发链在映射解析**之后**、上游调用**之前**对 resolvedModel 复检
 * checkAllowedModels,不通过返回 403。本文件用接线锁钉住四件事(判据单一来源在
 * plugins/api-key-auth.ts 的 checkAllowedModels,不在本文件复制):
 *   1) 复检调用真实存在且落在映射赋值之后;
 *   2) 复检用的是"映射后 resolvedModel"而非"原始 model";
 *   3) 复检失败返回 403(提前 return,不给上游调用机会);
 *   4) ApiKeyContext 携带 allowedModels(否则复检拿不到白名单)。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const SRC = 'src/routes/v1-public.ts'
const raw = readFileSync(SRC, 'utf-8')

describe('F-385:映射后必须复检 allowedModels', () => {
  it('接线锁:复检调用存在,且落在 resolveModelMapping 之后', () => {
    const resolveAt = raw.indexOf('await resolveModelMapping(')
    const recheckAt = raw.indexOf('checkAllowedModels(apiKey.allowedModels')
    expect(resolveAt, '找不到映射解析调用').toBeGreaterThan(-1)
    expect(recheckAt, '找不到映射后白名单复检调用').toBeGreaterThan(-1)
    expect(recheckAt, '白名单复检必须发生在映射解析之后').toBeGreaterThan(resolveAt)
  })

  it('接线锁:复检的是映射后 resolvedModel(不是原始 model)', () => {
    expect(raw, '复检第二个参数应为 resolvedModel').toMatch(
      /checkAllowedModels\(\s*apiKey\.allowedModels[^)]*,\s*resolvedModel\s*\)/,
    )
  })

  it('接线锁:复检不通过返回 403(映射后模型不在白名单)', () => {
    const recheckAt = raw.indexOf('checkAllowedModels(apiKey.allowedModels')
    const okFalseAt = raw.indexOf('mappedModelCheck.ok', recheckAt)
    const status403At = raw.indexOf('.status(403)', okFalseAt)
    const returnReplyAt = raw.indexOf('return reply', okFalseAt)
    expect(okFalseAt, '复检后必须判定 ok').toBeGreaterThan(recheckAt)
    expect(returnReplyAt, '不通过必须提前 return reply(命中即拒)').toBeGreaterThan(okFalseAt)
    expect(status403At, '不通过必须返回 403').toBeGreaterThan(returnReplyAt)
    const seg = raw.slice(status403At, status403At + 140)
    expect(seg, '403 消息应点名"映射后模型不在白名单"').toMatch(/映射后模型不在/)
  })

  it('接线锁:ApiKeyContext 携带 allowedModels(否则复检拿不到白名单)', () => {
    const ctxAt = raw.indexOf('interface ApiKeyContext')
    expect(ctxAt, 'v1-public 应声明局部 ApiKeyContext').toBeGreaterThan(-1)
    const ctxBlock = raw.slice(ctxAt, raw.indexOf('}', ctxAt) + 1)
    expect(ctxBlock, 'ApiKeyContext 必须含 allowedModels 字段').toMatch(/allowedModels/)
  })

  it('接线锁:checkAllowedModels 从 api-key-auth 单一来源导入', () => {
    expect(raw, '应从 plugins/api-key-auth.js 导入 checkAllowedModels').toMatch(
      /import\s*\{[^}]*checkAllowedModels[^}]*\}\s*from\s*'\.\.\/plugins\/api-key-auth\.js'/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
