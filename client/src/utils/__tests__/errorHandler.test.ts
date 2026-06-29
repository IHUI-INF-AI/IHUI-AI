import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logger } from '@/utils/logger'
import { monitoringService } from '@/utils/monitoring'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ErrorHandler,
  ErrorType,
  ApiErrorType,
  handleError,
  showError,
  getApiErrorType,
  isRetryableError,
  formatApiErrorMessage,
  handleApiError,
  handleApiResponse,
  withRetry,
  createApiWrapper,
} from '../errorHandler'

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('@/locales', () => ({
  default: {
    global: {
      t: (key: string) => key,
    },
  },
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/utils/monitoring', () => ({
  monitoringService: {
    recordError: vi.fn(),
    init: vi.fn(),
    recordMetric: vi.fn(),
    recordEvent: vi.fn(),
  },
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  ElMessageBox: {
    alert: vi.fn().mockResolvedValue(undefined),
    confirm: vi.fn().mockResolvedValue(true),
  },
}))

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ErrorType', () => {
    it('应该定义所有错误类型', () => {
      expect(ErrorType.NETWORK).toBe('network')
      expect(ErrorType.TIMEOUT).toBe('timeout')
      expect(ErrorType.UNAUTHORIZED).toBe('unauthorized')
      expect(ErrorType.FORBIDDEN).toBe('forbidden')
      expect(ErrorType.NOT_FOUND).toBe('not_found')
      expect(ErrorType.SERVER_ERROR).toBe('server_error')
      expect(ErrorType.VALIDATION).toBe('validation')
      expect(ErrorType.BUSINESS).toBe('business')
      expect(ErrorType.UNKNOWN).toBe('unknown')
    })
  })

  describe('ApiErrorType', () => {
    it('应该等于ErrorType', () => {
      expect(ApiErrorType).toBe(ErrorType)
    })
  })

  describe('ErrorHandler.handleAxiosError', () => {
    it('应该处理网络错误', () => {
      const error = {
        response: null,
        message: 'Network Error',
      } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]

      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.NETWORK)
    })

    it('应该处理超时错误', () => {
      const error = {
        response: null,
        code: 'ECONNABORTED',
        message: 'timeout',
      } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]

      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.TIMEOUT)
    })

    it('应该处理401错误', () => {
      const error = {
        response: { status: 401, data: {} },
      } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]

      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.UNAUTHORIZED)
    })

    it('应该处理403错误', () => {
      const error = {
        response: { status: 403, data: {} },
      } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]

      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.FORBIDDEN)
    })

    it('应该处理404错误', () => {
      const error = {
        response: { status: 404, data: {} },
      } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]

      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.NOT_FOUND)
    })

    it('应该处理500错误', () => {
      const error = {
        response: { status: 500, data: {} },
      } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]

      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.SERVER_ERROR)
    })

    it('应该处理422验证错误', () => {
      const error = {
        response: { status: 422, data: { msg: 'Validation failed' } },
      } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]

      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.VALIDATION)
      expect(result.message).toBe('Validation failed')
    })
  })

  describe('ErrorHandler.handleBusinessError', () => {
    it('应该处理业务错误', () => {
      const result = ErrorHandler.handleBusinessError({
        message: 'Business error',
        code: 'BIZ_001',
      })

      expect(result.type).toBe(ErrorType.BUSINESS)
      expect(result.message).toBe('Business error')
      expect(result.code).toBe('BIZ_001')
    })
  })

  describe('ErrorHandler.handleValidationError', () => {
    it('应该处理对象验证错误', () => {
      const result = ErrorHandler.handleValidationError({
        name: ['Name is required'],
        email: ['Email is invalid'],
      })

      expect(result.type).toBe(ErrorType.VALIDATION)
      expect(result.message).toBe('Name is required')
    })

    it('应该处理字符串验证错误', () => {
      const result = ErrorHandler.handleValidationError('Invalid input')
      expect(result.message).toBe('Invalid input')
    })

    it('应该处理数组验证错误', () => {
      const result = ErrorHandler.handleValidationError(['Error 1', 'Error 2'])
      expect(result.message).toBe('Error 1')
    })
  })

  describe('ErrorHandler.showError', () => {
    it('应该在非静默时显示错误', async () => {
      const { ElMessage } = await import('element-plus')
      
      ErrorHandler.showError({
        type: ErrorType.BUSINESS,
        message: 'Test error',
        timestamp: Date.now(),
      })

      expect(ElMessage.error).toHaveBeenCalled()
    })

    it('应该在静默时不显示错误', async () => {
      const { ElMessage } = await import('element-plus')
      
      ErrorHandler.showError(
        { type: ErrorType.BUSINESS, message: 'Test error', timestamp: Date.now() },
        { silent: true }
      )

      expect(ElMessage.error).not.toHaveBeenCalled()
    })
  })

  describe('ErrorHandler.handleAndShow', () => {
    it('应该处理字符串错误', () => {
      const result = ErrorHandler.handleAndShow('String error')
      expect(result.message).toBe('String error')
    })

    it('应该处理Error对象', () => {
      const result = ErrorHandler.handleAndShow(new Error('Error object'))
      expect(result.message).toBe('Error object')
    })
  })

  describe('handleError', () => {
    it('应该调用ErrorHandler.handleAndShow', () => {
      const result = handleError('Test error')
      expect(result.message).toBe('Test error')
    })
  })

  describe('showError', () => {
    it('应该显示错误消息', async () => {
      const { ElMessage } = await import('element-plus')
      
      showError('Test error message')
      expect(ElMessage.error).toHaveBeenCalled()
    })
  })

  describe('getApiErrorType', () => {
    it('应该识别网络错误', () => {
      expect(getApiErrorType(0, 'Network Error')).toBe(ErrorType.NETWORK)
      expect(getApiErrorType(500, '网络错误')).toBe(ErrorType.NETWORK)
    })

    it('应该识别401未授权', () => {
      expect(getApiErrorType(401)).toBe(ErrorType.UNAUTHORIZED)
    })

    it('应该识别403禁止访问', () => {
      expect(getApiErrorType(403)).toBe(ErrorType.FORBIDDEN)
    })

    it('应该识别验证错误', () => {
      expect(getApiErrorType(400)).toBe(ErrorType.VALIDATION)
    })

    it('应该识别服务器错误', () => {
      expect(getApiErrorType(500)).toBe(ErrorType.SERVER_ERROR)
      expect(getApiErrorType(503)).toBe(ErrorType.SERVER_ERROR)
      expect(getApiErrorType(1000)).toBe(ErrorType.SERVER_ERROR)
      expect(getApiErrorType(2000)).toBe(ErrorType.SERVER_ERROR)
      expect(getApiErrorType(3000)).toBe(ErrorType.SERVER_ERROR)
    })
  })

  describe('isRetryableError', () => {
    it('网络错误应该可重试', () => {
      expect(isRetryableError({ type: ErrorType.NETWORK, code: 0, message: '' })).toBe(true)
    })

    it('超时错误应该可重试', () => {
      expect(isRetryableError({ type: ErrorType.TIMEOUT, code: 0, message: '' })).toBe(true)
    })

    it('服务器错误应该可重试', () => {
      expect(isRetryableError({ type: ErrorType.SERVER_ERROR, code: 500, message: '' })).toBe(true)
    })

    it('业务错误不应该可重试', () => {
      expect(isRetryableError({ type: ErrorType.BUSINESS, code: 3000, message: '' })).toBe(false)
    })

    it('应该尊重retryable属性', () => {
      expect(isRetryableError({ type: ErrorType.BUSINESS, code: 3000, message: '', retryable: true })).toBe(true)
    })
  })

  describe('formatApiErrorMessage', () => {
    it('应该使用自定义消息', () => {
      const result = formatApiErrorMessage(
        { type: ErrorType.UNKNOWN, code: 500, message: 'original' },
        { customMessage: 'Custom message' }
      )
      expect(result).toBe('Custom message')
    })

    it('应该使用错误码映射', () => {
      const result = formatApiErrorMessage(
        { type: ErrorType.UNKNOWN, code: 401, message: '' },
        { errorCodeMap: { 401: '请先登录' } }
      )
      expect(result).toBe('请先登录')
    })

    it('应该使用默认错误码映射', () => {
      const result = formatApiErrorMessage({ type: ErrorType.UNKNOWN, code: 404, message: '' }, {})
      expect(result).toBe('text.error_handler.resourceNotFound')
    })

    it('应该使用错误消息', () => {
      const result = formatApiErrorMessage({ type: ErrorType.UNKNOWN, code: 0, message: 'Error message' }, {})
      expect(result).toBe('Error message')
    })

    it('应该使用类型消息', () => {
      const result = formatApiErrorMessage({ type: ErrorType.NETWORK, code: 0, message: '' }, {})
      expect(result).toBe('text.error_handler.networkError')
    })
  })

  describe('handleApiError', () => {
    it('应该处理带有code的对象错误', async () => {
      const { ElMessage } = await import('element-plus')
      
      const result = handleApiError({ code: 401, msg: 'Unauthorized' }, { showMessage: true })
      expect(result.code).toBe(401)
      expect(ElMessage.error).toHaveBeenCalled()
    })

    it('应该处理Error实例', () => {
      const result = handleApiError(new Error('Test error'), { showMessage: false })
      expect(result.message).toBe('Test error')
    })

    it('应该处理未知错误类型', () => {
      const result = handleApiError('string error', { showMessage: false })
      expect(result.message).toBe('string error')
    })
  })

  describe('handleApiResponse', () => {
    it('应该返回成功响应的数据', () => {
      const result = handleApiResponse({ code: 200, success: true, data: { id: 1 } }, {})
      expect(result).toEqual({ id: 1 })
    })

    it('应该处理失败响应', async () => {
      const { ElMessage } = await import('element-plus')
      
      const result = handleApiResponse({ code: 500, success: false, message: 'Error' }, { showMessage: true })
      expect(result).toBeNull()
      expect(ElMessage.error).toHaveBeenCalled()
    })

    it('应该在静默模式下不显示消息', async () => {
      const { ElMessage } = await import('element-plus')
      
      const result = handleApiResponse({ code: 500, success: false, message: 'Error' }, { silent: true })
      expect(result).toBeNull()
      expect(ElMessage.error).not.toHaveBeenCalled()
    })
  })

  describe('withRetry', () => {
    it('应该在成功时返回结果', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(fn)
      expect(result).toBe('success')
    })

    it('应该使用自定义重试条件', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ code: 0, message: 'Network Error' })
        .mockResolvedValue('success')

      const result = await withRetry(fn, {
        maxRetries: 3,
        retryDelay: 10,
        retryCondition: () => true,
      })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('应该在不可重试错误时立即抛出', async () => {
      const fn = vi.fn().mockRejectedValue({ code: 401, message: 'Unauthorized' })

      await expect(
        withRetry(fn, { maxRetries: 2, retryDelay: 10, retryCondition: () => false })
      ).rejects.toEqual({ code: 401, message: 'Unauthorized' })
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('createApiWrapper', () => {
    it('应该包装API函数', async () => {
      const apiFn = vi.fn().mockResolvedValue({ code: 200, success: true, data: { id: 1 } })
      const wrapped = createApiWrapper(apiFn)

      const result = await wrapped()
      expect(result.code).toBe(200)
    })
  })

  // ================== 补充测试：提升覆盖率 ==================

  describe('补充 - handleAxiosError 扩展', () => {
    it('应该处理message包含timeout的超时错误', () => {
      const error = { response: null, message: 'Request timeout' } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.TIMEOUT)
    })

    it('应该处理502网关错误', () => {
      const error = { response: { status: 502, data: {} } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.SERVER_ERROR)
    })

    it('应该处理503服务不可用', () => {
      const error = { response: { status: 503, data: {} } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.SERVER_ERROR)
    })

    it('应该处理504网关超时', () => {
      const error = { response: { status: 504, data: {} } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.SERVER_ERROR)
    })

    it('应该处理422错误使用message字段', () => {
      const error = { response: { status: 422, data: { message: 'Field error' } } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.VALIDATION)
      expect(result.message).toBe('Field error')
    })

    it('应该处理422错误带details', () => {
      const error = { response: { status: 422, data: { errors: { name: 'required' } } } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.details).toEqual({ name: 'required' })
    })

    it('应该处理422错误使用data字段', () => {
      const error = { response: { status: 422, data: { data: { field: 'invalid' } } } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.details).toEqual({ field: 'invalid' })
    })

    it('应该处理422错误没有msg或message', () => {
      const error = { response: { status: 422, data: {} } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.message).toBe('text.error_handler.validationFailed')
    })

    it('应该处理500错误使用msg', () => {
      const error = { response: { status: 500, data: { msg: 'Server crashed' } } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.message).toBe('Server crashed')
    })

    it('应该处理500错误没有msg使用默认', () => {
      const error = { response: { status: 500, data: {} } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.message).toBe('text.error_handler.serverError')
    })

    it('应该处理默认业务错误(状态码非标准)', () => {
      const error = { response: { status: 418, data: { msg: 'I am a teapot' } } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.BUSINESS)
      expect(result.message).toBe('I am a teapot')
    })

    it('应该处理默认业务错误无msg', () => {
      const error = { response: { status: 418, data: {} } } as unknown as Parameters<typeof ErrorHandler.handleAxiosError>[0]
      const result = ErrorHandler.handleAxiosError(error)
      expect(result.type).toBe(ErrorType.BUSINESS)
      expect(result.message).toBe('text.error_handler.requestFailedWithStatus')
    })
  })

  describe('补充 - handleBusinessError 扩展', () => {
    it('应该使用默认业务错误消息当message为空', () => {
      const result = ErrorHandler.handleBusinessError({ code: 'BIZ_001' })
      expect(result.message).toBe('text.error_handler.businessError')
    })

    it('应该将数字code转为字符串', () => {
      const result = ErrorHandler.handleBusinessError({ message: 'err', code: 500 })
      expect(result.code).toBe('500')
    })

    it('应该保留details字段', () => {
      const details = { field: 'value' }
      const result = ErrorHandler.handleBusinessError({ message: 'err', code: 'BIZ', details })
      expect(result.details).toEqual(details)
    })
  })

  describe('补充 - handleValidationError 扩展', () => {
    it('应该处理空对象使用默认消息', () => {
      const result = ErrorHandler.handleValidationError({})
      expect(result.message).toBe('text.error_handler.validationError')
    })

    it('应该处理非字符串非数组的firstError', () => {
      const result = ErrorHandler.handleValidationError({ name: 12345 })
      expect(result.message).toBe('text.error_handler.validationError')
    })

    it('应该处理空数组', () => {
      const result = ErrorHandler.handleValidationError([])
      expect(result.message).toBe('text.error_handler.validationError')
    })
  })

  describe('补充 - showError 扩展', () => {
    it('应该使用自定义duration', async () => {
      const { ElMessage } = await import('element-plus')
      ErrorHandler.showError(
        { type: ErrorType.BUSINESS, message: 'Test', timestamp: Date.now() },
        { duration: 1000 }
      )
      expect(ElMessage.error).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 1000 })
      )
    })

    it('应该处理监控服务异常', () => {
      monitoringService.recordError.mockImplementationOnce(() => {
        throw new Error('monitor fail')
      })
      // 不应抛出异常
      expect(() => {
        ErrorHandler.showError({
          type: ErrorType.SERVER_ERROR,
          message: 'Test',
          timestamp: Date.now(),
        })
      }).not.toThrow()
    })
  })

  describe('补充 - showErrorDialog', () => {
    it('应该显示错误对话框', async () => {
      await ErrorHandler.showErrorDialog({
        type: ErrorType.SERVER_ERROR,
        message: 'Dialog error',
        timestamp: Date.now(),
      })
      expect(ElMessageBox.alert).toHaveBeenCalled()
    })

    it('应该使用自定义title和confirmText', async () => {
      await ErrorHandler.showErrorDialog(
        { type: ErrorType.BUSINESS, message: 'err', timestamp: Date.now() },
        { title: '自定义标题', confirmText: '好的' }
      )
      expect(ElMessageBox.alert).toHaveBeenCalledWith(
        'err',
        '自定义标题',
        expect.objectContaining({ confirmButtonText: '好的' })
      )
    })

    it('应该处理监控服务异常', async () => {
      monitoringService.recordError.mockImplementationOnce(() => {
        throw new Error('monitor fail')
      })
      await expect(
        ErrorHandler.showErrorDialog({
          type: ErrorType.SERVER_ERROR,
          message: 'err',
          timestamp: Date.now(),
        })
      ).resolves.not.toThrow()
    })
  })

  describe('补充 - handleAndShow 扩展', () => {
    it('应该处理业务错误(有message和code)', () => {
      const result = ErrorHandler.handleAndShow({ message: 'biz err', code: 'BIZ_001' })
      expect(result.type).toBe(ErrorType.BUSINESS)
      expect(result.message).toBe('biz err')
    })

    it('应该处理无message的对象', () => {
      const result = ErrorHandler.handleAndShow({})
      expect(result.type).toBe(ErrorType.UNKNOWN)
    })

    it('应该以showDialog方式显示', async () => {
      ErrorHandler.handleAndShow(
        { message: 'biz err', code: 'BIZ' },
        { showDialog: true }
      )
      // 等待异步任务
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(ElMessageBox.alert).toHaveBeenCalled()
    })
  })

  describe('补充 - getApiErrorType 扩展', () => {
    it('负数应该返回UNKNOWN', () => {
      expect(getApiErrorType(-1)).toBe(ErrorType.UNKNOWN)
    })

    it('没有message参数时也应该工作', () => {
      expect(getApiErrorType(401)).toBe(ErrorType.UNAUTHORIZED)
      expect(getApiErrorType(403)).toBe(ErrorType.FORBIDDEN)
    })
  })

  describe('补充 - formatApiErrorMessage 扩展', () => {
    it('应该处理NOT_FOUND类型', () => {
      const result = formatApiErrorMessage({ type: ErrorType.NOT_FOUND, code: 0, message: '' }, {})
      expect(result).toBe('text.error_handler.resourceNotFound')
    })

    it('应该处理UNKNOWN类型', () => {
      const result = formatApiErrorMessage({ type: ErrorType.UNKNOWN, code: 0, message: '' }, {})
      expect(result).toBe('text.error_handler.unknownErrorShort')
    })

    it('应该处理TIMEOUT类型', () => {
      const result = formatApiErrorMessage({ type: ErrorType.TIMEOUT, code: 0, message: '' }, {})
      expect(result).toBe('text.error_handler.requestTimeout')
    })

    it('应该处理FORBIDDEN类型', () => {
      const result = formatApiErrorMessage({ type: ErrorType.FORBIDDEN, code: 0, message: '' }, {})
      expect(result).toBe('text.error_handler.noPermission')
    })

    it('应该处理VALIDATION类型', () => {
      const result = formatApiErrorMessage({ type: ErrorType.VALIDATION, code: 0, message: '' }, {})
      expect(result).toBe('text.error_handler.badRequest')
    })

    it('应该处理BUSINESS类型', () => {
      const result = formatApiErrorMessage({ type: ErrorType.BUSINESS, code: 0, message: '' }, {})
      expect(result).toBe('text.error_handler.businessErrorShort')
    })

    it('应该处理UNAUTHORIZED类型', () => {
      const result = formatApiErrorMessage({ type: ErrorType.UNAUTHORIZED, code: 0, message: '' }, {})
      expect(result).toBe('text.error_handler.loginRequired')
    })

    it('没有匹配时使用默认fallback', () => {
      // 不存在的code,没有message,也没有type
      const result = formatApiErrorMessage(
        { type: 'unknown_type' as ErrorType, code: 99999, message: '' },
        {}
      )
      expect(result).toBe('text.error_handler.requestFailed')
    })
  })

  describe('补充 - handleApiError 扩展', () => {
    it('应该使用showDialog显示错误', async () => {
      handleApiError({ code: 500, msg: 'err' }, { showDialog: true, showMessage: true })
      expect(ElMessageBox.alert).toHaveBeenCalled()
    })

    it('应该支持logError=false不记录', () => {
      handleApiError({ code: 500, msg: 'err' }, { showMessage: false, logError: false })
      expect(logger.error).not.toHaveBeenCalled()
    })

    it('401错误使用warn级别记录', () => {
      handleApiError({ code: 401, msg: '未登录' }, { showMessage: false })
      expect(logger.warn).toHaveBeenCalled()
    })

    it('500错误包含未登录消息使用warn级别', () => {
      handleApiError({ code: 500, msg: '用户未登录' }, { showMessage: false })
      expect(logger.warn).toHaveBeenCalled()
    })

    it('500错误包含unauthorized使用warn级别', () => {
      handleApiError({ code: 500, msg: 'UNAUTHORIZED' }, { showMessage: false })
      expect(logger.warn).toHaveBeenCalled()
    })

    it('500错误在需要认证的API路径上使用warn级别', () => {
      handleApiError(
        { code: 500, msg: 'error', config: { url: '/api/ai-program/ai/chat-history/conversations' } },
        { showMessage: false }
      )
      expect(logger.warn).toHaveBeenCalled()
    })

    it('普通500错误使用error级别', () => {
      handleApiError({ code: 500, msg: '服务器开小差' }, { showMessage: false })
      expect(logger.error).toHaveBeenCalled()
    })

    it('网络错误应该标记为可重试', () => {
      const result = handleApiError({ code: 0, msg: 'Network Error' }, { showMessage: false })
      expect(result.retryable).toBe(true)
    })

    it('使用自定义errorCodeMap', () => {
      handleApiError(
        { code: 401, msg: 'err' },
        { showMessage: true, errorCodeMap: { 401: '请登录' } }
      )
      expect(ElMessage.error).toHaveBeenCalledWith('请登录')
    })

    it('应该处理有message但没有msg的对象', () => {
      const result = handleApiError({ code: 500, message: '测试错误' }, { showMessage: false })
      expect(result.message).toBe('测试错误')
    })
  })

  describe('补充 - handleApiResponse 扩展', () => {
    it('应该识别code=0 + success消息为成功', () => {
      const result = handleApiResponse(
        { code: 0, message: 'success', data: { id: 1 } },
        { showMessage: false }
      )
      expect(result).toEqual({ id: 1 })
    })

    it('应该识别code=0 + ok消息为成功', () => {
      const result = handleApiResponse(
        { code: 0, message: 'ok', data: { id: 2 } },
        { showMessage: false }
      )
      expect(result).toEqual({ id: 2 })
    })

    it('应该识别code=0 + 空消息为成功', () => {
      const result = handleApiResponse(
        { code: 0, message: '', data: { id: 3 } },
        { showMessage: false }
      )
      expect(result).toEqual({ id: 3 })
    })

    it('code=0 + 其他消息不应识别为成功', () => {
      const result = handleApiResponse(
        { code: 0, message: '其他消息', data: { id: 4 } },
        { showMessage: true }
      )
      expect(result).toBeNull()
      expect(ElMessage.error).toHaveBeenCalled()
    })

    it('成功响应data为undefined时返回null', () => {
      const result = handleApiResponse(
        { code: 200, success: true },
        { showMessage: false }
      )
      expect(result).toBeNull()
    })

    it('logError=false时不记录日志', () => {
      handleApiResponse(
        { code: 500, success: false, message: 'err' },
        { showMessage: false, logError: false }
      )
      expect(logger.error).not.toHaveBeenCalled()
    })

    it('showMessage=false时不显示消息', () => {
      handleApiResponse(
        { code: 500, success: false, message: 'err' },
        { showMessage: false }
      )
      expect(ElMessage.error).not.toHaveBeenCalled()
    })

    it('401响应使用warn级别记录', () => {
      handleApiResponse(
        { code: 401, success: false, message: 'err' },
        { showMessage: false }
      )
      expect(logger.warn).toHaveBeenCalled()
    })

    it('500+未登录消息使用warn级别', () => {
      handleApiResponse(
        { code: 500, success: false, message: '用户未登录' },
        { showMessage: false }
      )
      expect(logger.warn).toHaveBeenCalled()
    })

    it('使用config.url检查路径认证', () => {
      handleApiResponse(
        { code: 500, success: false, message: 'err', path: '/api/ai-program/ai/chat-history' },
        { showMessage: false, url: '/api/ai-program/ai/chat-history/conversations' }
      )
      expect(logger.warn).toHaveBeenCalled()
    })

    it('使用响应自带url检查路径', () => {
      handleApiResponse(
        { code: 500, success: false, message: 'err', url: '/api/ai-program/ai/chat-history' },
        { showMessage: false }
      )
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('补充 - withRetry 扩展', () => {
    it('应该重试到maxRetries后抛出错误', async () => {
      const fn = vi.fn().mockRejectedValue({ code: 0, message: 'Network Error' })

      await expect(
        withRetry(fn, { maxRetries: 2, retryDelay: 1 })
      ).rejects.toBeDefined()
      // 默认retryCondition会重试网络错误,所以会尝试maxRetries+1次
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该使用默认retryCondition', async () => {
      const fn = vi.fn().mockResolvedValue('ok')
      const result = await withRetry(fn)
      expect(result).toBe('ok')
    })

    it('非重试错误立即抛出(默认retryCondition)', async () => {
      const fn = vi.fn().mockRejectedValue({ code: 401, message: 'Unauthorized' })
      await expect(withRetry(fn, { maxRetries: 3, retryDelay: 1 })).rejects.toBeDefined()
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('补充 - createApiWrapper 扩展', () => {
    it('应该处理失败响应(data为null时返回原响应)', async () => {
      const apiFn = vi.fn().mockResolvedValue({ code: 500, success: false, message: 'err' })
      const wrapped = createApiWrapper(apiFn, { showMessage: false })
      const result = await wrapped()
      // handleApiResponse返回null,createApiWrapper返回原response
      expect(result).toEqual({ code: 500, success: false, message: 'err' })
    })

    it('应该捕获异常并重新抛出', async () => {
      const apiFn = vi.fn().mockRejectedValue(new Error('network'))
      const wrapped = createApiWrapper(apiFn, { showMessage: false })
      await expect(wrapped()).rejects.toThrow('network')
    })

    it('应该传递参数给API函数', async () => {
      const apiFn = vi.fn().mockResolvedValue({ code: 200, success: true, data: null })
      const wrapped = createApiWrapper(apiFn)
      await wrapped('arg1', 'arg2')
      expect(apiFn).toHaveBeenCalledWith('arg1', 'arg2')
    })
  })
})
