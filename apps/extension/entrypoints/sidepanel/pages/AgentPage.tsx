import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAgents,
  getAgentDetail,
  getAgentPermission,
  type Agent,
  type AgentPermission,
} from '@ihui/api-client'
import { Button, Card, CardContent, CardHeader, CardTitle, VipBadge } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import AgentRuntimePanel from '../components/AgentRuntimePanel'

const AVATAR_CLASS =
  'inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted text-card text-xs font-semibold shrink-0 overflow-hidden'
const ROW_CLASS = 'flex items-center gap-2'
const DESC_CLASS = 'm-0 text-xs text-muted leading-normal'

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

  if (loading)
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  if (error)
    return (
      <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive my-2 text-xs">
        {error}
      </div>
    )

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('nav.agents')}</h3>
      </div>
      {agents.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-2.5">
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
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {t('agent.useCount')} {a.useCount}
                  </span>
                  <span className="text-primary font-semibold">★ {a.rating.toFixed(1)}</span>
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

  if (loading)
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  if (error)
    return (
      <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive my-2 text-xs">
        {error}
      </div>
    )
  if (!agent) return null

  const permText = permission?.hasPermission
    ? t('agent.usable')
    : permission?.type === 'vip' || permission?.type === 'vip_only'
      ? t('agent.needVip')
      : permission?.type === 'paid' || permission?.type === 'purchased'
        ? t('agent.needPurchase')
        : permission?.reason || '—'

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary text-xs px-1.5 py-0.5"
          onClick={() => navigate('/agents')}
        >
          ← {t('common.back')}
        </Button>
        <h3 className="m-0 text-sm font-semibold">{agent.name}</h3>
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={
            activeTab === 'info'
              ? 'rounded-none border-0 border-b-2 border-accent text-accent font-semibold px-3 py-1.5 text-xs'
              : 'rounded-none border-0 border-b-2 border-transparent text-muted px-3 py-1.5 text-xs'
          }
          onClick={() => setActiveTab('info')}
        >
          {t('agent.detailTab')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={
            activeTab === 'runtime'
              ? 'rounded-none border-0 border-b-2 border-accent text-accent font-semibold px-3 py-1.5 text-xs'
              : 'rounded-none border-0 border-b-2 border-transparent text-muted px-3 py-1.5 text-xs'
          }
          onClick={() => setActiveTab('runtime')}
        >
          {t('nav.tabRuntime')}
        </Button>
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
            <dl className="flex flex-col gap-2 m-0">
              <div className="flex justify-between text-xs">
                <dt className="text-muted-foreground m-0">{t('agent.useCount')}</dt>
                <dd className="m-0">{agent.useCount}</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-muted-foreground m-0">{t('agent.rating')}</dt>
                <dd className="m-0">★ {agent.rating.toFixed(1)}</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-muted-foreground m-0">{t('agent.permission')}</dt>
                <dd className="m-0">{permText}</dd>
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
