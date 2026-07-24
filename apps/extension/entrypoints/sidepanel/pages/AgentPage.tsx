import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAgents,
  getAgentDetail,
  getAgentPermission,
  type Agent,
  type AgentPermission,
} from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle, VipBadge } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import AgentRuntimePanel from '../components/AgentRuntimePanel'

const AVATAR_CLASS =
  'inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted text-card text-xs font-semibold shrink-0 overflow-hidden'
const ROW_CLASS = 'flex items-center gap-2'
const DESC_CLASS = 'm-0 text-xs text-muted leading-normal'
const TAB_BTN_BASE =
  'bg-transparent border-0 border-b-2 rounded-none px-3 py-1.5 text-xs cursor-pointer'
const TAB_BTN_INACTIVE = `${TAB_BTN_BASE} border-transparent text-muted`
const TAB_BTN_ACTIVE = `${TAB_BTN_BASE} border-accent text-accent font-semibold`

function Avatar({ agent }: { agent: Agent }) {
  if (agent.avatar) {
    return (
      <span className={AVATAR_CLASS} aria-hidden>
        <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
      </span>
    )
  }
  const initial = (agent.name?.trim()?.[0] || 'A').toUpperCase()
  return (
    <span className={AVATAR_CLASS} aria-hidden>
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
        setError(res.error || t('agent.loadFailed'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [t])

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
              className="cursor-pointer"
              onClick={() => navigate(`/agents/${a.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/agents/${a.id}`)
                }
              }}
            >
              <CardHeader>
                <div className={ROW_CLASS}>
                  <Avatar agent={a} />
                  <CardTitle>{a.name}</CardTitle>
                  {a.isVipExclusive ? <VipBadge /> : null}
                </div>
              </CardHeader>
              <CardContent>
                <p className={DESC_CLASS}>{a.description || '—'}</p>
                <div className="sp-course-meta">
                  <span>
                    {t('agent.useCount')} {a.useCount}
                  </span>
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
  const [activeTab, setActiveTab] = useState<'info' | 'runtime'>('info')

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
        setError(detailRes.error || t('agent.loadFailed'))
      }
      if (permRes.success) {
        setPermission(permRes.data)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  if (loading) return <div className="empty-state">{t('common.loading')}</div>
  if (error) return <div className="error-banner">{error}</div>
  if (!agent) return null

  const permText = permission?.hasPermission
    ? t('agent.usable')
    : permission?.type === 'vip' || permission?.type === 'vip_only'
      ? t('agent.needVip')
      : permission?.type === 'paid' || permission?.type === 'purchased'
        ? t('agent.needPurchase')
        : permission?.reason || '—'

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <button type="button" className="link-btn" onClick={() => navigate('/agents')}>
          ← {t('common.back')}
        </button>
        <h3>{agent.name}</h3>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          className={activeTab === 'info' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}
          onClick={() => setActiveTab('info')}
        >
          {t('agent.detailTab')}
        </button>
        <button
          type="button"
          className={activeTab === 'runtime' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE}
          onClick={() => setActiveTab('runtime')}
        >
          {t('nav.tabRuntime')}
        </button>
      </div>
      {activeTab === 'info' ? (
        <Card>
          <CardHeader>
            <div className={ROW_CLASS}>
              <Avatar agent={agent} />
              <CardTitle>{agent.name}</CardTitle>
              {agent.isVipExclusive ? <VipBadge size="md" /> : null}
            </div>
          </CardHeader>
          <CardContent>
            <p className={DESC_CLASS}>{agent.description || '—'}</p>
            <dl className="sp-info-list">
              <div>
                <dt>{t('agent.useCount')}</dt>
                <dd>{agent.useCount}</dd>
              </div>
              <div>
                <dt>{t('agent.rating')}</dt>
                <dd>★ {agent.rating.toFixed(1)}</dd>
              </div>
              <div>
                <dt>{t('agent.permission')}</dt>
                <dd>{permText}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : (
        <AgentRuntimePanel agentId={id} />
      )}
    </div>
  )
}

export default function AgentPage() {
  const { id } = useParams<{ id: string }>()
  if (id) return <AgentDetail id={id} />
  return <AgentList />
}
