// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 插件 / MCP 视图失败分类学测试(PROJECT_PLAN D92 验收项)。
 *
 * 钉三件事:
 * 1. 表形态 —— 恰好 15 类、kind 唯一、每类都有标题键 + 建议动作键 + 生命周期依据;
 * 2. 判据链 —— 分类码 / JSON-RPC 码 / HTTP 状态 / Error.name / 文案 五档各自可判,
 *    且**优先级冲突**(command not found vs not found)不误判;
 * 3. 不误报 —— 未知码必须回落通用态(`isFallback`),且回落态不得产出错误码行。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  VIEW_FAILURE_ENTRIES,
  VIEW_FAILURE_BY_KIND,
  VIEW_FAILURE_FALLBACK,
  VIEW_FAILURE_KINDS,
  VIEW_FAILURE_RELOAD_KEY,
  VIEW_FAILURE_ERROR_CODE_KEY,
  UNKNOWN_FAILURE_KIND,
  classifyViewFailure,
  readViewFailureSignal,
  resolveViewFailure,
} from '../../src/utils/view-failure-taxonomy'
import type { ViewFailureSignal } from '../../src/utils/view-failure-taxonomy'

const here = dirname(fileURLToPath(import.meta.url))

describe('D92 表形态:15 类', () => {
  it('恰好 15 类,不含回落态', () => {
    expect(VIEW_FAILURE_ENTRIES).toHaveLength(15)
    expect(VIEW_FAILURE_KINDS).not.toContain(UNKNOWN_FAILURE_KIND)
  })

  it('kind 与 code 均唯一', () => {
    expect(new Set(VIEW_FAILURE_KINDS).size).toBe(15)
    expect(new Set(VIEW_FAILURE_ENTRIES.map((e) => e.code)).size).toBe(15)
  })

  it('每类都有 标题键 + 建议动作键 + 生命周期依据 + 阶段', () => {
    for (const e of VIEW_FAILURE_ENTRIES) {
      expect(e.titleKey).toBe(`${e.kind}.title`)
      expect(e.actionKey).toBe(`${e.kind}.action`)
      expect(e.lifecycleBasis.length).toBeGreaterThan(10)
      expect(e.isFallback).toBe(false)
      expect(VIEW_FAILURE_BY_KIND[e.kind]).toBe(e)
    }
  })

  it('回落态存在且自成一格', () => {
    expect(VIEW_FAILURE_FALLBACK.isFallback).toBe(true)
    expect(VIEW_FAILURE_BY_KIND[UNKNOWN_FAILURE_KIND]).toBe(VIEW_FAILURE_FALLBACK)
  })

  it('PLAN 原文点名的 12 类全部在册', () => {
    const kinds = new Set<string>(VIEW_FAILURE_KINDS)
    for (const k of [
      'resourceNotFound',
      'runtimeException',
      'entrypointNotRegistered',
      'entrypointInvalid',
      'dependencyModuleMissing',
      'resourceLimitExceeded',
      'environmentInitFailed',
      'disabled',
      'backendTimeout',
      'backendExited',
      'capabilityNotOffered',
      'backendCrashed',
    ]) {
      expect(kinds.has(k)).toBe(true)
    }
  })

  it('五语言词表覆盖 15 类 + 回落 + 统一恢复动作 + 错误码标签', () => {
    const langs = ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'] as const
    for (const lang of langs) {
      const path = join(here, '../../../i18n/messages/shared', `${lang}.json`)
      const all = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
      const ns = all.viewFailure as Record<string, Record<string, unknown>> | undefined
      expect(ns, `${lang} 缺 viewFailure 命名空间`).toBeTruthy()
      for (const e of [...VIEW_FAILURE_ENTRIES, VIEW_FAILURE_FALLBACK]) {
        expect(ns?.[e.kind]?.title, `${lang} ${e.kind}.title`).toBeTruthy()
        expect(ns?.[e.kind]?.action, `${lang} ${e.kind}.action`).toBeTruthy()
      }
      expect(ns?.[VIEW_FAILURE_RELOAD_KEY], `${lang} reloadView`).toBeTruthy()
      expect(ns?.[VIEW_FAILURE_ERROR_CODE_KEY], `${lang} errorCodeLabel`).toBeTruthy()
    }
  })
})

describe('D92 判据链:五档各判其位', () => {
  const c = (s: ViewFailureSignal) => classifyViewFailure(s).kind

  it('档 1 分类码(含 MCP_ 前缀 / 连字符 / 小写形态等价)', () => {
    for (const raw of [
      'backend_timeout',
      'backend-timeout',
      'MCP_BACKEND_TIMEOUT',
      'backendTimeout',
    ]) {
      expect(c({ errorCode: raw })).toBe('backendTimeout')
    }
  })

  it('档 2 MCP JSON-RPC 规范码', () => {
    expect(c({ jsonRpcCode: -32002 })).toBe('resourceNotFound')
    expect(c({ jsonRpcCode: -32601 })).toBe('capabilityNotOffered')
    expect(c({ jsonRpcCode: -32700 })).toBe('invalidResponse')
    expect(c({ jsonRpcCode: -32600 })).toBe('protocolMismatch')
    expect(c({ jsonRpcCode: -32603 })).toBe('runtimeException')
  })

  it('档 3 HTTP 状态码', () => {
    expect(c({ httpStatus: 401 })).toBe('authForbidden')
    expect(c({ httpStatus: 404 })).toBe('resourceNotFound')
    expect(c({ httpStatus: 504 })).toBe('backendTimeout')
    expect(c({ httpStatus: 502 })).toBe('backendExited')
    expect(c({ httpStatus: 429 })).toBe('resourceLimitExceeded')
  })

  it('档 4 Error.name', () => {
    expect(c({ errorName: 'AbortError' })).toBe('backendTimeout')
    expect(c({ errorName: 'TimeoutError' })).toBe('backendTimeout')
  })

  it('档 5 文案兜底', () => {
    expect(c({ message: 'Server process exited with code 0' })).toBe('backendExited')
    expect(c({ message: 'Cannot find module @ihui/mcp-bridge' })).toBe('dependencyModuleMissing')
    expect(c({ message: '插件视图已被停用' })).toBe('disabled')
    expect(c({ message: 'initialize 握手失败,环境初始化失败' })).toBe('environmentInitFailed')
    expect(c({ message: 'protocolVersion 0:0:0 not supported' })).toBe('protocolMismatch')
  })

  it('优先级:分类码压过状态码与文案', () => {
    const r = classifyViewFailure({
      errorCode: 'disabled',
      httpStatus: 500,
      message: 'internal error',
    })
    expect(r.kind).toBe('disabled')
    expect(r.matchedBy).toBe('errorCode')
  })

  it('冲突不误判:command not found 判入口无效,不判资源未找到', () => {
    expect(c({ message: 'spawn uvx: command not found' })).toBe('entrypointInvalid')
    expect(c({ message: 'resource not found: file:///a.txt' })).toBe('resourceNotFound')
  })
})

describe('D92 不误报:未知码回落通用态', () => {
  it('完全无信号 → 回落,matchedBy=fallback', () => {
    const r = classifyViewFailure({})
    expect(r.isFallback).toBe(true)
    expect(r.kind).toBe(UNKNOWN_FAILURE_KIND)
    expect(r.matchedBy).toBe('fallback')
    expect(r.entry).toBe(VIEW_FAILURE_FALLBACK)
  })

  it('未知错误码 → 回落且不冒充具体分类', () => {
    const r = classifyViewFailure({ errorCode: 'SOMETHING_WE_HAVE_NEVER_SEEN' })
    expect(r.isFallback).toBe(true)
    expect(r.titleKey).not.toBe('resourceNotFound.title')
  })

  it('回落态不产出错误码行(无可信码不得写"错误码:")', () => {
    expect(classifyViewFailure({}).errorCodeText).toBeNull()
    expect(classifyViewFailure({ errorName: 'WhateverError' }).errorCodeText).toBeNull()
  })

  it('判出类别时才展示错误码,且保留上游原值', () => {
    expect(classifyViewFailure({ errorCode: 'MCP_BACKEND_TIMEOUT' }).errorCodeText).toBe(
      'MCP_BACKEND_TIMEOUT',
    )
    expect(classifyViewFailure({ jsonRpcCode: -32002 }).errorCodeText).toBe('-32002')
    expect(classifyViewFailure({ httpStatus: 404 }).errorCodeText).toBe('404')
  })

  it('统一恢复动作恒在:任一分类(含回落)都给出 reloadKey', () => {
    for (const s of [{}, { errorCode: 'disabled' }, { jsonRpcCode: -32601 }, { httpStatus: 500 }]) {
      expect(classifyViewFailure(s).reloadKey).toBe(VIEW_FAILURE_RELOAD_KEY)
    }
  })
})

describe('D92 与 attachErrorMeta 同源(不需适配层)', () => {
  it('读 attachErrorMeta 挂过字段的 SSEError', () => {
    const err = new Error('upstream timed out')
    err.name = 'SSEError'
    Object.assign(err, { code: 504, errorCode: 'BACKEND_TIMEOUT', retryAfter: 30 })
    const r = resolveViewFailure(err)
    expect(r.kind).toBe('backendTimeout')
    expect(readViewFailureSignal(err).httpStatus).toBe(504)
  })

  it('JSON-RPC 数字码从 json 对象直读,不与 HTTP 状态混淆', () => {
    expect(readViewFailureSignal({ code: -32601, message: 'x' })).toEqual({
      jsonRpcCode: -32601,
      httpStatus: undefined,
      errorName: undefined,
      message: 'x',
      errorCode: undefined,
    })
    expect(readViewFailureSignal({ code: 500, message: 'x' }).httpStatus).toBe(500)
  })

  it('脏输入不崩:null / 字符串 / 数字 / 数组 / 非对象 code', () => {
    expect(resolveViewFailure(null).isFallback).toBe(true)
    expect(resolveViewFailure(undefined).isFallback).toBe(true)
    expect(resolveViewFailure(42).isFallback).toBe(true)
    expect(resolveViewFailure([]).isFallback).toBe(true)
    expect(resolveViewFailure('boom').isFallback).toBe(true)
    expect(resolveViewFailure({ code: '500' }).isFallback).toBe(true)
    expect(resolveViewFailure(new Error('资源不存在')).kind).toBe('resourceNotFound')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
