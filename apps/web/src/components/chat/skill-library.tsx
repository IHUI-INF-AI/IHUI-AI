'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Bot,
  Code,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  type ChatSkill,
  type ChatSkillCategory,
  type ChatSkillInput,
  type ChatSkillScenario,
  createChatSkill,
  deleteChatSkill,
  listChatSkills,
  updateChatSkill,
} from '@ihui/api-client/endpoints/chat-skills'
import {
  type AiSkillMeta,
  type AiSkillInvokeResponse,
  invokeAiSkill,
  listAiSkills,
} from '@ihui/api-client/endpoints/ai-skills'
import { useAuthStore } from '@/stores/auth'

/**
 * Skill 库弹窗 — 2026-07-21 新增
 *
 * 定位:AI 对话框输入区域的 Skill 入口弹窗,集中展示本项目所有可调用技能:
 *  - 内置模板(总结/翻译/解释/代码/润色) — template 类
 *  - 内置斜杠命令(/wechat-article /koubo-script) — slash 类
 *  - 自媒体技能(公众号文章 / 口播稿) — self-media 类
 *  - 用户自定义技能 — custom 类
 *
 * 交互:
 *  - 顶部 Tab 按 category 切换(混合两套 tab:内置分组 + 自定义分组)
 *  - 搜索框过滤技能名/描述
 *  - 点击技能 → 调用 onSelect(template) 填充到 textarea
 *  - 自定义技能支持新增/编辑/删除/启用
 */

export type BuiltinSkillSource = 'template' | 'slash' | 'self-media'

export interface BuiltinSkill {
  id: string
  name: string
  desc: string
  category: ChatSkillCategory
  icon: React.ComponentType<{ className?: string }>
  template: string
  source: BuiltinSkillSource
}

export interface SkillLibraryProps {
  onSelect: (template: string) => void
  onClose: () => void
}

type TabKey = 'all' | 'template' | 'slash' | 'self-media' | 'ai-skills' | 'custom'

interface TabDef {
  key: TabKey
  labelKey: string
}

const TABS: TabDef[] = [
  { key: 'all', labelKey: 'tabAll' },
  { key: 'template', labelKey: 'tabTemplate' },
  { key: 'slash', labelKey: 'tabSlash' },
  { key: 'self-media', labelKey: 'tabSelfMedia' },
  { key: 'ai-skills', labelKey: 'tabAiSkills' },
  { key: 'custom', labelKey: 'tabCustom' },
]

const CATEGORY_ICON: Record<ChatSkillCategory, React.ComponentType<{ className?: string }>> = {
  template: FileText,
  slash: Wand2,
  'self-media': Newspaper,
  openclaw: Bot,
  mcp: Globe,
  custom: Sparkles,
}

const SCENARIO_LABEL_KEY: Record<ChatSkillScenario, string> = {
  writing: 'scenarioWriting',
  coding: 'scenarioCoding',
  media: 'scenarioMedia',
  tool: 'scenarioTool',
  custom: 'scenarioCustom',
}

export function SkillLibrary({ onSelect, onClose }: SkillLibraryProps) {
  const t = useTranslations('chat.skillLibrary')
  const [activeTab, setActiveTab] = React.useState<TabKey>('all')
  const [keyword, setKeyword] = React.useState('')
  const [customSkills, setCustomSkills] = React.useState<ChatSkill[]>([])
  const [loading, setLoading] = React.useState(false)
  const [editing, setEditing] = React.useState<ChatSkill | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // 2026-07-23 新增:AI Skills TOP 19 个 skill 状态
  const [aiSkills, setAiSkills] = React.useState<AiSkillMeta[]>([])
  const [aiSkillsLoading, setAiSkillsLoading] = React.useState(false)
  const [invokingSkill, setInvokingSkill] = React.useState<AiSkillMeta | null>(null)
  const [invokeResult, setInvokeResult] = React.useState<AiSkillInvokeResponse | null>(null)
  const [invokeError, setInvokeError] = React.useState<string | null>(null)

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  /** 把后端 category 映射为 i18n 标签(next-intl 不支持动态 key,这里手写映射) */
  const categoryLabel = React.useCallback(
    (category: ChatSkillCategory): string => {
      switch (category) {
        case 'template':
          return t('tabTemplate')
        case 'slash':
          return t('tabSlash')
        case 'self-media':
          return t('tabSelfMedia')
        case 'openclaw':
          return t('tabOpenclaw')
        case 'mcp':
          return t('tabMcp')
        case 'custom':
        default:
          return t('tabCustom')
      }
    },
    [t],
  )

  // 拉取用户自定义技能(只在登录态 + custom tab 激活或 all tab 激活时拉取)
  const loadCustom = React.useCallback(async () => {
    if (!isAuthenticated) {
      setCustomSkills([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await listChatSkills()
      if (res.success && res.data) {
        setCustomSkills(res.data.skills)
      } else {
        setError(t('errorLoad'))
      }
    } catch {
      setError(t('errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, t])

  React.useEffect(() => {
    if (activeTab === 'custom' || activeTab === 'all') {
      void loadCustom()
    }
  }, [activeTab, loadCustom])

  // 2026-07-23 新增:AI Skills TOP 19 个 skill 列表拉取(切到 ai-skills tab 或 all tab 时触发)
  const loadAiSkills = React.useCallback(async () => {
    setAiSkillsLoading(true)
    setError(null)
    try {
      const res = await listAiSkills()
      // 后端 ai-skills.py 直接返回 list(SkillMeta),fetchApi 包装成 ApiResult
      if (res.success && res.data) {
        setAiSkills(res.data)
      } else {
        setError(t('errorLoad'))
      }
    } catch {
      setError(t('errorLoad'))
    } finally {
      setAiSkillsLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    if (activeTab === 'ai-skills' || activeTab === 'all') {
      if (aiSkills.length === 0) {
        void loadAiSkills()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const builtinSkills = React.useMemo<BuiltinSkill[]>(() => {
    return [
      {
        id: 'tpl-summary',
        name: t('builtin.tplSummary'),
        desc: t('builtin.tplSummaryDesc'),
        category: 'template',
        icon: FileText,
        template: t('builtin.tplSummaryTemplate'),
        source: 'template',
      },
      {
        id: 'tpl-translate',
        name: t('builtin.tplTranslate'),
        desc: t('builtin.tplTranslateDesc'),
        category: 'template',
        icon: FileText,
        template: t('builtin.tplTranslateTemplate'),
        source: 'template',
      },
      {
        id: 'tpl-explain',
        name: t('builtin.tplExplain'),
        desc: t('builtin.tplExplainDesc'),
        category: 'template',
        icon: FileText,
        template: t('builtin.tplExplainTemplate'),
        source: 'template',
      },
      {
        id: 'tpl-code',
        name: t('builtin.tplCode'),
        desc: t('builtin.tplCodeDesc'),
        category: 'template',
        icon: Code,
        template: t('builtin.tplCodeTemplate'),
        source: 'template',
      },
      {
        id: 'tpl-polish',
        name: t('builtin.tplPolish'),
        desc: t('builtin.tplPolishDesc'),
        category: 'template',
        icon: FileText,
        template: t('builtin.tplPolishTemplate'),
        source: 'template',
      },
      {
        id: 'slash-wechat-article',
        name: t('builtin.wechatArticle'),
        desc: t('builtin.wechatArticleDesc'),
        category: 'slash',
        icon: Wand2,
        template: t('builtin.wechatArticleTemplate'),
        source: 'slash',
      },
      {
        id: 'slash-koubo-script',
        name: t('builtin.kouboScript'),
        desc: t('builtin.kouboScriptDesc'),
        category: 'slash',
        icon: Wand2,
        template: t('builtin.kouboScriptTemplate'),
        source: 'slash',
      },
      {
        id: 'self-media-wechat-article',
        name: t('builtin.wechatArticle'),
        desc: t('builtin.wechatArticleDesc'),
        category: 'self-media',
        icon: Newspaper,
        template: t('builtin.wechatArticleTemplate'),
        source: 'self-media',
      },
      {
        id: 'self-media-koubo-script',
        name: t('builtin.kouboScript'),
        desc: t('builtin.kouboScriptDesc'),
        category: 'self-media',
        icon: Newspaper,
        template: t('builtin.kouboScriptTemplate'),
        source: 'self-media',
      },
    ]
  }, [t])

  const filteredBuiltin = React.useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return builtinSkills.filter((s) => {
      const tabOk = activeTab === 'all' || s.category === activeTab
      if (!tabOk) return false
      if (!k) return true
      return s.name.toLowerCase().includes(k) || s.desc.toLowerCase().includes(k)
    })
  }, [builtinSkills, activeTab, keyword])

  const filteredCustom = React.useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return customSkills
      .filter(() => activeTab === 'custom' || activeTab === 'all')
      .filter((s) => {
        if (!k) return true
        return s.name.toLowerCase().includes(k) || (s.prompt?.toLowerCase().includes(k) ?? false)
      })
  }, [customSkills, activeTab, keyword])

  const handlePickBuiltin = (skill: BuiltinSkill) => {
    onSelect(skill.template)
    onClose()
  }

  const handlePickCustom = (skill: ChatSkill) => {
    if (!skill.enabled) return
    onSelect(skill.prompt)
    onClose()
  }

  const handleCreate = async (input: ChatSkillInput) => {
    const res = await createChatSkill(input)
    if (res.success && res.data) {
      setCustomSkills((prev) => [res.data.skill, ...prev])
      setCreating(false)
    } else {
      setError(t('errorSave'))
    }
  }

  const handleUpdate = async (id: string, patch: Partial<ChatSkillInput>) => {
    const res = await updateChatSkill(id, patch)
    if (res.success && res.data) {
      setCustomSkills((prev) => prev.map((s) => (s.id === id ? res.data.skill : s)))
      setEditing(null)
    } else {
      setError(t('errorSave'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('confirmDelete'))) return
    const res = await deleteChatSkill(id)
    if (res.success) {
      setCustomSkills((prev) => prev.filter((s) => s.id !== id))
    } else {
      setError(t('errorDelete'))
    }
  }

  return (
    <div className="flex w-[400px] flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">{t('title')}</span>
          <Link
            href="/ai-skills"
            className="ml-0.5 inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {t('viewAll')}
            <span aria-hidden>→</span>
          </Link>
        </div>
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setCreating(true)
            }}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Plus className="h-3 w-3" />
            <span>{t('create')}</span>
          </button>
        )}
      </div>

      {/* Tab 栏 */}
      <div className="flex items-center gap-0.5 overflow-x-auto rounded-md bg-muted/50 p-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'shrink-0 rounded-sm px-2 py-1 text-[11px] transition-colors',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="w-full rounded-md border border-border bg-background py-1 pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-foreground/20"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          {error}
        </div>
      )}

      {/* 列表区 */}
      <div className="thin-scroll max-h-[320px] space-y-0.5 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center gap-1.5 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{t('loading')}</span>
          </div>
        )}

        {/* 自定义技能区(activeTab = custom 或 all) */}
        {(activeTab === 'custom' || activeTab === 'all') && !loading && (
          <>
            {activeTab === 'all' && filteredCustom.length > 0 && (
              <div className="px-1.5 pt-1.5 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {t('sectionCustom')}
              </div>
            )}
            {!isAuthenticated && activeTab === 'custom' && (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                {t('loginRequired')}
              </div>
            )}
            {isAuthenticated && filteredCustom.length === 0 && activeTab === 'custom' && (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                {t('emptyCustom')}
              </div>
            )}
            {filteredCustom.map((skill) => (
              <CustomSkillItem
                key={skill.id}
                skill={skill}
                onPick={() => handlePickCustom(skill)}
                onEdit={() => {
                  setCreating(false)
                  setEditing(skill)
                }}
                onDelete={() => handleDelete(skill.id)}
                onToggleEnabled={(enabled) => handleUpdate(skill.id, { enabled })}
                scenarioLabel={t(SCENARIO_LABEL_KEY[skill.scenario] as 'scenarioWriting')}
              />
            ))}
          </>
        )}

        {/* 内置技能区 */}
        {activeTab !== 'custom' && activeTab !== 'ai-skills' && !loading && (
          <>
            {activeTab === 'all' && filteredBuiltin.length > 0 && (
              <div className="px-1.5 pt-1.5 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {t('sectionBuiltin')}
              </div>
            )}
            {filteredBuiltin.length === 0 && (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                {t('empty')}
              </div>
            )}
            {filteredBuiltin.map((skill) => {
              const Icon = skill.icon
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => handlePickBuiltin(skill)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{skill.name}</span>
                      <span className="rounded-sm bg-muted px-1 text-[9px] text-muted-foreground">
                        {categoryLabel(skill.category)}
                      </span>
                    </div>
                    <div className="line-clamp-2 text-[11px] text-muted-foreground">
                      {skill.desc}
                    </div>
                  </div>
                </button>
              )
            })}
          </>
        )}

        {/* 2026-07-23 新增:AI Skills TOP 19 项列表区(ai-skills tab 或 all tab) */}
        {(activeTab === 'ai-skills' || activeTab === 'all') && (
          <>
            {activeTab === 'all' && aiSkills.length > 0 && (
              <div className="px-1.5 pt-1.5 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {t('sectionAiSkills')}
              </div>
            )}
            {aiSkillsLoading && (
              <div className="flex items-center justify-center gap-1.5 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t('loading')}</span>
              </div>
            )}
            {!aiSkillsLoading && aiSkills.length === 0 && (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                {t('empty')}
              </div>
            )}
            {aiSkills
              .filter((s) => {
                const k = keyword.trim().toLowerCase()
                if (!k) return true
                return (
                  s.name.toLowerCase().includes(k) ||
                  s.description.toLowerCase().includes(k) ||
                  s.tags.some((tag) => tag.toLowerCase().includes(k))
                )
              })
              .map((skill) => (
                <AiSkillItem
                  key={skill.id}
                  skill={skill}
                  onPick={() => setInvokingSkill(skill)}
                />
              ))}
          </>
        )}
      </div>

      {/* 编辑/创建面板 */}
      {(editing || creating) && (
        <SkillEditDialog
          skill={editing}
          onCancel={() => {
            setEditing(null)
            setCreating(false)
          }}
          onSave={async (input) => {
            if (editing) {
              await handleUpdate(editing.id, input)
            } else {
              await handleCreate(input)
            }
          }}
        />
      )}

      {/* 2026-07-23 新增:AI Skill 调用面板(已上线 skill 输入参数,占位 skill 显示引导) */}
      {invokingSkill && (
        <AiSkillInvokeDialog
          skill={invokingSkill}
          error={invokeError}
          onCancel={() => {
            setInvokingSkill(null)
            setInvokeResult(null)
            setInvokeError(null)
          }}
          onSuccess={(result) => {
            setInvokeResult(result)
            setInvokeError(null)
          }}
          onError={(err) => {
            setInvokeError(err)
            setInvokeResult(null)
          }}
        />
      )}

      {/* 2026-07-23 新增:AI Skill 调用结果显示 */}
      {invokeResult && (
        <AiSkillResultDialog
          result={invokeResult}
          onClose={() => {
            setInvokeResult(null)
            setInvokingSkill(null)
          }}
          onFillInput={(text) => {
            onSelect(text)
            onClose()
          }}
        />
      )}
    </div>
  )
}

interface CustomSkillItemProps {
  skill: ChatSkill
  onPick: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleEnabled: (enabled: boolean) => void
  scenarioLabel: string
}

function CustomSkillItem({
  skill,
  onPick,
  onEdit,
  onDelete,
  onToggleEnabled,
  scenarioLabel,
}: CustomSkillItemProps) {
  const t = useTranslations('chat.skillLibrary')
  const Icon = CATEGORY_ICON[skill.category] ?? Sparkles
  return (
    <div
      className={cn(
        'group flex w-full items-start gap-2 rounded-md px-2 py-2 transition-colors',
        skill.enabled ? 'hover:bg-accent' : 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={onPick}
        disabled={!skill.enabled}
        className="flex flex-1 items-start gap-2 text-left disabled:cursor-not-allowed"
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium">{skill.name}</span>
            <span className="rounded-sm bg-muted px-1 text-[9px] text-muted-foreground">
              {scenarioLabel}
            </span>
            {!skill.enabled && (
              <span className="rounded-sm bg-muted px-1 text-[9px] text-muted-foreground">
                {t('disabled')}
              </span>
            )}
          </div>
          <div className="line-clamp-2 text-[11px] text-muted-foreground">
            {skill.prompt || t('noContent')}
          </div>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => onToggleEnabled(!skill.enabled)}
          aria-label={skill.enabled ? t('disable') : t('enable')}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {skill.enabled ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('edit')}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('delete')}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

interface SkillEditDialogProps {
  skill: ChatSkill | null
  onCancel: () => void
  onSave: (input: ChatSkillInput) => Promise<void>
}

function SkillEditDialog({ skill, onCancel, onSave }: SkillEditDialogProps) {
  const t = useTranslations('chat.skillLibrary')
  const [name, setName] = React.useState(skill?.name ?? '')
  const [category, setCategory] = React.useState<ChatSkillCategory>(skill?.category ?? 'custom')
  const [scenario, setScenario] = React.useState<ChatSkillScenario>(skill?.scenario ?? 'custom')
  const [prompt, setPrompt] = React.useState(skill?.prompt ?? '')
  const [saving, setSaving] = React.useState(false)

  const handleSave = async () => {
    if (!name.trim() || !prompt.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        category,
        scenario,
        prompt: prompt.trim(),
        enabled: skill?.enabled ?? true,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">
          {skill ? t('editTitle') : t('createTitle')}
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('cancel')}
          className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 128))}
        placeholder={t('namePlaceholder')}
        aria-label={t('namePlaceholder')}
        maxLength={128}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/20"
      />
      <div className="flex gap-1">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ChatSkillCategory)}
          aria-label={t('category')}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
        >
          <option value="custom">{t('tabCustom')}</option>
          <option value="template">{t('tabTemplate')}</option>
          <option value="slash">{t('tabSlash')}</option>
          <option value="self-media">{t('tabSelfMedia')}</option>
          <option value="openclaw">OpenClaw</option>
          <option value="mcp">MCP</option>
        </select>
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value as ChatSkillScenario)}
          aria-label={t('scenario')}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
        >
          <option value="custom">{t('scenarioCustom')}</option>
          <option value="writing">{t('scenarioWriting')}</option>
          <option value="coding">{t('scenarioCoding')}</option>
          <option value="media">{t('scenarioMedia')}</option>
          <option value="tool">{t('scenarioTool')}</option>
        </select>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value.slice(0, 10000))}
        placeholder={t('promptPlaceholder')}
        aria-label={t('promptPlaceholder')}
        maxLength={10000}
        rows={4}
        className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs leading-snug outline-none focus:border-foreground/20"
      />
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim() || !prompt.trim()}
          className={cn(
            'rounded-md px-2 py-1 text-[11px] transition-colors',
            saving || !name.trim() || !prompt.trim()
              ? 'cursor-not-allowed bg-muted text-muted-foreground/50'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  )
}

// ===== 2026-07-23 新增:AI Skills TOP 19 个列表项 + 调用流程 =====

interface AiSkillItemProps {
  skill: AiSkillMeta
  onPick: () => void
}

function AiSkillItem({ skill, onPick }: AiSkillItemProps) {
  const t = useTranslations('chat.skillLibrary')
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-[10px] font-bold text-primary">
        AI
      </div>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{skill.name}</span>
          <span
            className={cn(
              'rounded-sm px-1 text-[9px]',
              skill.available
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {skill.available ? t('statusAvailable') : t('statusComingSoon')}
          </span>
        </div>
        <div className="line-clamp-2 text-[11px] text-muted-foreground">
          {skill.description}
        </div>
        {skill.tags.length > 0 && (
          <div className="line-clamp-1 text-[10px] text-muted-foreground/70">
            {skill.tags.slice(0, 3).join(' · ')}
          </div>
        )}
      </div>
    </button>
  )
}

interface AiSkillInvokeDialogProps {
  skill: AiSkillMeta
  error: string | null
  onCancel: () => void
  onSuccess: (result: AiSkillInvokeResponse) => void
  onError: (err: string) => void
}

/** AI Skill 输入参数对话框。
 *  - 真集成 skill: 根据 skill.promptTemplate 解析 {key} 变量,动态渲染对应输入框
 *  - 占位 skill: 显示 skill 介绍 + GitHub 链接 + 关闭按钮
 */
function AiSkillInvokeDialog({
  skill,
  error,
  onCancel,
  onSuccess,
  onError,
}: AiSkillInvokeDialogProps) {
  const t = useTranslations('chat.skillLibrary')
  const [running, setRunning] = React.useState(false)
  const [topic, setTopic] = React.useState('')
  const [content, setContent] = React.useState('')
  const [style, setStyle] = React.useState('')
  const [requirements, setRequirements] = React.useState('')

  // 占位 skill:显示引导 + GitHub 链接
  if (!skill.available) {
    return (
      <div className="space-y-2 rounded-md border border-border bg-card p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-foreground">{skill.name}</span>
            <span className="rounded-sm bg-muted px-1 text-[9px] text-muted-foreground">
              {t('statusComingSoon')}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('invokeClose')}
            className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="text-[11px] text-muted-foreground">{skill.description}</div>
        <div className="rounded-sm bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
          {t('comingSoonHint')}
        </div>
        {skill.sourceUrl && (
          <a
            href={skill.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ExternalLink className="h-3 w-3" />
            {t('openGitHub')}
          </a>
        )}
      </div>
    )
  }

  // 真集成 skill:动态渲染参数输入
  const handleSubmit = async () => {
    if (running) return
    setRunning(true)
    try {
      // 根据 skill id 收集对应变量
      let variables: Record<string, unknown> = {}
      if (skill.id === 'nuwa-skill') {
        if (!content.trim() || !style.trim()) {
          onError(t('invokeMissingVariable'))
          setRunning(false)
          return
        }
        variables = { style, content }
      } else if (skill.id === 'hugshu-design') {
        if (!requirements.trim()) {
          onError(t('invokeMissingVariable'))
          setRunning(false)
          return
        }
        variables = { requirements }
      } else if (
        skill.id === 'guizang-ppt-skill' ||
        skill.id === 'auto-redbook-skills'
      ) {
        if (!topic.trim()) {
          onError(t('invokeMissingVariable'))
          setRunning(false)
          return
        }
        variables = { topic }
      }
      const res = await invokeAiSkill(skill.id, { variables })
      if (res.success && res.data) {
        if (res.data.ok) {
          onSuccess(res.data)
        } else {
          onError(res.data.error || res.data.guidance || t('invokeError'))
        }
      } else {
        onError(t('invokeError'))
      }
    } catch {
      onError(t('invokeError'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-foreground">{skill.name}</span>
          <span className="rounded-sm bg-emerald-500/10 px-1 text-[9px] text-emerald-600 dark:text-emerald-400">
            {t('statusAvailable')}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('invokeClose')}
          className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="text-[11px] text-muted-foreground">{skill.description}</div>
      {/* 按 skill id 渲染对应输入字段 */}
      {skill.id === 'nuwa-skill' && (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 4000))}
            placeholder={t('invokePlaceholderContent')}
            aria-label={t('invokeInputContent')}
            maxLength={4000}
            rows={3}
            className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs leading-snug outline-none focus:border-foreground/20"
          />
          <input
            type="text"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder={t('invokePlaceholderStyle')}
            aria-label={t('invokeInputStyle')}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/20"
          />
          <div className="text-[10px] text-muted-foreground/70">
            {t('invokeInputStyle')}: {t('invokeStyleDefault')}
          </div>
        </>
      )}
      {skill.id === 'hugshu-design' && (
        <textarea
          value={requirements}
          onChange={(e) => setRequirements(e.target.value.slice(0, 1000))}
          placeholder={t('invokePlaceholderRequirements')}
          aria-label={t('invokeInputRequirements')}
          maxLength={1000}
          rows={3}
          className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs leading-snug outline-none focus:border-foreground/20"
        />
      )}
      {(skill.id === 'guizang-ppt-skill' || skill.id === 'auto-redbook-skills') && (
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value.slice(0, 500))}
          placeholder={t('invokePlaceholderTopic')}
          aria-label={t('invokeInputTopic')}
          maxLength={500}
          rows={2}
          className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs leading-snug outline-none focus:border-foreground/20"
        />
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {t('invokeBackToList')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={running}
          className={cn(
            'rounded-md px-2 py-1 text-[11px] transition-colors',
            running
              ? 'cursor-not-allowed bg-muted text-muted-foreground/50'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {running ? t('invokeRunning') : t('invokeButton')}
        </button>
      </div>
    </div>
  )
}

interface AiSkillResultDialogProps {
  result: AiSkillInvokeResponse
  onClose: () => void
  onFillInput: (text: string) => void
}

/** AI Skill 调用结果展示(支持 text/html/json 三种 contentType) */
function AiSkillResultDialog({ result, onClose, onFillInput }: AiSkillResultDialogProps) {
  const t = useTranslations('chat.skillLibrary')
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-foreground">
            {t('invokeResult')} · {result.skillId}
          </span>
          {result.model && (
            <span className="rounded-sm bg-muted px-1 text-[9px] text-muted-foreground">
              {result.model}
            </span>
          )}
          <span className="rounded-sm bg-muted px-1 text-[9px] text-muted-foreground">
            {result.duration_ms}ms
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('invokeClose')}
          className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {result.contentType === 'html' ? (
        <iframe
          srcDoc={result.content}
          title={result.skillId}
          sandbox=""
          className="thin-scroll h-[180px] w-full rounded-md border border-border bg-background"
        />
      ) : result.contentType === 'json' ? (
        <pre className="thin-scroll max-h-[180px] overflow-auto rounded-md bg-muted/50 p-2 text-[10px] leading-snug">
          {(() => {
            try {
              return JSON.stringify(JSON.parse(result.content), null, 2)
            } catch {
              return result.content
            }
          })()}
        </pre>
      ) : (
        <div className="thin-scroll max-h-[180px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-[11px] leading-snug">
          {result.content}
        </div>
      )}
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {t('invokeBackToList')}
        </button>
        <button
          type="button"
          onClick={() => onFillInput(result.content)}
          className="rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('invokeFillInput')}
        </button>
      </div>
    </div>
  )
}

export default SkillLibrary
