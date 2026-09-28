// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 首页轮播(carousel / banner)图源失败的常驻判据 —— 钉两件事:
 *
 *  ① **渲染路径上不存在境外硬编码图片域名**。
 *     实测口径(2026-09-29 定位):轮播的图**不是**端内硬编码,而是后端字段
 *     (`carousels.imageUrl` / `lessons.coverImage` / `agents.avatar`),而那些行里存的是
 *     picsum.photos 这类境外随机图服务 → 国内移动网络不可达。所以这一维判的是
 *     "端内不得再往轮播路径里塞第二个境外源",而不是"数据侧的源已换掉"(那属产品决策)。
 *
 *  ② **失败态不得产出"告警三角"这类系统故障图形**,且必须把该轮播项**整项摘掉**(内容级降级)。
 *     真机实拍 vc73-plaza.png 中央那枚橙色三角经像素归因是 `FloatBox` 的 warning toast
 *     (顶边 = 状态栏 34dp + FLOAT_BOX_TOAST_TOP_OFFSET_PX 80dp,宽 58dp = 16+18+8+16,
 *     图标 18dp = FLOAT_BOX_ICON_SIZE_PX,色 #f59e0b = tokens.warning.DEFAULT),
 *     它压在了轮播上 —— **轮播组件本身此前连一个 onError 分支都没有**,失败时营销位是空一块。
 *     所以这一维判的是"轮播实现里不许出现告警图形",而它同时把"必须挂 onError"钉成判据。
 *
 * 取证纪律(§22c):三条判据都是**一份实现、两种输入** —— 同一谓词既喂真实文件(反向对照:
 * 必须绿),也喂"修复前的形态"夹具(阳性对照:必须红)。谓词只活在测试里,生产面无对应实现,
 * 因此不存在"镜像常量漂移";但反过来,**只喂夹具不喂真文件就等于把门写成恒真**,
 * 所以下面每一维都成对给出。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// useAutoPlay 是纯逻辑(只依赖 react),必须指真实源码 —— 给它写替身测的就是替身
// (同 vitest.config.ts 里 sso-core / stores / app-control-intent 那三条收口的理由)。
vi.mock('@ihui/shared', async () => {
  const mod = (await import('../../../packages/shared/src/hooks/use-auto-play')) as {
    useAutoPlay: (total: number, interval: number, enabled: boolean) => {
      current: number
      setCurrent: (n: number) => void
    }
  }
  return { useAutoPlay: mod.useAutoPlay }
})

const REPO_ROOT = resolve(__dirname, '../../..')
const read = (relPath: string): string => readFileSync(resolve(REPO_ROOT, relPath), 'utf8')

/** 轮播的渲染路径:组件实现 + 端内自带硬编码 banner 常量的那两处。 */
const CAROUSEL_RENDER_PATH = [
  'apps/mobile-rn/src/components/Carousel.tsx',
  'apps/mobile-rn/src/components/CourseCarousel.tsx',
  'apps/mobile-rn/src/components/BottomFigure.tsx',
  'apps/mobile-rn/src/screens/MoreCourseScreen.tsx',
  'apps/miniapp-taro/src/components/Carousel.tsx',
  'apps/miniapp-taro/src/pages/community/index.tsx',
  'apps/miniapp-taro/src/pkg-learn/course-planet/index.tsx',
  'packages/shared/src/ui/carousel-spec.ts',
] as const

/** 告警/故障图形的字面量族 —— 轮播实现里出现任一即说明失败态在往营销位摆故障图标。 */
const FAILURE_GLYPHS = [
  'AlertTriangle',
  'TriangleAlert',
  'triangle-alert',
  'alert-circle',
  'AlertCircle',
] as const

/**
 * 境外随机图 / 占位图服务 —— 国内移动网络可达性不稳,轮播路径一律不得再引。
 * 每条都必须被 findOverseasImageHosts 命中(正向证明由下面的成对用例钉住):
 * 名单里躺着一条判据认不出的成员,这一维就等于没有。
 */
const OVERSEAS_IMAGE_HOSTS = [
  'picsum.photos',
  'via.placeholder.com',
  'placehold.co',
  'dummyimage.com',
  'loremflickr.com',
  'unsplash.it',
  'source.unsplash.com',
] as const

/** 仓内既有的合法图源写法(自有域名 / 国内 uniCloud CDN)—— 不得被误判。 */
const ALLOWED_IMAGE_URL_SAMPLES = [
  'https://aizhs.top/remote-images/lunbo1.png',
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/lunbo1.png',
] as const

/** 只遮注释、保留字符串:判据看的是代码面,注释里"说明这一型已被废除"不得把自己判红。 */
function stripComments(src: string): string {
  const out: string[] = []
  let inBlock = false
  for (const line of src.split('\n')) {
    if (inBlock) {
      if (line.includes('*/')) inBlock = false
      out.push('')
      continue
    }
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) {
      if (line.includes('/*') && !line.includes('*/')) inBlock = true
      out.push('')
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/** 判据 A:代码面里出现的境外图片域名(返回命中清单,空数组 = 通过)。 */
function findOverseasImageHosts(src: string): string[] {
  const code = stripComments(src)
  return OVERSEAS_IMAGE_HOSTS.filter((host) => code.includes(host))
}

/** 判据 B:代码面里出现的告警/故障图形(返回命中清单,空数组 = 通过)。 */
function findFailureGlyphs(src: string): string[] {
  const code = stripComments(src)
  return FAILURE_GLYPHS.filter((glyph) => code.includes(glyph))
}

/**
 * 判据 C:每一张轮播图都挂了失败出口。
 * 只数 `<Image ...>` 开标签,数出"有图"与"有 onError"两个量,不等即说明有一张图
 * 取不到时没人处置 —— 这正是修复前的形态(RN 端 1 处、小程序端 1 处全裸)。
 */
function countImagesWithoutErrorHook(src: string): number {
  const code = stripComments(src)
  let missing = 0
  // 单行与多行两种书写都要认:判据不认的书写形态 = 该形态整面隐身(守门 77/102 同一课)。
  const tagRe = /<(?:Image|img)\b(?:(?!>|\/>)[\s\S])*?(?:\/>|>)/g
  for (const tag of code.match(tagRe) ?? []) {
    if (!/\bsource=|\bsrc=/.test(tag)) continue
    if (!/\bonError\s*=/.test(tag)) missing += 1
  }
  return missing
}

// ───────────────────────── 真实文件面(反向对照:必须全绿) ─────────────────────────

describe('轮播渲染路径 · 真实文件面', () => {
  it('① 不存在境外硬编码图片域名', () => {
    const hits = CAROUSEL_RENDER_PATH.flatMap((p) => {
      const found = findOverseasImageHosts(read(p))
      return found.map((h) => `${p} → ${h}`)
    })
    expect(hits, `实得:${hits.join('; ')}`).toEqual([])
  })

  it('② 两端轮播实现里不存在告警/故障图形', () => {
    const components = [
      'apps/mobile-rn/src/components/Carousel.tsx',
      'apps/miniapp-taro/src/components/Carousel.tsx',
    ]
    const hits = components.flatMap((p) => findFailureGlyphs(read(p)).map((g) => `${p} → ${g}`))
    expect(hits, `实得:${hits.join('; ')}`).toEqual([])
  })

  it('③ 两端轮播实现里每张图都挂了失败出口(onError)', () => {
    for (const p of [
      'apps/mobile-rn/src/components/Carousel.tsx',
      'apps/miniapp-taro/src/components/Carousel.tsx',
    ]) {
      const src = read(p)
      // 先自证"确实扫到了图" —— 一张都没扫到时 missing 恒 0,那看着像通过而其实是判据失明。
      expect(stripComments(src), `${p} 应至少含一个 <Image> 开标签`).toMatch(/<(?:Image|img)\b/)
      expect(countImagesWithoutErrorHook(src), `${p}:未挂失败出口的 <Image> 数`).toBe(0)
    }
  })
})

// ─────────────────── 阳性对照:同一批谓词必须看得见"修复前的形态" ───────────────────
// 夹具逐字取自修复前的真实源码(git show HEAD:apps/mobile-rn/src/components/Carousel.tsx
// 的 <Image> 那一行,以及 packages/database/seed/lessons.ts 里的 picsum 串)。
// 没有这一组,上面三条可以在"判据根本匹配不到任何东西"的状态下永远绿。

describe('轮播渲染路径 · 阳性对照(修复前形态必须被同一判据命中)', () => {
  /** 修复前的 RN 渲染点:一张裸 <Image>,失败时无人处置。 */
  const BEFORE_FIX_RN_SLIDE = `
    {banner.map((item, index) => (
      <TouchableOpacity key={index} style={{ width, height }}>
        <Image source={{ uri: item.img }} style={{ width, height, resizeMode: 'cover' }} />
      </TouchableOpacity>
    ))}
  `

  /** 修复前小程序端渲染点:同样没有 onError,且把 picsum 当兜底源写进了端内。 */
  const BEFORE_FIX_TARO_SLIDE = `
    {hasImg ? (
      <Image src="https://picsum.photos/seed/car1/1200/400" mode="aspectFill" className="h-full w-full" lazyLoad />
    ) : null}
  `

  /** 把告警三角当失败占位摆进轮播 —— 本票要钉死的那一型。 */
  const FAILURE_GLYPH_IN_CAROUSEL = `
    if (failed) {
      return (
        <View style={styles.root}>
          <AlertTriangle size={28} color={tokens.warning.DEFAULT} />
          <Text>加载失败</Text>
        </View>
      )
    }
  `

  it('境外域名判据必须命中 picsum 夹具', () => {
    expect(findOverseasImageHosts(BEFORE_FIX_TARO_SLIDE)).toContain('picsum.photos')
  })

  it('境外域名判据不得误判自有域名与国内 uniCloud CDN', () => {
    for (const url of ALLOWED_IMAGE_URL_SAMPLES) {
      expect(findOverseasImageHosts(`<Image src="${url}" onError={noop} />`), url).toEqual([])
    }
  })

  it('名单里每一条都必须真能命中(否则这一维对那条域名全盲)', () => {
    for (const host of OVERSEAS_IMAGE_HOSTS) {
      const fixture = `<Image src="https://${host}/seed/a/300/300" onError={noop} />`
      expect(findOverseasImageHosts(fixture), host).toContain(host)
    }
  })

  it('失败出口判据必须命中"裸 <Image>"(修复前的真实形态)', () => {
    expect(countImagesWithoutErrorHook(BEFORE_FIX_RN_SLIDE)).toBe(1)
    expect(countImagesWithoutErrorHook(BEFORE_FIX_TARO_SLIDE)).toBe(1)
  })

  it('失败出口判据对"挂了 onError 的两种书写"都不得误判', () => {
    const singleLine = `<Image src={item.img} mode="aspectFill" onError={() => mark(uri)} />`
    const multiLine = `
      <Image
        source={{ uri: item.img }}
        onError={() => markSourceFailed(item.img)}
        style={{ width, height }}
      />
    `
    expect(countImagesWithoutErrorHook(singleLine)).toBe(0)
    expect(countImagesWithoutErrorHook(multiLine)).toBe(0)
  })

  it('告警图形判据必须命中"把三角摆进轮播"的那一型', () => {
    expect(findFailureGlyphs(FAILURE_GLYPH_IN_CAROUSEL)).toContain('AlertTriangle')
  })

  it('注释里解释这一型不得被判成违规(判据看代码面,不看散文)', () => {
    const onlyExplains = `
      // 真机实拍的那枚橙色告警三角不是这里产的,它来自 AlertTriangle 那一族 toast。
      /** TriangleAlert / triangle-alert 均不得出现在失败态 */
      const a = 1
    `
    expect(findFailureGlyphs(onlyExplains)).toEqual([])
  })
})

// ─────────────── 行为面:真渲染 —— 失败项整项摘掉,且屏幕上没有任何告警图形 ───────────────

describe('RN Carousel · 图源失败时的实际渲染', () => {
  type Slide = { img: string; title?: string }
  let Carousel: (props: {
    banner: Slide[]
    onItemPress?: (item: Slide, index: number) => void
  }) => ReactElement

  beforeEach(async () => {
    // jsdom 不实现 Element.scrollTo,而真实 RN 有;轮播挂载即调一次,
    // 缺这一层会让断言崩在 effect 里,表现为"环境故障"而不是"判据红"。
    HTMLElement.prototype.scrollTo = vi.fn() as unknown as typeof HTMLElement.prototype.scrollTo
    const mod = await import('../src/components/Carousel')
    Carousel = mod.default as typeof Carousel
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const BANNER = [
    { img: 'https://aizhs.top/banner/a.png', title: 'A' },
    { img: 'https://aizhs.top/banner/b.png', title: 'B' },
  ]

  it('一张图失败 ⇒ 摘掉的是**那一张**,指示点与点击回调同步', async () => {
    const pressed: Array<{ img: string }> = []
    const { container } = render(
      createElement(Carousel, {
        banner: BANNER,
        onItemPress: (item: { img: string }) => pressed.push(item),
      }),
    )
    // 替身把 TouchableOpacity 渲成 <button>、Image 渲成 <img>,所以两者可分别定位。
    expect(container.querySelectorAll('img')).toHaveLength(2)

    fireEvent.error(container.querySelectorAll('img')[0] as HTMLElement)

    const left = container.querySelectorAll('img')
    expect(left).toHaveLength(1)
    // 剩下的那一项必须是没失败过的 B —— 用点击回调证明身份,不靠 DOM 属性
    // (RN 的 source={{uri}} 在替身里落不成可断言的 src)。
    fireEvent.click(container.querySelectorAll('button')[0] as HTMLElement)
    expect(pressed).toEqual([{ img: 'https://aizhs.top/banner/b.png', title: 'B' }])
  })

  it('全部图失败 ⇒ 落到文字占位,屏幕上不得出现任何 svg 告警图形', async () => {
    const { container, getByText } = render(createElement(Carousel, { banner: BANNER }))
    // 逐项摘除会重排 DOM(下标即 key),所以只能"每次重新取第一个"而不是先快照再遍历;
    // guard 用来证明是"被摘完"而不是"循环上限救场" —— 上限命中即断言失败。
    let guard = 0
    while (container.querySelectorAll('img').length > 0 && guard < BANNER.length) {
      fireEvent.error(container.querySelectorAll('img')[0] as HTMLElement)
      guard += 1
    }
    expect(guard, '两张图应各自被摘掉一次').toBe(BANNER.length)
    expect(container.querySelectorAll('img')).toHaveLength(0)
    // 占位是文字卡(内容级),不是图形故障态。
    expect(getByText('暂无轮播图')).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()
    expect(container.textContent).not.toMatch(/加载失败/)
  })

  it('空 banner 时行为不变(仍走同一文字占位,不因本次改动而多一条分支)', async () => {
    const { getByText } = render(createElement(Carousel, { banner: [] }))
    expect(getByText('暂无轮播图')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
