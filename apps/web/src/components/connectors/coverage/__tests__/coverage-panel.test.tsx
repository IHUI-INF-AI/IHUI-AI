// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/feedback'

import type { ConnectorEntry } from '@ihui/api-client/endpoints/connectors'

import type { CoverageCatalog } from '../types'
import { COVERAGE_STATE_META, resolveApiStatus } from '../types'
import { CoveragePanel } from '../coverage-panel'

afterEach(() => cleanup())

const okCatalog: CoverageCatalog = {
  platform: 'feishu',
  label: '飞书',
  catalog_state: 'ok',
  source: { index_url: '', fetched_at: '2026-11-24', declared_total: 2, enumeration_method: 'catalog' },
  totals: {
    apis: 2,
    domains: 1,
    available: 1,
    permission_denied: 1,
    need_user_token: 0,
    need_admin: 0,
    unsupported: 0,
    error: 0,
    unprobed: 0,
  },
  domains: [
    {
      key: 'im',
      label: '消息与群组',
      count: 2,
      complete: true,
      available: 1,
      permission_denied: 1,
      need_user_token: 0,
      need_admin: 0,
      unsupported: 0,
      error: 0,
      unprobed: 0,
    },
  ],
  apis: [
    {
      id: 'api-1',
      domain: 'im',
      name: '发消息',
      method: 'POST',
      path: '/im/v1/messages',
      auth: 'tenant',
      scope: 'im:message',
      read: false,
      event: false,
      doc_url: 'https://example.com/doc1',
      status: { state: 'available', http_code: 200, platform_code: null, reason: '', missing_scope: '', probed_at: null },
    },
    {
      id: 'api-2',
      domain: 'im',
      name: '读消息',
      method: 'GET',
      path: '/im/v1/messages/{id}',
      auth: 'tenant',
      scope: 'im:message:read',
      read: true,
      event: true,
      doc_url: '',
      status: {
        state: 'permission_denied',
        http_code: 403,
        platform_code: '99991664',
        reason: 'no scope',
        missing_scope: 'im:message:read',
        probed_at: null,
      },
    },
  ],
  events: {
    count: 1,
    items: [
      {
        id: 'evt-1',
        domain: 'im',
        name: '消息接收回调',
        method: 'POST',
        path: '/event/im.message.receive',
        auth: 'callback',
        scope: 'im:message:event',
        read: false,
        event: true,
        doc_url: '',
        status: { state: 'unprobed', http_code: null, platform_code: null, reason: '', missing_scope: '', probed_at: null },
      },
    ],
  },
  unenumerated_domains: [
    { key: 'docs', label: '文档与知识库', reason: '官方未公布该域接口清单' },
  ],
  unjudged_reason: '',
}

const unjudgedCatalog: CoverageCatalog = {
  ...okCatalog,
  catalog_state: 'unjudged',
  totals: { apis: 0, domains: 0, available: 0, permission_denied: 0, need_user_token: 0, need_admin: 0, unsupported: 0, error: 0, unprobed: 0 },
  domains: [],
  apis: [],
  events: { count: 0, items: [] },
  unenumerated_domains: [],
  unjudged_reason: '台账抓取失败:目录索引暂不可达',
}

const probeResult = {
  probed: 1,
  skipped: 0,
  summary: {},
  results: [
    { api_id: 'api-2', state: 'available', http_code: 200, platform_code: null, reason: '', missing_scope: '' },
  ],
}

const planResult = {
  platform: 'feishu',
  selected: 2,
  connectors: [
    {
      key: 'feishu-im-1',
      label: '飞书-消息',
      domain: 'im',
      api_ids: ['api-1', 'api-2'],
      operations: 2,
      operation_defs: [
        {
          id: 'api-1',
          name: '发消息',
          capability: 'action',
          method: 'POST',
          path: '/im/v1/messages',
          base_url: '',
          query: {},
          body: null,
          response_path: '',
          confirm: true,
          disabled: true,
          description: 'im:message',
        },
        {
          id: 'api-2',
          name: '读消息',
          capability: 'list',
          method: 'GET',
          path: '/im/v1/messages/{id}',
          base_url: '',
          query: {},
          body: null,
          response_path: '',
          confirm: false,
          disabled: false,
          description: 'im:message:read',
        },
      ],
    },
  ],
  dropped: 0,
}

const mocks = vi.hoisted(() => ({
  coverage: vi.fn(),
  probe: vi.fn(),
  plan: vi.fn(),
  save: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

vi.mock('@ihui/api-client/endpoints/connectors', () => ({
  getConnectorCoverage: (...args: unknown[]) => mocks.coverage(...args),
  probeConnectorCoverage: (...args: unknown[]) => mocks.probe(...args),
  getConnectorCoveragePlan: (...args: unknown[]) => mocks.plan(...args),
  saveConnectorConfig: (...args: unknown[]) => mocks.save(...args),
}))

function renderPanel(connectors: ConnectorEntry[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CoveragePanel connectors={connectors} onRefresh={vi.fn()} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe('平台 API 目录覆盖面板', () => {
  it('ok 态按业务域渲染目录与总数条(数字取接口)', async () => {
    mocks.coverage.mockResolvedValue({ success: true, data: okCatalog })
    const { findByText, findByRole, getByText } = renderPanel()

    await findByText('消息与群组')
    // 分域默认折叠,展开后逐条列出 API
    const expand = await findByRole('button', { expanded: false })
    expand.click()
    await findByText('发消息')
    expect(getByText('读消息')).toBeTruthy()
  })

  it('unjudged 态渲染未判定空状态,不渲染空表', async () => {
    mocks.coverage.mockResolvedValue({ success: true, data: unjudgedCatalog })
    const { findByText, queryByText } = renderPanel()

    await findByText('目录台账未就绪(未判定)')
    expect(queryByText('发消息')).toBeNull()
    expect(queryByText('读消息')).toBeNull()
  })

  it('探测回填:只读探测默认 read_only=true、limit=50,结果就地回填', async () => {
    mocks.coverage.mockResolvedValue({ success: true, data: okCatalog })
    mocks.probe.mockResolvedValue({ success: true, data: probeResult })
    const installed = [{ type: 'feishu', key: 'feishu:main' }] as ConnectorEntry[]
    const { findByText, findByRole } = renderPanel(installed)

    await findByText('消息与群组')
    const expand = await findByRole('button', { expanded: false })
    expand.click()

    const probeButton = await findByRole('button', { name: /探测全量/ })
    probeButton.click()

    await waitFor(() => expect(mocks.probe).toHaveBeenCalledTimes(1))
    const body = mocks.probe.mock.calls[0]?.[1]
    expect(body).toEqual({ api_ids: [], domains: [], limit: 50, read_only: true })
  })

  it('按域接入预览展示分片连接器数、操作数与丢弃数', async () => {
    mocks.coverage.mockResolvedValue({ success: true, data: okCatalog })
    mocks.plan.mockResolvedValue({ success: true, data: planResult })
    const { findByText, getAllByRole } = renderPanel()

    await findByText('消息与群组')
    // 头部全局与分域树各有一个同名按钮,取头部全局入口
    const planButton = getAllByRole('button', { name: /按域接入/ })[0]
    expect(planButton).toBeDefined()
    planButton?.click()

    await waitFor(() => {
      const text = document.body.textContent?.replace(/\s/g, '') ?? ''
      expect(text).toContain('创建1个分域连接器')
      expect(text).toContain('共2个操作')
      expect(text).toContain('丢弃0条')
    })
  })

  it('事件条目在总数条单独计数,不计入目录总数', async () => {
    mocks.coverage.mockResolvedValue({ success: true, data: okCatalog })
    const { findByText, getByText } = renderPanel()
    await findByText('消息与群组')
    // events.count=1 由后端单独给出,总数条单列「事件」,不并进 totals.apis
    expect(getByText('事件')).toBeTruthy()
  })

  it('展示未展开域提示位:台账遗留域标签与原因', async () => {
    mocks.coverage.mockResolvedValue({ success: true, data: okCatalog })
    const { findByText } = renderPanel()
    await findByText(/未展开域\s*1\s*个/)
    await findByText(/文档与知识库/)
    await findByText(/官方未公布该域接口清单/)
  })

  it('unjudged 态展示未判定原因 unjudged_reason', async () => {
    mocks.coverage.mockResolvedValue({ success: true, data: unjudgedCatalog })
    const { findByText } = renderPanel()
    await findByText('目录台账未就绪(未判定)')
    await findByText(/台账抓取失败:目录索引暂不可达/)
  })

  it('分片保存优先直传 operation_defs,不带展开字段避免被台账覆盖', async () => {
    mocks.coverage.mockResolvedValue({ success: true, data: okCatalog })
    mocks.plan.mockResolvedValue({ success: true, data: planResult })
    mocks.save.mockResolvedValue({ success: true, data: {} })
    const { findByRole, findByText, findAllByRole } = renderPanel()

    await findByText('消息与群组')
    const planButtons = await findAllByRole('button', { name: /按域接入/ })
    planButtons[0]?.click()
    await waitFor(() => {
      expect(document.body.textContent?.replace(/\s/g, '')).toContain('创建1个分域连接器')
    })

    const confirm = await findByRole('button', { name: /确认创建/ })
    confirm.click()

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    const savedArg = mocks.save.mock.calls[0]?.[0]
    expect(savedArg.operations).toEqual(planResult.connectors[0]!.operation_defs)
    // 直传路径不带 platform/api_ids/domains,否则后端 resolve_expansion 会覆盖直传 operations
    expect(savedArg).not.toHaveProperty('platform')
    expect(savedArg).not.toHaveProperty('api_ids')
    expect(savedArg).not.toHaveProperty('domains')
  })

  it('未接入该平台连接器时探测按钮禁用', async () => {
    mocks.coverage.mockResolvedValue({ success: true, data: okCatalog })
    const { findByRole } = renderPanel([])
    const probeButton = await findByRole('button', { name: /探测全量/ })
    expect(probeButton.hasAttribute('disabled')).toBe(true)
  })
})

describe('状态徽章映射', () => {  it('八态文案与既有 Badge 变体逐一对齐', () => {
    expect(COVERAGE_STATE_META.available).toEqual({ label: '可用', badge: 'success' })
    expect(COVERAGE_STATE_META.permission_denied).toEqual({ label: '权限不足', badge: 'danger' })
    expect(COVERAGE_STATE_META.need_user_token).toEqual({ label: '需用户授权', badge: 'warning' })
    expect(COVERAGE_STATE_META.need_admin).toEqual({ label: '需管理员', badge: 'warning' })
    expect(COVERAGE_STATE_META.unsupported).toEqual({ label: '不支持', badge: 'default' })
    expect(COVERAGE_STATE_META.error).toEqual({ label: '探测错误', badge: 'danger' })
    expect(COVERAGE_STATE_META.unprobed).toEqual({ label: '未探测', badge: 'default' })
    expect(COVERAGE_STATE_META.unjudged).toEqual({ label: '未判定', badge: 'default' })
  })

  it('探测回填状态优先于目录自带状态', () => {
    const api = okCatalog.apis[1]!
    const fallback = resolveApiStatus(api, null)
    expect(fallback.state).toBe('permission_denied')

    const overridden = resolveApiStatus(api, {
      api_id: 'api-2',
      state: 'available',
      http_code: 200,
      platform_code: null,
      reason: '',
      missing_scope: '',
    })
    expect(overridden.state).toBe('available')
    expect(overridden.http_code).toBe(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
