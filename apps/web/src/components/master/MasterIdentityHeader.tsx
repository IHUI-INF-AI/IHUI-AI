// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管身份头（2026-11-28 立）。
 *
 * 产品名默认「总管」，但每个用户可以给“自己的总智能体”改名。改名只影响
 * 展示与自称；master.md 的固定人格、三工具和审批纪律不在这里改写。
 */
'use client'

import { useEffect, useRef, useState } from 'react'

interface MasterIdentityHeaderProps {
  name: string
  defaultName?: string
  maxLength?: number
  definitionCount: number
  approvalCount: number
  loading?: boolean
  creating?: boolean
  onRename: (name: string) => Promise<void>
  onReset: () => Promise<void>
  onToggleCreate: () => void
}

export function MasterIdentityHeader({
  name,
  defaultName = '总管',
  maxLength = 24,
  definitionCount,
  approvalCount,
  loading = false,
  creating = false,
  onRename,
  onReset,
  onToggleCreate,
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

  const initial = Array.from(name)[0] ?? '总'

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-slate-800/80 bg-slate-950 px-5 py-5 text-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.8)] sm:px-7 sm:py-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/30 bg-gradient-to-br from-emerald-400 to-teal-600 text-2xl font-semibold text-slate-950 shadow-lg shadow-emerald-950/40">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-emerald-300/80">
                Your master agent
              </p>
              {editing ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
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
                    className="w-52 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-2xl font-semibold text-white outline-none placeholder:text-white/40 focus:border-emerald-300"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void save()}
                    className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
                  >
                    {saving ? '保存中' : '保存'}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={cancelEdit}
                    className="rounded-xl border border-white/20 px-3 py-2 text-xs text-white/80 disabled:opacity-50"
                  >
                    取消
                  </button>
                  {name !== defaultName && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void reset()}
                      className="text-xs text-white/50 underline-offset-4 hover:text-white hover:underline disabled:opacity-50"
                    >
                      恢复默认「{defaultName}」
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">
                    {name}
                  </h1>
                  <button
                    type="button"
                    onClick={beginEdit}
                    className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white"
                  >
                    重命名
                  </button>
                </div>
              )}
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                你的智能体总控。能注册、派发、暂停、续跑、记事；删除与回滚必须走审批。
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            在线
          </span>
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <MetaChip label="注册表" value={loading ? '…' : String(definitionCount)} />
          <MetaChip label="待审批" value={loading ? '…' : String(approvalCount)} />
          <MetaChip label="工具面" value="三件套固定" />
          <MetaChip label="控制面" value="single run" />
          <div className="flex-1" />
          <button
            type="button"
            onClick={onToggleCreate}
            className="rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-200"
          >
            {creating ? '收起新建' : '新建定义'}
          </button>
        </div>
      </div>
    </section>
  )
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px]">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </span>
  )
}
