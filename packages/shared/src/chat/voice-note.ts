// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​⁠

/**
 * D43 会话内快捷笔记 — 语音笔记共享层(纯函数,端中立)。
 *
 * 12 相判别联合状态机 + 归档桶 CRUD + 时长格式化;phase 收敛全部经
 * `transitionVoiceNotePhase`(非法迁移一律 no-op),端内不得散写 phase 判断。
 * 消费契约以 apps/web/src/components/chat/voice-note.tsx 与其测试为准
 * (start→…→recording→stop→saved→waitingTranscript→transcriptReady→completed)。
 */

/** 12 相:录音生命周期 + 转写等待 + 五个终态 */
export type VoiceNotePhase =
  | 'ready'
  | 'requestingPermission'
  | 'preparingMedia'
  | 'connecting'
  | 'recording'
  | 'stopping'
  | 'waitingTranscript'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'error'
  | 'interrupted'

/** 状态机事件(组件 dispatch 的全部合法事件名) */
export type VoiceNoteEvent =
  | 'start'
  | 'permissionGranted'
  | 'permissionDenied'
  | 'mediaReady'
  | 'connected'
  | 'stop'
  | 'saved'
  | 'transcriptReady'
  | 'transcriptFailed'
  | 'interrupt'
  | 'cancel'
  | 'retry'
  | 'dismiss'

/** 归档记录(localStorage 单桶持久化的最小形态) */
export interface VoiceNoteRecord {
  id: string
  /** 所属会话;无会话上下文为 null */
  conversationId: string | null
  /** ISO 时间戳 */
  createdAt: string
  durationMs: number
  /** 转写文本;仅存音频 / 转写失败为 null */
  transcript: string | null
  phase: VoiceNotePhase
}

/** 归档桶上限(超出淘汰最旧;配额满时组件侧静默降级内存态) */
export const VOICE_NOTE_ARCHIVE_LIMIT = 50

const ALL_PHASES: readonly VoiceNotePhase[] = [
  'ready',
  'requestingPermission',
  'preparingMedia',
  'connecting',
  'recording',
  'stopping',
  'waitingTranscript',
  'completed',
  'cancelled',
  'failed',
  'error',
  'interrupted',
]

const TERMINAL_PHASES: readonly VoiceNotePhase[] = [
  'completed',
  'cancelled',
  'failed',
  'error',
  'interrupted',
]

/** 终态判定:终态吸收一切事件(no-op),组件据此收起进行时 UI */
export function isVoiceNotePhaseTerminal(phase: VoiceNotePhase): boolean {
  return TERMINAL_PHASES.includes(phase)
}

/** 转写是否仍在等待(唯一 pending 相;降级/显式存盘都从此相出) */
export function isVoiceNoteTranscriptPending(phase: VoiceNotePhase): boolean {
  return phase === 'waitingTranscript'
}

/**
 * 12 相状态机唯一收敛点:非法迁移一律 no-op(绝不抛错、绝不跳相)。
 * 迁移表只登记合法 (phase, event) → next;终态仅对 retry 放行(可恢复失败相回 ready)。
 */
const TRANSITIONS: Readonly<Record<VoiceNotePhase, Partial<Record<VoiceNoteEvent, VoiceNotePhase>>>> = {
  ready: { start: 'requestingPermission' },
  requestingPermission: {
    permissionGranted: 'preparingMedia',
    permissionDenied: 'failed',
    interrupt: 'interrupted',
  },
  preparingMedia: {
    mediaReady: 'connecting',
    permissionDenied: 'failed',
    interrupt: 'interrupted',
  },
  connecting: {
    connected: 'recording',
    permissionDenied: 'failed',
    interrupt: 'interrupted',
  },
  recording: {
    stop: 'stopping',
    cancel: 'cancelled',
    interrupt: 'interrupted',
  },
  stopping: {
    saved: 'waitingTranscript',
    transcriptFailed: 'error',
    interrupt: 'interrupted',
  },
  waitingTranscript: {
    transcriptReady: 'completed',
    transcriptFailed: 'error',
    dismiss: 'completed',
    interrupt: 'interrupted',
  },
  completed: { retry: 'ready' },
  cancelled: { retry: 'ready' },
  failed: { retry: 'ready' },
  error: { retry: 'ready' },
  interrupted: { retry: 'ready' },
}

/** 唯一状态收敛入口:非法组合原样返回当前相(调用方 setState 无感) */
export function transitionVoiceNotePhase(phase: VoiceNotePhase, event: VoiceNoteEvent): VoiceNotePhase {
  return TRANSITIONS[phase]?.[event] ?? phase
}

/** 归档桶读取:损坏 JSON / 非数组 / 条目形状不合法一律兜空,绝不抛错 */
export function parseVoiceNotes(raw: string | null): VoiceNoteRecord[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const notes: VoiceNoteRecord[] = []
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue
      const candidate = item as Partial<VoiceNoteRecord>
      if (typeof candidate.id !== 'string' || candidate.id.length === 0) continue
      if (typeof candidate.createdAt !== 'string') continue
      if (typeof candidate.durationMs !== 'number' || !Number.isFinite(candidate.durationMs)) continue
      if (
        typeof candidate.phase !== 'string' ||
        !ALL_PHASES.includes(candidate.phase as VoiceNotePhase)
      ) {
        continue
      }
      notes.push({
        id: candidate.id,
        conversationId: typeof candidate.conversationId === 'string' ? candidate.conversationId : null,
        createdAt: candidate.createdAt,
        durationMs: candidate.durationMs,
        transcript: typeof candidate.transcript === 'string' ? candidate.transcript : null,
        phase: candidate.phase as VoiceNotePhase,
      })
    }
    return notes.slice(0, VOICE_NOTE_ARCHIVE_LIMIT)
  } catch {
    return []
  }
}

/** 归档 upsert:同 id 原位替换;新记录追加在尾部(展示层自行倒序取最新);超限淘汰最旧 */
export function upsertVoiceNote(notes: VoiceNoteRecord[], record: VoiceNoteRecord): VoiceNoteRecord[] {
  const index = notes.findIndex((note) => note.id === record.id)
  const next =
    index >= 0
      ? notes.map((note) => (note.id === record.id ? record : note))
      : [...notes, record]
  return next.slice(Math.max(0, next.length - VOICE_NOTE_ARCHIVE_LIMIT))
}

/** 归档删除:按 id 移除;id 不存在原样返回同一引用(避免无谓重渲染) */
export function removeVoiceNote(notes: VoiceNoteRecord[], id: string): VoiceNoteRecord[] {
  const index = notes.findIndex((note) => note.id === id)
  if (index < 0) return notes
  return notes.filter((note) => note.id !== id)
}

/** 是否有可「插入对话」的文本(空串/纯空白/仅存音频都算无) */
export function voiceNoteHasInsertableText(note: VoiceNoteRecord): boolean {
  return typeof note.transcript === 'string' && note.transcript.trim().length > 0
}

/** 时长格式化:<1h 为 m:ss,≥1h 为 h:mm:ss(徽章 font-mono tabular-nums 消费) */
export function formatVoiceNoteDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
