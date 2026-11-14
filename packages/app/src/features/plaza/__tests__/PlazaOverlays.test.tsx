// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 广场三段共享弹层(赛道抽屉 / 身份切换 / 详情居中弹层)上收后的渲染回归:
// ① 三段在共享屏里真实消费(同一组 props,RN 与小程序同形);
// ② 正向:visible/item 给足时,各段标题/选项/用户区/底部入口/详情字段全部出现;
// ③ 双向阴性对照:visible=false、item=null、三段 props 整体缺省 ⇒ 按同一查找必红。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { PlazaItem } from '@ihui/types'
import { PlazaDetailModal } from '../PlazaDetailModal'
import { PlazaIdentitySheet } from '../PlazaIdentitySheet'
import { PlazaScreen } from '../PlazaScreen'

const dict: Record<string, string> = {
  'plaza.index.identityTitle': '切换身份',
  'plaza.index.closeIdentity': '关闭身份弹层',
  'plaza.index.tabDone': '已完成',
  'plaza.index.tabOngoing': '进行中',
  'plaza.index.tabAll': '全部',
  'plaza.index.anonymous': '匿名',
  'plaza.index.closeDetail': '关闭详情',
  'plaza.index.detailTrack': '赛道',
  'plaza.index.detailStatus': '状态',
  'plaza.index.detailAuthor': '发布人',
  'plaza.index.viewDetail': '查看详情',
}
const t = (key: string, _options?: Record<string, string | number>) => dict[key] ?? key

const item = {
  id: 'p-unique-1',
  title: '唯一标题-广场需求',
  description: '唯一描述-共享详情弹层',
  creator: '唯一发布人',
  status: 'developing',
  track: '唯一赛道AI',
} as unknown as PlazaItem

const identityItems = [
  { id: 'demander', label: '需求方-唯一' },
  { id: 'developer', label: '开发者-唯一' },
]

const screenBaseProps = {
  t,
  items: [] as PlazaItem[],
  loading: false,
  refreshing: false,
  loadingMore: false,
  error: '',
  status: 'waiting',
  search: '',
  showSearch: false,
  onRefresh: () => {},
  onEndReached: () => {},
  onStatusChange: () => {},
  onSearchChange: () => {},
  onSubmitSearch: () => {},
  onPressItem: () => {},
  onPublish: () => {},
}

afterEach(cleanup)

describe('PlazaIdentitySheet 共享弹层', () => {
  it('visible=true 渲染标题/身份选项/用户区/底部入口', () => {
    render(
      <PlazaIdentitySheet
        t={t}
        visible
        items={identityItems}
        selectedId="demander"
        user={{ name: '唯一昵称', subtext: '唯一副文案' }}
        footer={{ title: '唯一底部标题', text: '唯一底部说明', onPress: () => {} }}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('切换身份')).toBeTruthy()
    for (const it of identityItems) expect(screen.getByText(it.label)).toBeTruthy()
    expect(screen.getByText('唯一昵称')).toBeTruthy()
    expect(screen.getByText('唯一副文案')).toBeTruthy()
    expect(screen.getByText('唯一底部标题')).toBeTruthy()
    expect(screen.getByText('唯一底部说明')).toBeTruthy()
  })

  it('阴性对照:visible=false 时身份文案一个都不出现', () => {
    render(
      <PlazaIdentitySheet
        t={t}
        visible={false}
        items={identityItems}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.queryByText('切换身份')).toBeNull()
    expect(() => screen.getByText('切换身份')).toThrow()
    expect(screen.queryByText('需求方-唯一')).toBeNull()
  })

  it('阴性对照:摘掉「开发者」选项后按该标签查找必须红', () => {
    render(
      <PlazaIdentitySheet
        t={t}
        visible
        items={identityItems.filter((it) => it.id !== 'developer')}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('需求方-唯一')).toBeTruthy()
    expect(screen.queryByText('开发者-唯一')).toBeNull()
    expect(() => screen.getByText('开发者-唯一')).toThrow()
  })
})

describe('PlazaDetailModal 共享弹层', () => {
  it('item 非空渲染标题/描述/赛道/状态/发布人/查看详情', () => {
    render(
      <PlazaDetailModal t={t} visible item={item} onClose={() => {}} onOpenDetail={() => {}} />,
    )
    expect(screen.getByText('唯一标题-广场需求')).toBeTruthy()
    expect(screen.getByText('唯一描述-共享详情弹层')).toBeTruthy()
    expect(screen.getByText(/唯一赛道AI/)).toBeTruthy()
    expect(screen.getByText(/进行中/)).toBeTruthy()
    expect(screen.getByText(/唯一发布人/)).toBeTruthy()
    expect(screen.getByText('查看详情')).toBeTruthy()
  })

  it('阴性对照:item=null 时整段不渲染', () => {
    render(
      <PlazaDetailModal t={t} visible item={null} onClose={() => {}} onOpenDetail={() => {}} />,
    )
    expect(screen.queryByText('唯一标题-广场需求')).toBeNull()
    expect(() => screen.getByText('唯一标题-广场需求')).toThrow()
  })

  it('阴性对照:摘掉 description 后按该描述查找必须红', () => {
    const noDesc = { ...item, description: undefined } as unknown as PlazaItem
    render(
      <PlazaDetailModal t={t} visible item={noDesc} onClose={() => {}} onOpenDetail={() => {}} />,
    )
    expect(screen.queryByText('唯一描述-共享详情弹层')).toBeNull()
    expect(() => screen.getByText('唯一描述-共享详情弹层')).toThrow()
  })
})

describe('PlazaScreen 三段共享弹层消费', () => {
  it('三段 props 全给时三处内容全部出现', () => {
    render(
      <PlazaScreen
        {...screenBaseProps}
        trackFilter={{
          visible: true,
          items: [
            { id: '', label: '全部赛道-唯一' },
            { id: 'ai', label: 'AI赛道-唯一' },
          ],
          selectedId: '',
          onSelect: () => {},
          onVisibleChange: () => {},
          panelTitle: '分类标题-唯一',
        }}
        identitySheet={{
          visible: true,
          items: identityItems,
          onSelect: () => {},
          onClose: () => {},
        }}
        detail={{ item, onClose: () => {}, onOpenDetail: () => {} }}
      />,
    )
    expect(screen.getByText('分类标题-唯一')).toBeTruthy()
    expect(screen.getByText('AI赛道-唯一')).toBeTruthy()
    expect(screen.getByText('切换身份')).toBeTruthy()
    expect(screen.getByText('开发者-唯一')).toBeTruthy()
    expect(screen.getByText('唯一标题-广场需求')).toBeTruthy()
    expect(screen.getByText('查看详情')).toBeTruthy()
  })

  it('阴性对照:三段 props 缺省时同一组查找全部必红', () => {
    render(<PlazaScreen {...screenBaseProps} />)
    expect(screen.queryByText('分类标题-唯一')).toBeNull()
    expect(() => screen.getByText('分类标题-唯一')).toThrow()
    expect(screen.queryByText('AI赛道-唯一')).toBeNull()
    expect(screen.queryByText('切换身份')).toBeNull()
    expect(() => screen.getByText('切换身份')).toThrow()
    expect(screen.queryByText('唯一标题-广场需求')).toBeNull()
    expect(() => screen.getByText('唯一标题-广场需求')).toThrow()
    expect(screen.queryByText('查看详情')).toBeNull()
  })
})
