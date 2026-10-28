// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-01 票2:契约定义与运行时校验同源。
 *
 * 三个高频契约各跑一条一致性测试(票面验收草案):
 *   ① 列表响应 PaginatedResponse ↔ PaginatedResponseSchema;
 *   ② ErrorCode 载荷(ApiResult 失败分支)↔ ApiResultFailureSchema;
 *   ③ 跨端错误结构 SerializedError ↔ SerializedErrorSchema。
 * 每条含两层:
 *   - 运行时:schema safeParse(sample) 通过;删掉任一必填字段后断言失败;
 *   - 编译期:z.infer 与旧 hand-written interface 双向赋值不报错
 *     (任一侧改字段即编译红 —— 这些断言不是运行时的,红在 tsc/编辑器里)。
 * 附:响应包络 ApiResponse ↔ ApiResponseEnvelopeSchema(包络的 data: z.unknown()
 * 在缺席语义下推断为可选键,与 ApiResponse.data: T 的必填位不做双向对账,单向即可;
 * "缺席 vs 零"的承载归 b76-01 票4)。
 */
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import {
  ApiResponseEnvelopeSchema,
  ApiResultFailureSchema,
  PaginatedResponseSchema,
  parsePaginatedResponse,
  parseApiResultFailure,
  ContractValidationError,
} from '../src/api-contracts.js'
import { SerializedErrorSchema, parseSerializedError } from '../src/error-serialize.js'
import type { ApiResponse, PaginatedResponse, ApiResult } from '../src/api.js'
import type { SerializedError } from '../src/error-serialize.js'

describe('票2 · 列表响应 PaginatedResponse 同源', () => {
  it('运行时:safeParse(sample) 通过,删任一必填字段后失败', () => {
    const sample = { list: [{ id: 1 }], total: 1, page: 1, pageSize: 20 }
    expect(PaginatedResponseSchema.safeParse(sample).success).toBe(true)

    const { pageSize: _pageSize, ...missingPageSize } = sample
    expect(PaginatedResponseSchema.safeParse(missingPageSize).success).toBe(false)

    const { total: _total, ...missingTotal } = sample
    expect(PaginatedResponseSchema.safeParse(missingTotal).success).toBe(false)
  })

  it('parsePaginatedResponse 通过;未知字段判失败', () => {
    expect(parsePaginatedResponse({ list: [], total: 0, page: 1, pageSize: 20 })).toEqual({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })
    expect(() => parsePaginatedResponse({ list: [], total: 0, page: 1, pageSize: 20, junk: 1 })).toThrow(
      ContractValidationError,
    )
  })

  it('编译期:z.infer 与旧 interface 双向赋值,任一侧改字段即编译红', () => {
    type PaginatedInferred = z.infer<typeof PaginatedResponseSchema>
    // schema → 旧 interface
    const fromSchema = PaginatedResponseSchema.parse({ list: [], total: 0, page: 1, pageSize: 20 })
    const asIface: PaginatedResponse<unknown> = fromSchema
    // 旧 interface → schema
    declareIface: {
      const iface = { list: [], total: 0, page: 1, pageSize: 20 } as PaginatedResponse<unknown>
      const asInferred: PaginatedInferred = iface
      expect(asInferred.total).toBe(0)
    }
    expect(asIface.pageSize).toBe(20)
  })
})

describe('票2 · ErrorCode 载荷(ApiResult 失败分支)同源', () => {
  it('运行时:safeParse(sample) 通过,删掉 error 后失败', () => {
    const sample = { success: false, error: 'boom', errorCode: 'E_X' } as const
    expect(ApiResultFailureSchema.safeParse(sample).success).toBe(true)

    const missingError = { success: false, errorCode: 'E_X' }
    expect(ApiResultFailureSchema.safeParse(missingError).success).toBe(false)
  })

  it('parseApiResultFailure 通过;errorCode 缺席不补 undefined 值', () => {
    const parsed = parseApiResultFailure({ success: false, error: 'boom' })
    expect(parsed.error).toBe('boom')
    expect(parsed.errorCode).toBeUndefined()
  })

  it('编译期:z.infer 与旧 Extract<ApiResult> 双向赋值,任一侧改字段即编译红', () => {
    type ApiFailure = Extract<ApiResult<unknown>, { success: false }>
    type FailureInferred = z.infer<typeof ApiResultFailureSchema>
    const fromSchema = ApiResultFailureSchema.parse({ success: false, error: 'boom' })
    const asIface: ApiFailure = fromSchema
    const iface = { success: false, error: 'boom' } as ApiFailure
    const asInferred: FailureInferred = iface
    expect(asIface.error).toBe('boom')
    expect(asInferred.success).toBe(false)
  })
})

describe('票2 · 跨端错误结构 SerializedError 同源', () => {
  it('运行时:嵌套 cause safeParse 通过,删掉 name 后失败', () => {
    const sample = { name: 'Error', message: 'boom', cause: { name: 'E', message: 'inner' } }
    expect(SerializedErrorSchema.safeParse(sample).success).toBe(true)

    const missingName = { message: 'boom', cause: { name: 'E', message: 'inner' } }
    expect(SerializedErrorSchema.safeParse(missingName).success).toBe(false)
  })

  it('parseSerializedError 通过;未知字段判失败', () => {
    const parsed = parseSerializedError({ name: 'Error', message: 'boom', truncated: true })
    expect(parsed.message).toBe('boom')
    expect(() => parseSerializedError({ name: 'E', message: 'x', extra: 1 })).toThrow(
      ContractValidationError,
    )
  })

  it('编译期:z.infer 与旧 interface 双向赋值,任一侧改字段即编译红', () => {
    type SerializedInferred = z.infer<typeof SerializedErrorSchema>
    const fromSchema = SerializedErrorSchema.parse({ name: 'Error', message: 'boom' })
    const asIface: SerializedError = fromSchema
    const iface = { name: 'Error', message: 'boom' } as SerializedError
    const asInferred: SerializedInferred = iface
    expect(asIface.name).toBe('Error')
    expect(asInferred.message).toBe('boom')
  })
})

describe('票2 · 响应包络 ApiResponse 同源(单向对账 + 运行时)', () => {
  it('运行时:包络 safeParse 通过,删掉 message 后失败', () => {
    const sample = { code: 0, message: 'ok', data: { a: 1 } }
    expect(ApiResponseEnvelopeSchema.safeParse(sample).success).toBe(true)
    const missingMessage = { code: 0, data: { a: 1 } }
    expect(ApiResponseEnvelopeSchema.safeParse(missingMessage).success).toBe(false)
  })

  it('编译期:旧 interface → schema 推断 单向赋值不报错', () => {
    type EnvelopeInferred = z.infer<typeof ApiResponseEnvelopeSchema>
    // 旧 interface 形态的值赋给 schema 推断面(反向被 data: z.unknown() 的
    // "缺席即可选"语义挡住,见文件头注)。
    const ifaceLike = { code: 0, message: 'ok' } as ApiResponse<unknown>
    const asInferred: EnvelopeInferred = ifaceLike
    expect(asInferred.code).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
