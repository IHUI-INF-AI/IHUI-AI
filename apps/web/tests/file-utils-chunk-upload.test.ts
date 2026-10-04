// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * chunkUpload 的"提交后发布 + 失败必撤销 + 服务端续点"三条不变量(G-816032 web 侧)。
 *
 * 钉的是 apps/web/src/lib/file-utils.ts 里分片上传的失败路径与续点路径 ——
 * 后端 apps/api/src/routes/chunked-upload.ts 的 cancel/status 两条出口早已建好,
 * 此前客户端零调用点,于是:任一中间片失败 ⇒ 会话留在服务端等 24h TTL 收、
 * 服务端已收到的片不被承认、重试从 0 起且换新 uploadId。
 *
 * 每条判据都带正反对照:只判"失败要 cancel"的实现会退化成"无条件 cancel",
 * 所以 init 失败那一例必须判**不发 cancel**;只判"跳过已传片"的实现会退化成
 * "永远从 0 重传",所以续点那一例必须逐片号断言。
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

const { fetchApiMock } = vi.hoisted(() => ({ fetchApiMock: vi.fn() }))

vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))

import { chunkUpload } from '../src/lib/file-utils'

const UPLOAD_ID = 'upload-uuid-1'
const CHUNK_SIZE = 10
const FILE_SIZE = 42 // ⇒ 5 片(前 4 片各 10 B,末片 2 B)
const TOTAL_CHUNKS = Math.ceil(FILE_SIZE / CHUNK_SIZE)

interface RecordedCall {
  url: string
  method: string
  /** 请求头 x-chunk-number(仅 upload 请求有)。 */
  chunkNumber: string | null
  /** 请求头 x-upload-id(仅 upload 请求有)。 */
  uploadIdHeader: string | null
  /** JSON 请求体文本(便于断言 cancel/merge 带的是同一个 uploadId)。 */
  jsonBody: string | null
  /** 撤销请求是否被塞进了调用方的 AbortSignal —— 已 abort 时带上就发不出去。 */
  carriedSignal: boolean
}

function makeFile(): File {
  const bytes = new Uint8Array(FILE_SIZE)
  for (let i = 0; i < FILE_SIZE; i++) bytes[i] = i % 251
  return new File([bytes], 'big.bin', { type: 'application/octet-stream' })
}

/**
 * upload_sessions 行的载荷形状(字段名逐字取自 apps/api/src/routes/chunked-upload.ts
 * 的 status 响应与 packages/database/src/schema/upload-sessions.ts)。
 * 服务端只剥掉 filePath,其余列原样返回。
 */
function sessionView(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uploadId: UPLOAD_ID,
    status: 'uploading',
    totalChunks: TOTAL_CHUNKS,
    chunkSize: CHUNK_SIZE,
    fileName: 'big.bin',
    fileSize: FILE_SIZE,
    uploadedChunks: 0,
    ...overrides,
  }
}

/** 从 fetchApi 的调用参数还原成可读的调用清单。 */
function record(url: string, options: RequestInit & { timeoutMs?: number }): RecordedCall {
  const headers = (options.headers ?? {}) as Record<string, string>
  return {
    url,
    method: (options.method ?? 'GET').toUpperCase(),
    chunkNumber: headers['x-chunk-number'] ?? null,
    uploadIdHeader: headers['x-upload-id'] ?? null,
    jsonBody: typeof options.body === 'string' ? options.body : null,
    carriedSignal: options.signal !== undefined && options.signal !== null,
  }
}

const calls: RecordedCall[] = []

/** 服务端替身。字段名逐字取自 apps/api/src/routes/chunked-upload.ts 的响应载荷。 */
interface ServerBehaviour {
  initOk?: boolean
  /** 1-based:第几片失败;不传 = 全成功。 */
  failAtChunk?: number
  /** 服务端回报的 uploadedChunks;默认等于片号(即"收到第 N 片就计数 N")。 */
  confirmAs?: (chunkNumber: number) => number
  /** 服务端回显的 chunkNumber;默认与请求一致(回验用)。 */
  echoChunkNumber?: (chunkNumber: number) => number
  mergeOk?: boolean
  cancelOk?: boolean
  /** GET /status 的 data 载荷(upload_sessions 行的形状)。 */
  status?: Record<string, unknown> | null
  /** 在第一次 upload 请求到达时 abort(模拟用户中断)。 */
  abortOnFirstUpload?: (controller: AbortController) => void
}

function installServer(behaviour: ServerBehaviour): AbortController {
  const controller = new AbortController()
  const {
    initOk = true,
    failAtChunk,
    confirmAs,
    echoChunkNumber,
    mergeOk = true,
    cancelOk = true,
    status = null,
    abortOnFirstUpload,
  } = behaviour

  let uploadSeen = 0

  fetchApiMock.mockImplementation(async (url: string, options: RequestInit = {}) => {
    const call = record(url, options)
    calls.push(call)

    if (url.includes('/chunked-upload/init')) {
      if (!initOk) return { success: false, error: '初始化炸了', status: 500 }
      return {
        success: true,
        data: { uploadId: UPLOAD_ID, uploadedChunks: 0, chunkSize: CHUNK_SIZE },
      }
    }

    if (url.includes('/chunked-upload/status')) {
      if (status === null) return { success: false, error: '查询上传进度失败', status: 500 }
      return { success: true, data: status }
    }

    if (url.includes('/chunked-upload/upload')) {
      uploadSeen += 1
      if (uploadSeen === 1) abortOnFirstUpload?.(controller)
      const chunkNumber = Number(call.chunkNumber)
      if (failAtChunk !== undefined && chunkNumber === failAtChunk) {
        return { success: false, error: `服务端拒收第 ${chunkNumber} 片`, status: 413 }
      }
      return {
        success: true,
        data: {
          uploadId: UPLOAD_ID,
          chunkNumber: echoChunkNumber ? echoChunkNumber(chunkNumber) : chunkNumber,
          uploadedChunks: confirmAs ? confirmAs(chunkNumber) : chunkNumber,
          totalChunks: TOTAL_CHUNKS,
        },
      }
    }

    if (url.includes('/chunked-upload/merge')) {
      if (!mergeOk) return { success: false, error: '分片未收齐:缺第 5 片', status: 400 }
      return {
        success: true,
        data: { uploadId: UPLOAD_ID, fileId: 'file-1', url: '/uploads/file-1' },
      }
    }

    if (url.includes('/chunked-upload/cancel')) {
      if (!cancelOk) return { success: false, error: '撤销失败', status: 500 }
      return { success: true, data: { uploadId: UPLOAD_ID, cancelled: true } }
    }

    return { success: false, error: `替身没有这条路由: ${url}` }
  })

  return controller
}

const pathsOf = (): string[] => calls.map((c) => c.url.replace('/api/chunked-upload/', ''))
const cancelCalls = (): RecordedCall[] =>
  calls.filter((c) => c.url.includes('/chunked-upload/cancel'))
const uploadCalls = (): RecordedCall[] =>
  calls.filter((c) => c.url.includes('/chunked-upload/upload'))
const sentChunkNumbers = (): number[] => uploadCalls().map((c) => Number(c.chunkNumber))

let warnSpy: Mock
beforeEach(() => {
  calls.length = 0
  fetchApiMock.mockReset()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
  warnSpy.mockRestore()
})

describe('chunkUpload — 提交后发布', () => {
  it('全部片传完且服务端确认收齐 ⇒ 才发起 merge,且不发 cancel', async () => {
    installServer({})

    const result = await chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1 })

    expect(result).toEqual({ fileId: 'file-1', url: '/uploads/file-1', size: FILE_SIZE })
    // merge 必须是"最后一片的请求完成之后"发出的,不是每片成功时就假定可用
    expect(pathsOf()).toEqual(['init', 'upload', 'upload', 'upload', 'upload', 'upload', 'merge'])
    expect(cancelCalls()).toHaveLength(0)
  })

  it('服务端没确认收齐 ⇒ 不提交 merge,撤销会话并报错(本地跑完循环 ≠ 服务端收齐)', async () => {
    installServer({ confirmAs: () => TOTAL_CHUNKS - 1 })

    await expect(chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1 })).rejects.toThrow(
      /服务端仅确认收到 4\/5/,
    )
    expect(pathsOf().filter((p) => p === 'merge')).toHaveLength(0)
    expect(cancelCalls()).toHaveLength(1)
    expect(cancelCalls()[0]?.method).toBe('DELETE')
    expect(cancelCalls()[0]?.jsonBody).toContain(UPLOAD_ID)
  })

  it('每片回显片号与请求不符 ⇒ 该片的"成功"不算数,报错并撤销', async () => {
    installServer({ echoChunkNumber: (n) => (n === 3 ? 2 : n) })

    await expect(chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1 })).rejects.toThrow(
      /分片 2 响应回显片号为 2，与请求不符/,
    )
    expect(pathsOf().filter((p) => p === 'merge')).toHaveLength(0)
    expect(cancelCalls()).toHaveLength(1)
  })
})

describe('chunkUpload — 失败必撤销', () => {
  it('第 2 片失败 ⇒ DELETE cancel 带同一 uploadId 被发出,且原错误照抛', async () => {
    installServer({ failAtChunk: 2 })

    // 原错误必须原样抛出(吞掉原错误就是第二个 bug)
    await expect(chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1 })).rejects.toThrow(
      /分片 1 上传失败: 服务端拒收第 2 片/,
    )

    const [cancel] = cancelCalls()
    expect(cancel).toBeDefined()
    expect(cancel?.method).toBe('DELETE')
    expect(cancel?.url).toContain('/chunked-upload/cancel')
    expect(cancel?.jsonBody).toContain(UPLOAD_ID)
    // 撤销之后不再提交合并
    expect(pathsOf().filter((p) => p === 'merge')).toHaveLength(0)
  })

  it('第 5 片(末片)失败 ⇒ 同样撤销且原错误照抛', async () => {
    installServer({ failAtChunk: 5 })

    await expect(chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1 })).rejects.toThrow(
      /分片 4 上传失败: 服务端拒收第 5 片/,
    )
    expect(cancelCalls()).toHaveLength(1)
    expect(cancelCalls()[0]?.jsonBody).toContain(UPLOAD_ID)
    expect(pathsOf().filter((p) => p === 'merge')).toHaveLength(0)
  })

  it('正反对照:init 阶段就失败 ⇒ 尚无会话可撤,不得发 cancel', async () => {
    installServer({ initOk: false })

    await expect(chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1 })).rejects.toThrow(
      '初始化炸了',
    )
    // 只判上一条用例,实现"无条件 cancel"也能过 —— 这一例就是把它钉住的对照
    expect(cancelCalls()).toHaveLength(0)
    expect(uploadCalls()).toHaveLength(0)
  })

  it('merge 失败 ⇒ 撤销(发布没成功就不留悬空会话),原错误照抛', async () => {
    installServer({ mergeOk: false })

    await expect(chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1 })).rejects.toThrow(
      '分片未收齐:缺第 5 片',
    )
    expect(cancelCalls()).toHaveLength(1)
  })

  it('cancel 自身失败 ⇒ 只 warn,主错误仍是原错误(撤销失败不得顶替主错误)', async () => {
    installServer({ failAtChunk: 2, cancelOk: false })

    await expect(chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1 })).rejects.toThrow(
      /分片 1 上传失败: 服务端拒收第 2 片/,
    )
    expect(cancelCalls()).toHaveLength(1)
    expect(warnSpy).toHaveBeenCalled()
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('撤销上传会话未成功')
  })

  it('用户 abort ⇒ 仍发 cancel,且撤销请求不得带上已 abort 的 signal', async () => {
    const controller = installServer({ abortOnFirstUpload: (c) => c.abort() })

    await expect(
      chunkUpload(makeFile(), {
        chunkSize: CHUNK_SIZE,
        concurrent: 1,
        signal: controller.signal,
      }),
    ).rejects.toThrow('上传已取消')

    const [cancel] = cancelCalls()
    expect(cancel).toBeDefined()
    expect(cancel?.jsonBody).toContain(UPLOAD_ID)
    // 带着已 abort 的 signal 发撤销 = 请求刚出即被掐,会话仍留在服务端
    expect(cancel?.carriedSignal).toBe(false)
  })
})

describe('chunkUpload — 服务端续点', () => {
  it('status 回报已收 2 片 ⇒ 跳过 1/2 两片,只传 3/4/5,且不再 init', async () => {
    installServer({
      status: sessionView({ uploadedChunks: 2 }),
    })

    const result = await chunkUpload(makeFile(), {
      chunkSize: CHUNK_SIZE,
      concurrent: 1,
      uploadId: UPLOAD_ID,
    })

    expect(result.fileId).toBe('file-1')
    expect(calls[0]?.url).toContain('/chunked-upload/status')
    expect(calls[0]?.url).toContain('uploadId=upload-uuid-1')
    expect(calls[0]?.method).toBe('GET')
    expect(pathsOf().filter((p) => p === 'init')).toHaveLength(0)
    // 续点语义:被跳过的就是服务端已经收到的那两片,不是"从 0 重传"
    expect(sentChunkNumbers()).toEqual([3, 4, 5])
    expect(pathsOf().filter((p) => p === 'cancel')).toHaveLength(0)
  })

  it('对照:status 回报 0 片 ⇒ 一片都不跳,从第 1 片起', async () => {
    installServer({
      status: sessionView({ uploadedChunks: 0 }),
    })

    await chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1, uploadId: UPLOAD_ID })

    expect(sentChunkNumbers()).toEqual([1, 2, 3, 4, 5])
  })

  it('分片参数与会话不一致 ⇒ 当场报错,不拿另一套切法的片继续拼', async () => {
    installServer({
      status: sessionView({ chunkSize: CHUNK_SIZE * 2, uploadedChunks: 1 }),
    })

    await expect(
      chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1, uploadId: UPLOAD_ID }),
    ).rejects.toThrow(/续传参数与会话不一致/)
    expect(uploadCalls()).toHaveLength(0)
    // 这一段还没往会话里写过任何东西 ⇒ 与 init 失败同形,不发 cancel
    expect(cancelCalls()).toHaveLength(0)
  })

  it('会话已不在 uploading 态 ⇒ 报错且不覆盖别人的终态', async () => {
    installServer({
      status: sessionView({ status: 'cancelled', uploadedChunks: 3 }),
    })

    await expect(
      chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1, uploadId: UPLOAD_ID }),
    ).rejects.toThrow(/无法续传/)
    expect(cancelCalls()).toHaveLength(0)
    expect(uploadCalls()).toHaveLength(0)
  })

  it('句柄指向的会话是另一份文件(同 size 同切法)⇒ 拒绝续传,不把别人的前 N 片接过来', async () => {
    installServer({
      status: sessionView({ fileName: 'other.bin', uploadedChunks: 2 }),
    })

    await expect(
      chunkUpload(makeFile(), { chunkSize: CHUNK_SIZE, concurrent: 1, uploadId: UPLOAD_ID }),
    ).rejects.toThrow(/不是同一份/)
    expect(uploadCalls()).toHaveLength(0)
    // 同 init 失败 / 参数不一致那一型:一个字都没往会话里写 ⇒ 不发 cancel
    expect(cancelCalls()).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
