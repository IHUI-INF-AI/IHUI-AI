// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { Ticket } from 'lucide-react-native'
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import {
  createSupportStyles,
  TICKET_PRIORITY_PALETTE,
  TICKET_STATUS_PALETTE,
} from './support-styles'

/** 工单状态/优先级(与后端 /api/customer-service 同域;共享层不依赖 api-client,独立声明)。 */
export type SupportTicketStatus = 'pending' | 'open' | 'resolved' | 'closed' | 'rejected'
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface SupportCategoryRow {
  id: string
  name: string
  slug: string
}

/** 工单行(形状对齐 @ihui/api-client SupportTicket)。 */
export interface SupportTicketRow {
  id: string
  ticketNo: string
  categoryId: string | null
  title: string
  description: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  source: string
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SupportTicketCommentRow {
  id: string
  ticketId: string
  userId: string
  content: string
  isAdmin: boolean
  attachments: unknown[]
  createdAt: string
}

export interface SupportTicketRatingRow {
  id: string
  rating: number
  comment: string | null
}

/** 工单详情(对齐 GET /customer-service/tickets/:id 信封 data)。 */
export interface SupportTicketDetailData {
  ticket: SupportTicketRow
  comments: SupportTicketCommentRow[]
  rating: SupportTicketRatingRow | null
}

/** 新建工单提交载荷(屏内已完成长度校验)。 */
export interface SupportTicketCreateInput {
  title: string
  description: string
  categoryId: string | null
  priority: SupportTicketPriority
}

export interface SupportScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading: boolean
  error: string | null
  tickets: SupportTicketRow[]
  categories: SupportCategoryRow[]
  onRefresh: () => void
  /** 创建工单:成功 true(平台薄壳负责随后刷新列表)。 */
  onCreate: (input: SupportTicketCreateInput) => Promise<boolean>
  /** 拉取详情:失败返回 null。 */
  onOpenDetail: (id: string) => Promise<SupportTicketDetailData | null>
  /** 补充回复。 */
  onAddComment: (id: string, content: string) => Promise<boolean>
  /** 提交服务评价。 */
  onRate: (id: string, rating: number, comment: string | null) => Promise<boolean>
}

const STATUS_KEYS: Record<
  SupportTicketStatus,
  | 'supportPage.statusPending'
  | 'supportPage.statusOpen'
  | 'supportPage.statusResolved'
  | 'supportPage.statusClosed'
  | 'supportPage.statusRejected'
> = {
  pending: 'supportPage.statusPending',
  open: 'supportPage.statusOpen',
  resolved: 'supportPage.statusResolved',
  closed: 'supportPage.statusClosed',
  rejected: 'supportPage.statusRejected',
}

const PRIORITY_KEYS: Record<
  SupportTicketPriority,
  | 'supportPage.priorityLow'
  | 'supportPage.priorityMedium'
  | 'supportPage.priorityHigh'
  | 'supportPage.priorityUrgent'
> = {
  low: 'supportPage.priorityLow',
  medium: 'supportPage.priorityMedium',
  high: 'supportPage.priorityHigh',
  urgent: 'supportPage.priorityUrgent',
}

const PRIORITY_OPTIONS: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent']

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 客服中心共享屏(Wave1 support 域,对齐 web /support 页三件套语义):
 * 头部返回 + 标题;「我的工单 / 提交工单」双页签;列表行(标题 + 工单号·日期 + 状态徽章),
 * 点行进详情(描述/沟通记录/补充回复/星级评价);内联新建表单(标题/分类/优先级/描述);
 * loading/error/empty/refresh 四态。取数与写操作全部经 props 回调由平台薄壳承担。
 */
export function SupportScreen({
  t,
  colorScheme = 'light',
  onBack,
  loading,
  error,
  tickets,
  categories,
  onRefresh,
  onCreate,
  onOpenDetail,
  onAddComment,
  onRate,
}: SupportScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createSupportStyles(tk), [tk])

  const [tab, setTab] = useState<'list' | 'new'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SupportTicketDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailErr, setDetailErr] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState<SupportTicketPriority>('medium')
  const [formErr, setFormErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)
  const [stars, setStars] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingBusy, setRatingBusy] = useState(false)

  const openDetail = async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDetailErr(null)
    setReply('')
    setStars(5)
    setRatingComment('')
    setDetailLoading(true)
    const d = await onOpenDetail(id)
    setDetailLoading(false)
    if (d) {
      setDetail(d)
    } else {
      setDetailErr(t('supportPage.detailFetchFailed'))
    }
  }

  const closeDetail = () => {
    setSelectedId(null)
    setDetail(null)
    setDetailErr(null)
  }

  const handleSubmit = async () => {
    if (submitting) return
    setFormErr(null)
    if (title.trim().length < 2) {
      setFormErr(t('supportPage.errTitleMin'))
      return
    }
    if (desc.trim().length < 10) {
      setFormErr(t('supportPage.errDescMin'))
      return
    }
    setSubmitting(true)
    const ok = await onCreate({
      title: title.trim(),
      description: desc.trim(),
      categoryId: categoryId || null,
      priority,
    })
    setSubmitting(false)
    if (ok) {
      setTitle('')
      setDesc('')
      setCategoryId('')
      setPriority('medium')
      setFormErr(null)
      setTab('list')
    } else {
      setFormErr(t('supportPage.createFailed'))
    }
  }

  const handleSendReply = async () => {
    if (!selectedId || replying || !reply.trim()) return
    setReplying(true)
    const ok = await onAddComment(selectedId, reply.trim())
    setReplying(false)
    if (ok) {
      setReply('')
      const d = await onOpenDetail(selectedId)
      if (d) setDetail(d)
    } else {
      setDetailErr(t('supportPage.replyFailed'))
    }
  }

  const handleSubmitRating = async () => {
    if (!selectedId || ratingBusy) return
    setRatingBusy(true)
    const ok = await onRate(selectedId, stars, ratingComment.trim() || null)
    setRatingBusy(false)
    if (ok) {
      setRatingComment('')
      const d = await onOpenDetail(selectedId)
      if (d) setDetail(d)
    } else {
      setDetailErr(t('supportPage.ratingFailed'))
    }
  }

  const header = (
    <View style={styles.header}>
      <BackChevron
        onPress={selectedId ? closeDetail : onBack}
        label={t('common.back')}
        colorScheme={colorScheme}
      />
      <Text style={styles.headerTitle}>{t('supportPage.title')}</Text>
    </View>
  )

  const statusBadge = (status: SupportTicketStatus) => {
    const palette = TICKET_STATUS_PALETTE[status]
    return (
      <View style={[styles.badge, { backgroundColor: palette.bg }]}>
        <Text style={[styles.badgeText, { color: palette.fg }]}>{t(STATUS_KEYS[status])}</Text>
      </View>
    )
  }

  const priorityBadge = (p: SupportTicketPriority) => {
    const palette = TICKET_PRIORITY_PALETTE[p]
    return (
      <View style={[styles.badge, { backgroundColor: palette.bg }]}>
        <Text style={[styles.badgeText, { color: palette.fg }]}>{t(PRIORITY_KEYS[p])}</Text>
      </View>
    )
  }

  const starRow = (value: number, editable: boolean) => (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          disabled={!editable}
          activeOpacity={0.8}
          accessibilityRole="button"
          onPress={() => editable && setStars(n)}
        >
          <Text style={[styles.star, n <= value && styles.starOn]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  )

  /* ===== 详情视图(选中工单时整屏替换页签内容,对齐 web TicketDetailDialog) ===== */
  if (selectedId) {
    const selectedTicket = tickets.find((x) => x.id === selectedId)
    const view = detail?.ticket ?? selectedTicket
    const canRate =
      Boolean(detail) &&
      (detail!.ticket.status === 'resolved' || detail!.ticket.status === 'closed') &&
      !detail!.rating
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
            onPress={closeDetail}
          >
            <Text style={styles.secondaryBtnText}>{t('supportPage.backToList')}</Text>
          </TouchableOpacity>

          {view ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.detailTitle}>{view.title}</Text>
              </View>
              <Text style={styles.detailNo}>{view.ticketNo}</Text>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>{t('supportPage.statusPrefix')}</Text>
                {statusBadge(view.status)}
                <Text style={styles.metaLabel}>{t('supportPage.priorityPrefix')}</Text>
                {priorityBadge(view.priority)}
              </View>
            </View>
          ) : null}

          {detailErr && !detailLoading ? <Text style={styles.errorText}>{detailErr}</Text> : null}

          {detailLoading ? (
            <View style={styles.card}>
              <View style={styles.skeletonRow} />
              <View style={styles.skeletonRow} />
            </View>
          ) : detail ? (
            <>
              <View style={styles.card}>
                <View style={styles.descBox}>
                  <Text style={styles.descLabel}>{t('supportPage.descriptionLabel')}</Text>
                  <Text style={styles.descText}>{detail.ticket.description}</Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('supportPage.commentsLabel')}</Text>
                {detail.comments.length === 0 ? (
                  <Text style={styles.rowSub}>{t('supportPage.noComments')}</Text>
                ) : (
                  <View style={styles.commentsBox}>
                    {detail.comments.map((c) => (
                      <View
                        key={c.id}
                        style={[
                          styles.commentRow,
                          c.isAdmin ? styles.commentAdmin : styles.commentUser,
                        ]}
                      >
                        <View style={styles.metaLine}>
                          <Text style={styles.commentRole}>
                            {c.isAdmin ? t('supportPage.adminRole') : t('supportPage.userRole')}
                          </Text>
                          <Text style={styles.commentMeta}>{formatDateTime(c.createdAt)}</Text>
                        </View>
                        <Text style={styles.commentText}>{c.content}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.fieldLabel}>{t('supportPage.replyLabel')}</Text>
                <TextInput
                  style={[styles.input, styles.replyInput]}
                  value={reply}
                  onChangeText={setReply}
                  multiline
                  placeholder={t('supportPage.replyPlaceholder')}
                  placeholderTextColor={tk.text.tertiary}
                />
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, (!reply.trim() || replying) && styles.btnDisabled]}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    disabled={replying || !reply.trim()}
                    onPress={() => void handleSendReply()}
                  >
                    <Text style={styles.primaryBtnText}>{t('supportPage.send')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {detail.rating ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{t('supportPage.myRating')}</Text>
                  {starRow(detail.rating.rating, false)}
                  {detail.rating.comment ? (
                    <Text style={styles.descText}>{detail.rating.comment}</Text>
                  ) : null}
                </View>
              ) : canRate ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{t('supportPage.serviceRating')}</Text>
                  {starRow(stars, true)}
                  <TextInput
                    style={[styles.input, styles.replyInput]}
                    value={ratingComment}
                    onChangeText={setRatingComment}
                    multiline
                    placeholder={t('supportPage.ratingCommentPlaceholder')}
                    placeholderTextColor={tk.text.tertiary}
                  />
                  <View style={styles.formActions}>
                    <TouchableOpacity
                      style={[styles.primaryBtn, ratingBusy && styles.btnDisabled]}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      disabled={ratingBusy}
                      onPress={() => void handleSubmitRating()}
                    >
                      <Text style={styles.primaryBtnText}>{t('supportPage.submitRating')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    )
  }

  /* ===== 列表 / 新建 双页签视图(对齐 web SupportPage) ===== */
  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loading && !error}
            onRefresh={onRefresh}
            tintColor={tk.text.secondary}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('supportPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('supportPage.subtitle')}</Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'list' && styles.tabBtnActive]}
            activeOpacity={0.85}
            accessibilityRole="button"
            onPress={() => setTab('list')}
          >
            <Text style={[styles.tabText, tab === 'list' && styles.tabTextActive]}>
              {t('supportPage.tabList')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'new' && styles.tabBtnActive]}
            activeOpacity={0.85}
            accessibilityRole="button"
            onPress={() => setTab('new')}
          >
            <Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>
              {t('supportPage.tabNew')}
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'new' ? (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t('supportPage.titleLabel')}</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              placeholder={t('supportPage.titlePlaceholder')}
              placeholderTextColor={tk.text.tertiary}
            />

            <Text style={styles.fieldLabel}>{t('supportPage.categoryLabel')}</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !categoryId && styles.chipActive]}
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={() => setCategoryId('')}
              >
                <Text style={[styles.chipText, !categoryId && styles.chipActiveText]}>
                  {t('supportPage.categoryNone')}
                </Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, categoryId === c.id && styles.chipActive]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  onPress={() => setCategoryId(c.id)}
                >
                  <Text style={[styles.chipText, categoryId === c.id && styles.chipActiveText]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('supportPage.priorityLabel')}</Text>
            <View style={styles.chipRow}>
              {PRIORITY_OPTIONS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, priority === p && styles.chipActive]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.chipText, priority === p && styles.chipActiveText]}>
                    {t(PRIORITY_KEYS[p])}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('supportPage.descLabel')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={desc}
              onChangeText={setDesc}
              multiline
              maxLength={5000}
              placeholder={t('supportPage.descPlaceholder')}
              placeholderTextColor={tk.text.tertiary}
            />

            {formErr ? <Text style={styles.formErr}>{formErr}</Text> : null}

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => setTab('list')}
              >
                <Text style={styles.secondaryBtnText}>{t('supportPage.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, submitting && styles.btnDisabled]}
                activeOpacity={0.85}
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void handleSubmit()}
              >
                <Text style={styles.primaryBtnText}>{t('supportPage.submit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : error && !loading ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={onRefresh}
            >
              <Text style={styles.secondaryBtnText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : loading && tickets.length === 0 ? (
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ticket size={32} color={tk.text.tertiary} strokeWidth={1.6} />
            <Text style={styles.emptyText}>{t('supportPage.empty')}</Text>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => setTab('new')}
            >
              <Text style={styles.secondaryBtnText}>{t('supportPage.createFirst')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tickets.map((ticket) => (
            <TouchableOpacity
              key={ticket.id}
              style={styles.card}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => void openDetail(ticket.id)}
            >
              <View style={styles.cardHead}>
                <View style={styles.iconBox}>
                  <Ticket size={17} color={tk.brandAccent.deep} strokeWidth={2} />
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{ticket.title}</Text>
                  <Text style={styles.rowSub}>
                    {ticket.ticketNo} · {formatDateTime(ticket.createdAt)}
                  </Text>
                </View>
                {statusBadge(ticket.status)}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
