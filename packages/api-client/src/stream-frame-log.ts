// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// D116 原始 SSE 全帧采集器(G-230,开发者 transcript):
// streamChat 主循环每行原文进环形缓冲,默认关闭(关闭时记录函数一次布尔判断即返回,
// 零字符串拷贝)。展示端 apps/web stream-inspector 挂工具托盘 inspector tab。
// 与 D40③(subagent 会话内容 transcript)边界:本模块是主流原始帧(开发者视角),
// 数据面唯一,不做第二套 SSE 解析 —— 只记录原始行文本,解析交给展示层。

export interface RawStreamFrame {
  /** 单调递增序号(跨流共享,重连不清零,用于 seq 幂等/排序) */
  seq: number
  /** 帧类型:data JSON 的 type 字段;id: 行记 'id';其余 'raw' */
  kind: string
  /** 相对采集开始的毫秒数 */
  atMs: number
  /** 原始行字节数(UTF-8 估算:JS 字符串 length 的近似值仅供排序展示) */
  bytes: number
  /** 原始行文本(event:/data:/id: 前缀保留) */
  raw: string
}

const CAP = 2000

let frames: RawStreamFrame[] = []
let captureOn = false
let seqCounter = 0
let startedAt = 0

/** 开/关采集(开时重置时间基准;不清空已录帧) */
export function setStreamFrameCapture(on: boolean): void {
  captureOn = on
  if (on && startedAt === 0) startedAt = Date.now()
}

export function isStreamFrameCaptureOn(): boolean {
  return captureOn
}

/** 提取帧类型:data JSON 的 type 字段,id: 行,其余 raw(解析失败按 raw) */
function kindOf(line: string): string {
  if (line.startsWith('id:')) return 'id'
  let data = line
  if (line.startsWith('data:')) data = line.slice(5).replace(/^\s/, '')
  else if (line.startsWith('event:') || line.startsWith('retry:')) return line.slice(0, 5)
  if (!data || data === '[DONE]') return 'raw'
  try {
    const json: unknown = JSON.parse(data)
    if (json && typeof json === 'object' && 'type' in json) {
      const t = (json as { type?: unknown }).type
      if (typeof t === 'string' && t) return t
    }
  } catch {
    /* 非 JSON 行按 raw */
  }
  return 'raw'
}

/** 主循环逐行调用;关闭时零开销返回 */
export function recordStreamFrame(line: string): void {
  if (!captureOn) return
  if (!line) return
  seqCounter += 1
  frames.push({
    seq: seqCounter,
    kind: kindOf(line),
    atMs: Date.now() - (startedAt || Date.now()),
    bytes: line.length,
    raw: line,
  })
  if (frames.length > CAP) frames.splice(0, frames.length - CAP)
}

/** 读取快照(只读,最多 CAP 帧) */
export function getStreamFrames(): readonly RawStreamFrame[] {
  return frames
}

export function countStreamFrames(): number {
  return frames.length
}

export function clearStreamFrames(): void {
  frames = []
}

/** 导出 JSONL(每行一帧的 JSON) */
export function exportStreamFramesJsonl(): string {
  return frames
    .map((f) =>
      JSON.stringify({ seq: f.seq, kind: f.kind, atMs: f.atMs, bytes: f.bytes, raw: f.raw }),
    )
    .join('\n')
}
