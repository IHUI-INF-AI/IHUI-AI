// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 工作台左侧会话栏(2026-10-28;一档:搜索+日期分组;二档:行操作菜单+拖入分屏)。
 *
 * - 只画"薄行",但行操作(重命名/收藏/置顶/归档/删除)与 history 页**同一份 mutation 出口**
 *   (useConversationRowActions,片A 抽自 conversation-list);菜单词汇沿用同一组词键
 *   (aiChat.actions.* / renameDialog.* / confirmDeleteConversation…),不留第二份语义。
 * - 搜索过滤与日期分桶连线侧栏历史同一把尺(sidebar-chat-history 的
 *   filterConversationsByKeyword / groupByDate 出口),两处分桶语义永不漂移(§0.6)。
 * - 行 draggable:把会话拖进分屏空叶由 PaneSplitContainer 承接(payload 键与容器
 *   re-export 的 PANE_DROP_CONVERSATION_TYPE 同源自 '@ihui/shared/chat/multi-pane')。
 * - 视觉档(片C):选中左指示条 + sticky 分组头 + 全交互 focus-visible ring +
 *   motion-reduce 关动效;颜色全走 design-token(bg-primary/accent/muted 族,暗色自适应)。
 */
import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Archive,
  MessageSquare,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Star,
  Trash2,
} from 'lucide-react'

import type { Conversation } from '@/components/chat/conversation-list'
import { filterConversationsByKeyword, groupByDate } from '@/components/sidebar-chat-history'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  SearchInput,
} from '@ihui/ui-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { useConversationRowActions } from '@/hooks/use-conversation-row-actions'
import { cn } from '@/lib/utils'
import { isRailRowSelected } from '@ihui/shared/ui/chat-workbench-shell-spec'
import { PANE_CONVERSATION_DRAG_TYPE } from '@ihui/shared/chat/multi-pane'

export interface WorkbenchSessionRailProps {
  items: readonly Conversation[]
  selectedId: string | null
  onSelect: (conversationId: string) => void
}

function formatRelativeTime(raw: string, locale: string): string {
  const ts = new Date(raw).getTime()
  if (!Number.isFinite(ts)) return ''
  const diffMin = Math.round((Date.now() - ts) / 60_000)
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (diffMin < 60) return fmt.format(-diffMin, 'minute')
  if (diffMin < 60 * 24) return fmt.format(-Math.round(diffMin / 60), 'hour')
  return fmt.format(-Math.round(diffMin / (60 * 24)), 'day')
}

export function WorkbenchSessionRail({ items, selectedId, onSelect }: WorkbenchSessionRailProps) {
  const t = useTranslations('chat')
  // 分组标题与侧栏历史同取词路径;菜单/动作/toast 词键与 history 行菜单同源(aiChat ns)
  const tg = useTranslations('aiChat')
  const locale = useLocale()
  const [keyword, setKeyword] = React.useState('')
  const [renaming, setRenaming] = React.useState<Conversation | null>(null)
  const [renameValue, setRenameValue] = React.useState('')
  const [deleting, setDeleting] = React.useState<Conversation | null>(null)
  // 受控行菜单 id:右键(onContextMenu)与 ⋯ 触发器共享同一开合态,右键直开不再绕道 Tab
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null)

  const { deleteMutation, favMutation, pinMutation, archiveMutation, renameMutation } =
    useConversationRowActions()

  const groups = React.useMemo(
    // 分桶是纯搬运行(不裁字段),运行时恒为 Conversation[];出口签名收窄 ConversationItem
    // (无 favorite)会丢行操作所需字段,按事实同型断言回宽。
    () =>
      groupByDate(filterConversationsByKeyword(items, keyword)) as {
        key: string
        items: Conversation[]
      }[],
    [items, keyword],
  )
  const totalShown = groups.reduce((sum, g) => sum + g.items.length, 0)

  const commitRename = React.useCallback(() => {
    if (!renaming) return
    const title = renameValue.trim()
    if (!title || title === renaming.title) {
      setRenaming(null)
      return
    }
    renameMutation.mutate({ id: renaming.id, title })
    setRenaming(null)
  }, [renaming, renameValue, renameMutation])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-2 pb-1 pt-1">
        <SearchInput
          value={keyword}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeyword(e.target.value)}
          placeholder={t('searchPlaceholder')}
        />
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-1" aria-label={t('workbenchSessions')}>
        {totalShown === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {keyword ? t('searchNoResult') : t('empty')}
          </div>
        ) : null}
        {groups.map((group) => (
          <div key={group.key} className="mb-1 last:mb-0">
            <div className="sticky top-0 z-10 bg-muted/30 px-2.5 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              {tg(group.key)}
            </div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const selected = isRailRowSelected(item.id, selectedId)
                return (
                  <li key={item.id} className="relative">
                    <button
                      type="button"
                      aria-current={selected ? 'true' : undefined}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(PANE_CONVERSATION_DRAG_TYPE, item.id)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={() => onSelect(item.id)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setMenuOpenId(item.id)
                      }}
                      className={cn(
                        'group flex w-full items-center gap-2 rounded-sm border-l-2 py-2 pl-2.5 pr-1 text-left text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'motion-reduce:transition-none',
                        selected
                          ? 'border-l-primary bg-primary/10 font-medium text-foreground'
                          : 'border-l-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.pinned ? (
                        <Pin className="h-3 w-3 shrink-0 text-primary" aria-hidden />
                      ) : null}
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70 group-hover:hidden">
                        {formatRelativeTime(item.lastMessageAt, locale)}
                      </span>
                      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 菜单锚点容器只做事件隔离(stopPropagation),不承载交互;真实交互由内部 RailRowMenu 的按钮提供(键盘可达),等价键盘路径 = 聚焦该按钮后 Enter/空格 */}
                      <span
                        // 常挂载 + 透明度淡入:Radix popper 的锚点不能处于 display:none,
                        // hidden/group-hover 会让右键直开时定位塌到原点(可见性只做视觉层)
                        className="inline-flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[menu-open]:opacity-100"
                        data-menu-open={menuOpenId === item.id ? '' : undefined}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => e.stopPropagation()}
                        title={tg('actions.menu')}
                      >
                        <RailRowMenu
                          item={item}
                          open={menuOpenId === item.id}
                          onOpenChange={(o) => setMenuOpenId(o ? item.id : null)}
                          onRename={() => {
                            setRenaming(item)
                            setRenameValue(item.title)
                          }}
                          onDelete={() => setDeleting(item)}
                          onToggleFavorite={() => favMutation.mutate(item.id)}
                          onTogglePin={() =>
                            pinMutation.mutate({ id: item.id, pinned: !item.pinned })
                          }
                          onArchive={() => archiveMutation.mutate(item.id)}
                        />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* 重命名 Dialog:与 history 页同词键(renameDialog.*),同 API 出口(renameMutation) */}
      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tg('renameDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm text-muted-foreground" htmlFor="wb-rename-input">
              {tg('renameDialog.label')}
            </label>
            <Input
              id="wb-rename-input"
              value={renameValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenameValue(e.target.value)}
              placeholder={tg('renameDialog.placeholder')}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') commitRename()
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              {tg('renameDialog.cancel')}
            </Button>
            <Button onClick={commitRename}>{tg('renameDialog.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={tg('deleteConversation')}
        content={tg('confirmDeleteConversation')}
        confirmText={tg('delete')}
        cancelText={tg('renameDialog.cancel')}
        variant="danger"
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

/** 行菜单:受控开合(⋯ 触发与行右键同态);动作直连共享 mutation 出口(片A),词汇与 history 同源 */
function RailRowMenu({
  item,
  open,
  onOpenChange,
  onRename,
  onDelete,
  onToggleFavorite,
  onTogglePin,
  onArchive,
}: {
  item: Conversation
  open: boolean
  onOpenChange: (open: boolean) => void
  onRename: () => void
  onDelete: () => void
  onToggleFavorite: () => void
  onTogglePin: () => void
  onArchive: () => void
}) {
  const t = useTranslations('aiChat')
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <span
          role="button"
          tabIndex={-1}
          aria-label={t('actions.menu')}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreVertical className="h-3.5 w-3.5" aria-hidden />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={onRename}>
          <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden />
          {t('actions.rename')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggleFavorite}>
          <Star className="mr-2 h-3.5 w-3.5" aria-hidden />
          {item.favorite ? t('unfavorite') : t('favorite')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onTogglePin}>
          {item.pinned ? (
            <PinOff className="mr-2 h-3.5 w-3.5" aria-hidden />
          ) : (
            <Pin className="mr-2 h-3.5 w-3.5" aria-hidden />
          )}
          {item.pinned ? t('actions.unpin') : t('actions.pin')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onArchive}>
          <Archive className="mr-2 h-3.5 w-3.5" aria-hidden />
          {t('actions.archive')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-destructive">
          <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden />
          {t('actions.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
