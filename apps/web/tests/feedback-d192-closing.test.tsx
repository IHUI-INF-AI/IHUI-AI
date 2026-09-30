// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D192 web 反馈表单收尾缺口:不支持类型提示 + 提交成功编号回执。
//
// 钉四件事,缺一条就退化成"文案存在但没人接":
//  ① 类型提示真的上屏(五语种各跑一次,取词与 .ihui-agent/tmp/d175-cont/laneA-spec.json 逐字同形)
//     —— 语言包此刻是他人 in-flight(git status `M `),本票只交 blob,所以这里注入取词表中屏;
//  ② 提示说的白名单与选择器实际收窄的 accept 同源(截图档只有 png/jpeg/gif/webp,
//     真相源是 apps/api/src/utils/file-type-validator.ts 的 EXT_MIME_MAP);
//  ③ 编号回执真的带回了服务端的 id(POST /api/feedbacks → success({feedback}),
//     feedbacks.id 是 `uuid('id').defaultRandom().primaryKey()` + `.returning()`),
//     不是前端造的号;占位符名也必须真是 {requestId}(写错名字这条会渲染出字面量而红);
//  ④ 反向对照:未提交时屏幕上不得有回执。
//
// 本格未收口的第三句(screenshotAlt 逐图 alt)见 laneA-report.md:共享 Upload 的新增 label
// 必须同时在 apps/web/src/hooks/use-upload-labels.ts 注入取词(该仓自带的注入契约测试
// apps/web/tests/ui-upload-webview-labels-injection.test.ts 第二层按 DEFAULT_UPLOAD_LABELS
// 键表逐键比对 hook),而那个文件不在本票的允许改动清单里 ⇒ 只交补丁不落地。

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }))

const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 本票两键的五语种文案(与 laneA-spec.json 逐字同形) */
const PACK: Record<string, Record<string, string>> = {
  'feedback.unsupportedImage': {
    'zh-CN': '仅支持 PNG、JPG、GIF 和 WebP 图片。',
    'zh-TW': '僅支援 PNG、JPG、GIF 與 WebP 圖片。',
    en: 'Only PNG, JPG, GIF and WebP images are supported.',
    ja: 'PNG、JPG、GIF、WebP 画像のみ対応しています。',
    ko: 'PNG, JPG, GIF, WebP 이미지만 지원됩니다.',
  },
  'feedback.requestIdSuffix': {
    'zh-CN': '反馈编号:{requestId}。',
    'zh-TW': '回饋編號:{requestId}。',
    en: 'Feedback ID: {requestId}.',
    ja: 'フィードバック番号:{requestId}。',
    ko: '피드백 번호: {requestId}.',
  },
}

/** 其余取词给出稳定占位串:断言只针对上表两键,其它键只要不撞车即可。 */
const OTHER: Record<string, string> = {
  'feedback.title': '意见反馈',
  'feedback.tab_new': '最新',
  'feedback.submit': '提交',
  'feedback.success': '提交成功',
  'feedback.field_images': '截图',
  'common.cancel': '取消',
}

let lang = 'zh-CN'
const translate = (ns: string | undefined, key: string, values?: Record<string, string | number>) => {
  const idn = `${ns ?? ''}.${key}`
  let out = PACK[idn]?.[lang] ?? OTHER[idn] ?? idn
  for (const [k, v] of Object.entries(values ?? {})) out = out.replaceAll(`{${k}}`, String(v))
  return out
}

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, string | number>) =>
    translate(ns, key, values),
  useLocale: () => lang,
}))

// 服务端唯一入口换掉:@/lib/api 的 import 图(认证 store / 令牌保险箱)与本票无关
vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
  getAuthHeader: vi.fn(() => ''),
}))

// 只换掉 api() 这一次性封装(它内部走 fetchApi),TYPE_KEY 等常量保持真值
vi.mock('@/lib/feedback', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>()
  return { ...mod, api: (url: string, opts?: { method?: string }) => apiMock(url, opts) }
})

// ImageUpload 的缩略图/上传链由共享 Upload 承担,本票只判它收到的 accept 收窄到哪一档
vi.mock('@/components/form/ImageUpload', () => ({
  ImageUpload: (props: { accept?: string; placeholder?: string }) => (
    <div
      data-testid="image-upload"
      data-accept={props.accept ?? ''}
      data-placeholder={props.placeholder ?? ''}
    />
  ),
}))

import { FeedbackForm } from '../app/(main)/feedback/FeedbackForm'
import FeedbackPage from '../app/(main)/feedback/page'

function mountForm() {
  const noop = () => {}
  return render(
    <FeedbackForm
      type="bug"
      setType={noop}
      title=""
      setTitle={noop}
      content=""
      setContent={noop}
      contact=""
      setContact={noop}
      images={[]}
      setImages={noop}
      formError={null}
      isPending={false}
      onSubmit={noop}
      onCancel={noop}
    />,
  )
}

function mountPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <FeedbackPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  lang = 'zh-CN'
  apiMock.mockReset()
})

describe('D192 · unsupportedImage —— 类型提示上屏', () => {
  it('五语种齐:反馈表单截图槽位下方给出白名单提示', () => {
    for (const l of LANGS) {
      cleanup()
      lang = l
      mountForm()
      expect(screen.queryByText(PACK['feedback.unsupportedImage']![l])).toBeTruthy()
    }
  })

  it('提示与选择器同源:accept 收窄到服务端放行的四档,不再是 image/*', () => {
    mountForm()
    const el = screen.getByTestId('image-upload')
    expect(el.getAttribute('data-accept')).toBe('image/png,image/jpeg,image/gif,image/webp')
  })
})

describe('D192 · requestIdSuffix —— 提交成功回执带真实编号', () => {
  it('反向对照:未提交时屏幕上没有回执', () => {
    apiMock.mockImplementation((url: string) =>
      url === '/api/feedbacks' ? Promise.resolve({ list: [] }) : Promise.resolve({}),
    )
    mountPage()
    expect(screen.queryByText(/反馈编号/)).toBeNull()
  })

  it('zh-CN:提交成功后回执显示服务端返回的 feedback.id', async () => {
    const id = '7f0d3b62-4c1a-4f9e-9d2b-0a6f1c2d3e4f'
    apiMock.mockImplementation((url: string, opts?: { method?: string }) =>
      opts?.method === 'POST'
        ? Promise.resolve({ feedback: { id, title: 't', content: 'c', type: 'bug' } })
        : Promise.resolve({ list: [] }),
    )
    mountPage()

    fireEvent.click(screen.getByText('最新'))
    fireEvent.change(document.querySelector('#fb-title') as HTMLInputElement, {
      target: { value: '闪退' },
    })
    fireEvent.change(document.querySelector('#fb-content') as HTMLTextAreaElement, {
      target: { value: '打开设置就闪退' },
    })
    fireEvent.click(screen.getByText('提交'))

    await waitFor(() => expect(screen.queryByText(`反馈编号:${id}。`)).toBeTruthy())
    // 占位符名写错(不是 {requestId})会留下字面量,这里钉住
    expect(screen.queryByText(/\{requestId\}/)).toBeNull()
    // 回执与既有"提交成功"同槽位并存,不是替换
    expect(screen.queryByText('提交成功')).toBeTruthy()
  })

  it('五语种齐:同一 id 在每种语言都插值成该语言的回执', async () => {
    const id = 'FB-1'
    apiMock.mockImplementation((url: string, opts?: { method?: string }) =>
      opts?.method === 'POST'
        ? Promise.resolve({ feedback: { id, title: 't', content: 'c', type: 'bug' } })
        : Promise.resolve({ list: [] }),
    )
    for (const l of LANGS) {
      cleanup()
      lang = l
      mountPage()
      fireEvent.click(screen.getByText(translate('feedback', 'tab_new')))
      fireEvent.change(document.querySelector('#fb-title') as HTMLInputElement, {
        target: { value: 't' },
      })
      fireEvent.change(document.querySelector('#fb-content') as HTMLTextAreaElement, {
        target: { value: 'c' },
      })
      fireEvent.click(screen.getByText(translate('feedback', 'submit')))
      const expected = PACK['feedback.requestIdSuffix']![l].replaceAll('{requestId}', id)
      await waitFor(() => expect(screen.queryByText(expected)).toBeTruthy())
      expect(screen.queryByText(/\{requestId\}/)).toBeNull()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
