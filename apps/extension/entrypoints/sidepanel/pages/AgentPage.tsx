import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAgents,
  getAgentDetail,
  getAgentPermission,
  type Agent,
  type AgentPermission,
} from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle, VipBadge } from '@ihui/ui'
import { useI18n } from '../../../src/i18n'

const avatarStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 6,
  background: 'var(--muted)',
  color: 'var(--card)',
  fontSize: 12,
  fontWeight: 600,
  flexShrink: 0,
  overflow: 'hidden',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const descStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--muted)',
  lineHeight: 1.5,
}

function Avatar({ agent }: { agent: Agent }) {
  if (agent.avatar) {
    return (
      <span style={avatarStyle} aria-hidden>
        <img
          src={agent.avatar}
          alt={agent.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </span>
    )
  }
  const initial = (agent.name?.trim()?.[0] || 'A').toUpperCase()
  return (
    <span style={avatarStyle} aria-hidden>
      {initial}
    </span>
  )
}

function AgentList() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getAgents({ page: 1, pageSize: 30, status: 'published' })
      if (cancelled) return
      if (res.success) {
        setAgents(res.data.list)
      } else {
        setError(res.error || '加载失败')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="empty-state">{t('common.loading')}</div>
  if (error) return <div className="error-banner">{error}</div>

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>{t('nav.agents')}</h3>
      </div>
      {agents.length === 0 ? (
        <div className="empty-state">{t('common.empty')}</div>
      ) : (
        <div className="sp-course-list">
          {agents.map((a) => (
            <Card
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/agents/${a.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/agents/${a.id}`)
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <CardHeader>
                <div style={rowStyle}>
                  <Avatar agent={a} />
                  <CardTitle>{a.name}</CardTitle>
                  {a.isVipExclusive ? <VipBadge /> : null}
                </div>
              </CardHeader>
              <CardContent>
                <p style={descStyle}>{a.description || '—'}</p>
                <div className="sp-course-meta">
                  <span>使用 {a.useCount}</span>
                  <span className="sp-course-price">★ {a.rating.toFixed(1)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function AgentDetail({ id }: { id: string }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [permission, setPermission] = useState<AgentPermission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [detailRes, permRes] = await Promise.all([getAgentDetail(id), getAgentPermission(id)])
      if (cancelled) return
      if (detailRes.success) {
        setAgent(detailRes.data)
      } else {
        setError(detailRes.error || '加载失败')
      }
      if (permRes.success) {
        setPermission(permRes.data)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <div className="empty-state">{t('common.loading')}</div>
  if (error) return <div className="error-banner">{error}</div>
  if (!agent) return null

  const permText = permission?.hasPermission
    ? '可使用'
    : permission?.type === 'vip' || permission?.type === 'vip_only'
      ? '需要 VIP'
      : permission?.type === 'paid' || permission?.type === 'purchased'
        ? '需要购买'
        : permission?.reason || '—'

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <button type="button" className="link-btn" onClick={() => navigate('/agents')}>
          ← {t('common.back')}
        </button>
        <h3>{agent.name}</h3>
      </div>
      <Card>
        <CardHeader>
          <div style={rowStyle}>
            <Avatar agent={agent} />
            <CardTitle>{agent.name}</CardTitle>
            {agent.isVipExclusive ? <VipBadge size="md" /> : null}
          </div>
        </CardHeader>
        <CardContent>
          <p style={descStyle}>{agent.description || '—'}</p>
          <dl className="sp-info-list">
            <div>
              <dt>使用次数</dt>
              <dd>{agent.useCount}</dd>
            </div>
            <div>
              <dt>评分</dt>
              <dd>★ {agent.rating.toFixed(1)}</dd>
            </div>
            <div>
              <dt>权限</dt>
              <dd>{permText}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AgentPage() {
  const { id } = useParams<{ id: string }>()
  if (id) return <AgentDetail id={id} />
  return <AgentList />
}
