import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAgents,
  getAgentDetail,
  getAgentPermission,
  type Agent,
  type AgentPermission,
  type AgentPermissionType,
} from '@ihui/api-client'
import { useI18n } from '../i18n'

const PERM_LABEL: Record<AgentPermissionType, string> = {
  free: '免费',
  vip: 'VIP',
  purchased: '已购买',
  vip_only: 'VIP 专属',
  paid: '付费',
}

function getInitial(name: string): string {
  return (name?.trim()?.charAt(0) || 'A').toUpperCase()
}

function VipBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const padding = size === 'md' ? '4px 10px' : '2px 8px'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 6,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        color: '#d97706',
        fontWeight: 500,
        fontSize: 12,
        padding,
      }}
    >
      VIP
    </span>
  )
}

function AgentAvatar({ agent, size = 32 }: { agent: Agent; size?: number }) {
  if (agent.avatar) {
    return (
      <img
        src={agent.avatar}
        alt={agent.name}
        style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        backgroundColor: 'var(--muted-bg)',
        color: 'var(--muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size / 2,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {getInitial(agent.name)}
    </div>
  )
}

export default function AgentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()

  if (id) return <AgentDetail id={id} navigate={navigate} t={t} />
  return <AgentList navigate={navigate} t={t} />
}

function AgentList({ navigate, t }: { navigate: (p: string) => void; t: (k: string) => string }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getAgents({ page: 1, pageSize: 50 })
      if (cancelled) return
      if (res.success) setAgents(res.data.list)
      else setError(res.error || '加载失败')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const goDetail = (agentId: string) => navigate(`/agents/${agentId}`)

  return (
    <div className="page page-agents">
      <header className="page-header">
        <h2>{t('nav.agents')}</h2>
      </header>
      {error ? <div className="error-banner">{error}</div> : null}
      {loading ? (
        <div className="empty-state">{t('common.loading')}</div>
      ) : agents.length === 0 ? (
        <div className="empty-state">{t('common.empty')}</div>
      ) : (
        <div className="course-grid">
          {agents.map((a) => (
            <div
              key={a.id}
              className="course-card"
              role="button"
              tabIndex={0}
              onClick={() => goDetail(a.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  goDetail(a.id)
                }
              }}
              style={{ cursor: 'pointer', padding: 16 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AgentAvatar agent={a} />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}
                >
                  {a.name}
                </span>
                {a.isVipExclusive ? <VipBadge /> : null}
              </div>
              <p className="course-desc">{a.description || '—'}</p>
              <div className="course-footer">
                <span className="students">{a.useCount} 次使用</span>
                <span className="price">★ {a.rating.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AgentDetail({
  id,
  navigate,
  t,
}: {
  id: string
  navigate: (p: string) => void
  t: (k: string) => string
}) {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [perm, setPerm] = useState<AgentPermission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [detailRes, permRes] = await Promise.all([
        getAgentDetail(id),
        getAgentPermission(id).catch(() => null),
      ])
      if (cancelled) return
      if (detailRes.success) setAgent(detailRes.data)
      else setError(detailRes.error || '加载失败')
      if (permRes?.success) setPerm(permRes.data)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const permText = perm
    ? perm.hasPermission
      ? `可使用 · ${PERM_LABEL[perm.type] ?? perm.type}`
      : `无权限 · ${PERM_LABEL[perm.type] ?? perm.type}`
    : '—'
  const permColor = perm ? (perm.hasPermission ? 'var(--accent)' : 'var(--danger)') : 'var(--muted)'

  return (
    <div className="page page-agent-detail">
      <header className="page-header">
        <h2>{t('nav.agents')}</h2>
        <div className="header-actions">
          <button type="button" onClick={() => navigate('/agents')}>
            {t('common.back')}
          </button>
        </div>
      </header>
      {error ? <div className="error-banner">{error}</div> : null}
      {loading ? (
        <div className="empty-state">{t('common.loading')}</div>
      ) : !agent ? (
        <div className="empty-state">{t('common.empty')}</div>
      ) : (
        <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <AgentAvatar agent={agent} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>{agent.name}</span>
                {agent.isVipExclusive ? <VipBadge size="md" /> : null}
              </div>
              {agent.category ? (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{agent.category}</span>
              ) : null}
            </div>
          </div>
          <p style={{ margin: '8px 0', lineHeight: 1.6, fontSize: 14 }}>
            {agent.description || '—'}
          </p>
          <dl className="info-list">
            <div>
              <dt>使用次数</dt>
              <dd>{agent.useCount}</dd>
            </div>
            <div>
              <dt>评分</dt>
              <dd>★ {agent.rating.toFixed(1)}</dd>
            </div>
            <div>
              <dt>收藏数</dt>
              <dd>{agent.favoriteCount}</dd>
            </div>
            <div>
              <dt>权限</dt>
              <dd style={{ color: permColor, fontWeight: 600 }}>{permText}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
