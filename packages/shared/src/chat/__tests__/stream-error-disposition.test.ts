// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对标 Qoder 借鉴清单第 10 项:命名错误码分类处置的判据钉。
//
// 钉住四件:
// ① 码表**不是**第二套(必须与 error-catalog.ts 逐码对齐,覆盖度零缺口);
// ② 同一个分类下的两种相反处置必须被分开(RATE_LIMITED 可重试 / BUDGET_EXHAUSTED 不可)——
//    这正是 HTTP 码做不到而命名码做得到的那一格;
// ③ 未收录的码 ⇒ null(零兜底),`isRetryableErrorCode` 返回 null 而不是 false;
// ④ 15 类分类学全覆盖(类型层面 Record<ViewFailureKind,…> 已强制,这里再运行期钉一次)。
/* eslint-disable @typescript-eslint/no-unnecessary-condition -- 形状判据必须能跑坏输入 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE_CATALOG } from '../error-catalog'
import {
  STREAM_ERROR_ACTIONS,
  STREAM_ERRORS_NAMESPACE,
  isRetryableAction,
  isRetryableErrorCode,
  isStreamErrorAction,
  resolveStreamErrorDisposition,
  streamErrorActionLabelKey,
  uncoveredErrorCodes,
} from '../stream-error-disposition'

const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../..')
// streamErrors 住 shared 包(web 五语言文件正被并行工作流整文件暂存,追加会被覆盖);
// 端上经 mergeMessages 深合并后同样可达。web 包只用于核对"没有第二份"。
const SHARED_MESSAGES = join(REPO_ROOT, 'packages/i18n/messages/shared')
const WEB_MESSAGES = join(REPO_ROOT, 'packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function readPack(locale: (typeof LOCALES)[number]): Record<string, unknown> {
  return JSON.parse(readFileSync(join(SHARED_MESSAGES, `${locale}.json`), 'utf8')) as Record<
    string,
    unknown
  >
}

function leafAt(doc: Record<string, unknown>, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((node, seg) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[seg]
    return undefined
  }, doc)
}

describe('码表单一真相源(§0.6:禁第二套)', () => {
  it('每个目录表码都能给出处置(分类全覆盖)', () => {
    expect(uncoveredErrorCodes()).toEqual([])
  })

  it('处置里的 titleKey 与目录表逐字相等(不另立文案)', () => {
    for (const [code, entry] of Object.entries(ERROR_CODE_CATALOG)) {
      const d = resolveStreamErrorDisposition(code)
      expect(d, code).not.toBeNull()
      expect(d?.titleKey, code).toBe(entry.titleKey)
      expect(d?.category, code).toBe(entry.category)
      if (entry.actionKey) expect(d?.detailKey, code).toBe(entry.actionKey)
      else expect(d?.detailKey, code).toBeUndefined()
    }
  })

  it('不新增任何码:处置函数对目录表之外的码一律 null', () => {
    for (const bogus of ['NOT_A_REAL_CODE', 'accepted', 'INPUT_ADMISSION', '']) {
      expect(resolveStreamErrorDisposition(bogus), bogus).toBeNull()
    }
    expect(resolveStreamErrorDisposition(undefined)).toBeNull()
    expect(resolveStreamErrorDisposition(null)).toBeNull()
  })

  it('大小写不归一(file_not_ready 与 FILE_NOT_READY 是两条真实并存的码)', () => {
    const lower = resolveStreamErrorDisposition('file_not_ready')
    const upper = resolveStreamErrorDisposition('FILE_NOT_READY')
    expect(lower?.code).toBe('file_not_ready')
    expect(upper?.code).toBe('FILE_NOT_READY')
    // 归一会让它们撞成同一个 code;这里钉住"原样回吐"
    expect(lower?.code).not.toBe(upper?.code)
  })
})

describe('同一 HTTP 档下的相反处置必须被分开(Qoder 第 10 项的核心)', () => {
  it('RATE_LIMITED 可重试(等一会儿就过),BUDGET_EXHAUSTED 不可(次日才重置)', () => {
    const rate = resolveStreamErrorDisposition('RATE_LIMITED')
    const budget = resolveStreamErrorDisposition('BUDGET_EXHAUSTED')
    expect(rate?.category).toBe('resourceLimitExceeded')
    expect(budget?.category).toBe('resourceLimitExceeded')
    expect(rate?.retryable).toBe(true)
    expect(rate?.action).toBe('waitAndRetry')
    expect(budget?.retryable).toBe(false)
    expect(budget?.action).toBe('checkQuota')
  })

  it('四类票面点名动作都真实存在且各有码指向', () => {
    const pick = (code: string) => resolveStreamErrorDisposition(code)?.action
    expect(pick('INTERNAL_ERROR')).toBe('retry') // 重试
    expect(pick('MODEL_REFUSED')).toBe('switchModel') // 切模型
    expect(pick('TRIAL_QUOTA_EXCEEDED')).toBe('checkQuota') // 查额度
    expect(pick('ACCOUNT_RESTRICTED')).toBe('contactAdmin') // 联系管理员
  })

  it('authForbidden 分类里 TOKEN_EXPIRED 走 relogin,而非 contactAdmin', () => {
    expect(resolveStreamErrorDisposition('TOKEN_EXPIRED')?.action).toBe('relogin')
    expect(resolveStreamErrorDisposition('ACCOUNT_RESTRICTED')?.action).toBe('contactAdmin')
    expect(resolveStreamErrorDisposition('FORBIDDEN')?.category).toBe('authForbidden')
    expect(resolveStreamErrorDisposition('FORBIDDEN')?.action).toBe('contactAdmin')
  })

  it('超长两码走 trimContext(原样重发必撞,不得挂重试)', () => {
    for (const code of ['CONTEXT_TOO_LONG', 'TEXT_TOO_LONG']) {
      const d = resolveStreamErrorDisposition(code)
      expect(d?.action, code).toBe('trimContext')
      expect(d?.retryable, code).toBe(false)
    }
  })

  it('协议版本过低走 upgradeApp(重试与换模型都救不了)', () => {
    const d = resolveStreamErrorDisposition('VERSION_TOO_LOW')
    expect(d?.action).toBe('upgradeApp')
    expect(d?.retryable).toBe(false)
  })
})

describe('isRetryableAction / isRetryableErrorCode', () => {
  it('只有 retry 与 waitAndRetry 算可重试', () => {
    for (const a of STREAM_ERROR_ACTIONS) {
      expect(isRetryableAction(a), a).toBe(a === 'retry' || a === 'waitAndRetry')
    }
  })

  it('未收录码 ⇒ null(未判定),绝不读成 false', () => {
    expect(isRetryableErrorCode('NOT_A_REAL_CODE')).toBeNull()
    expect(isRetryableErrorCode(undefined)).toBeNull()
    expect(isRetryableErrorCode('')).toBeNull()
  })

  it('收录码 ⇒ 布尔', () => {
    expect(isRetryableErrorCode('INTERNAL_ERROR')).toBe(true)
    expect(isRetryableErrorCode('BUDGET_EXHAUSTED')).toBe(false)
  })
})

describe('动作档闭集与文案键', () => {
  it('9 档齐全、无重复', () => {
    expect(STREAM_ERROR_ACTIONS.length).toBe(9)
    expect(new Set(STREAM_ERROR_ACTIONS).size).toBe(9)
  })

  it('isStreamErrorAction 表外恒 false', () => {
    for (const a of STREAM_ERROR_ACTIONS) expect(isStreamErrorAction(a), a).toBe(true)
    for (const bad of ['ok', '', null, 1, {}]) expect(isStreamErrorAction(bad), String(bad)).toBe(false)
  })

  it('文案键单源:`action.<档>`,与词包键逐字对应', () => {
    for (const a of STREAM_ERROR_ACTIONS) {
      expect(streamErrorActionLabelKey(a)).toBe(`action.${a}`)
    }
  })
})

describe('词包:streamErrors 五语言同批且非空', () => {
  it('命名空间常量是独立的一支(不并进 chat / errorCatalog)', () => {
    expect(STREAM_ERRORS_NAMESPACE).toBe('streamErrors')
  })

  it.each(LOCALES)('%s:9 个动作键 + 5 个准入态 + nextStepLabel 全非空', (locale) => {
    const pack = readPack(locale)
    const ns = pack[STREAM_ERRORS_NAMESPACE] as Record<string, unknown> | undefined
    expect(ns, `${locale} 缺 streamErrors`).toBeTypeOf('object')

    const action = ns?.action as Record<string, unknown>
    expect(Object.keys(action).sort(), locale).toEqual([...STREAM_ERROR_ACTIONS].sort())
    for (const a of STREAM_ERROR_ACTIONS) {
      const v = action[a]
      expect(typeof v, `${locale}.action.${a}`).toBe('string')
      expect((v as string).trim().length, `${locale}.action.${a}`).toBeGreaterThan(0)
    }

    const admission = ns?.admission as Record<string, unknown>
    expect(Object.keys(admission).sort(), locale).toEqual(
      ['admitted', 'queued', 'rejected', 'tentative', 'unconfirmed'].sort(),
    )
    for (const [k, v] of Object.entries(admission)) {
      expect(typeof v, `${locale}.admission.${k}`).toBe('string')
      expect((v as string).trim().length, `${locale}.admission.${k}`).toBeGreaterThan(0)
    }

    const label = ns?.nextStepLabel
    expect(typeof label, `${locale}.nextStepLabel`).toBe('string')
    expect((label as string).trim().length, `${locale}.nextStepLabel`).toBeGreaterThan(0)
  })

  it('五语言的键集合完全对称(只补一种语言 = 红)', () => {
    const shapeOf = (locale: (typeof LOCALES)[number]): string[] => {
      const ns = readPack(locale)[STREAM_ERRORS_NAMESPACE] as Record<string, unknown>
      const keys: string[] = []
      for (const group of Object.keys(ns)) {
        const value = ns[group]
        // 分组可以是对象(动作/准入态),也可以是标量(nextStepLabel)
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const leaf of Object.keys(value as Record<string, unknown>)) keys.push(`${group}.${leaf}`)
        } else {
          keys.push(group)
        }
      }
      return keys.sort()
    }
    const base = shapeOf('zh-CN')
    for (const locale of LOCALES) expect(shapeOf(locale), locale).toEqual(base)
  })

  it('标题/建议键在 ai.pane.errorCatalog 五语言里都取得到(那一支住 web 包,本层只读)', () => {
    for (const locale of LOCALES) {
      const webPack = JSON.parse(
        readFileSync(join(WEB_MESSAGES, `${locale}.json`), 'utf8'),
      ) as Record<string, unknown>
      const d = resolveStreamErrorDisposition('INTERNAL_ERROR')
      expect(d).not.toBeNull()
      if (!d) return
      expect(
        leafAt(webPack, `ai.pane.errorCatalog.${d.titleKey}`),
        `${locale} ${d.titleKey}`,
      ).toBeTypeOf('string')
    }
  })

  it('streamErrors 若在 web 包出现,必须与 shared 那份逐字等值(不得有分叉的第二份)', () => {
    // 本票写入 shared;但 web 五语言文件被并行工作流整文件暂存,追加会被一起收进索引 ⇒
    // 两份可能并存。端上 mergeMessages 深合并(web 覆盖 shared):同值时行为一致,
    // 分叉即漂移源。这条把"必须同值"钉成机器事实。
    for (const locale of LOCALES) {
      const sharedPack = JSON.parse(
        readFileSync(join(SHARED_MESSAGES, `${locale}.json`), 'utf8'),
      ) as Record<string, unknown>
      const webPack = JSON.parse(
        readFileSync(join(WEB_MESSAGES, `${locale}.json`), 'utf8'),
      ) as Record<string, unknown>
      if (webPack[STREAM_ERRORS_NAMESPACE] === undefined) continue
      expect(webPack[STREAM_ERRORS_NAMESPACE], locale).toEqual(sharedPack[STREAM_ERRORS_NAMESPACE])
    }
  })
})

describe('自证:处置表覆盖与分类学一一对应', () => {
  it('15 类分类学每类都至少有一个真实码落在其中', () => {
    const seen = new Set<string>()
    for (const code of Object.keys(ERROR_CODE_CATALOG)) {
      const d = resolveStreamErrorDisposition(code)
      if (d) seen.add(d.category)
    }
    // 目录表实测覆盖 13 类;capabilityNotOffered / disabled 各有一码,backendCrashed 暂无码
    expect(seen.size).toBeGreaterThanOrEqual(12)
    expect(seen.has('authForbidden')).toBe(true)
    expect(seen.has('resourceLimitExceeded')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
