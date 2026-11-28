// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管身份胶囊（2026-11-28 按本机 TRAE 宝实机重做）。
 *
 * 实机 TRAE 宝的聊天页顶部是一枚白色胶囊：像素头像 + 名字 + 一句职责说明，
 * 不是深色工牌、不是证件卡。名字仍可内联改；改名只影响展示与自称，不改
 * master.md 的固定人格、三工具和审批纪律。
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'

interface MasterIdentityHeaderProps {
  name: string
  defaultName?: string
  maxLength?: number
  onRename: (name: string) => Promise<void>
  onReset: () => Promise<void>
}

export function MasterIdentityHeader({
  name,
  defaultName = '总管',
  maxLength = 24,
  onRename,
  onReset,
}: MasterIdentityHeaderProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(name)
  }, [editing, name])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function beginEdit() {
    setDraft(name)
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    if (saving) return
    setDraft(name)
    setError('')
    setEditing(false)
  }

  async function save() {
    const next = draft.trim()
    if (!next) {
      setError('名字不能为空')
      return
    }
    if (next === name) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onRename(next)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '改名失败')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onReset()
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复默认失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="relative flex shrink-0 flex-col items-center px-4 pt-5">
      <div className="flex min-w-[250px] items-center gap-3 rounded-full border border-[#ebe6dd] bg-white py-2.5 pl-3 pr-4 shadow-[0_2px_10px_rgba(34,28,18,0.06)]">
        <MasterPixelAvatar />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1
              className="max-w-[280px] truncate text-[19px] font-semibold leading-7 text-[#1f1d19]"
              title={name}
            >
              {name}
            </h1>
            <button
              type="button"
              aria-label="重命名"
              onClick={beginEdit}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#9a9388] transition hover:bg-[#f1eee8] hover:text-[#4e483f]"
            >
              <Pencil className="h-3 w-3" />
            </button>
            {name !== defaultName && (
              <button
                type="button"
                aria-label="恢复默认名"
                disabled={saving}
                onClick={() => void reset()}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[#9a9388] transition hover:bg-[#f1eee8] hover:text-[#4e483f] disabled:opacity-40"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-[13px] leading-5 text-[#8d867b]">跟进你的所有任务</p>
        </div>
      </div>

      {editing && (
        <div className="absolute left-1/2 top-full z-20 mt-2 w-[300px] -translate-x-1/2 rounded-xl border border-[#e7e2d8] bg-white p-3 text-left shadow-[0_16px_40px_rgba(34,28,18,0.14)]">
          <p className="mb-1.5 text-[11px] text-[#8d867b]">改一个以后都用的名字</p>
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void save()
              }
              if (event.key === 'Escape') cancelEdit()
            }}
            maxLength={maxLength}
            aria-label="总智能体名字"
            className="w-full rounded-lg border border-[#ded9cf] bg-[#fbfaf7] px-3 py-2 text-[13px] text-[#24211c] outline-none placeholder:text-[#aaa399] focus:border-[#b9b1a4]"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-lg bg-[#23211d] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
            >
              {saving ? '保存中' : '保存'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={cancelEdit}
              className="rounded-lg border border-[#ded9cf] px-3 py-1.5 text-[11px] text-[#6d665b] disabled:opacity-40"
            >
              取消
            </button>
            <span className="ml-auto text-[10px] tabular-nums text-[#b2aaa0]">
              {draft.length}/{maxLength}
            </span>
          </div>
          {error && <p className="mt-2 text-[11px] leading-4 text-red-600">{error}</p>}
        </div>
      )}
    </section>
  )
}

/** 实机 TRAE 宝的像素机器人头像：深色方块 + 两个白点眼睛 + 一条浅绿嘴线。 */
export function MasterPixelAvatar() {
  return (
    <span
      aria-hidden
      className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-[#252b39] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
    >
      <span className="absolute left-[12px] top-[13px] h-[6px] w-[6px] rounded-[1px] bg-[#f3efe4]" />
      <span className="absolute left-[26px] top-[13px] h-[6px] w-[6px] rounded-[1px] bg-[#f3efe4]" />
      <span className="absolute left-[17px] top-[26px] h-[2px] w-[11px] rounded-full bg-[#9fe3bd]" />
    </span>
  )
}
