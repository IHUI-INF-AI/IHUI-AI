// 最终验证:用 SVG class 名匹配 + quoted-preview 定位详情
import puppeteer from 'puppeteer'

const URL = 'http://localhost:8888/'

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 1000 })

  console.log('[1] 打开页面')
  await page.goto(URL, { waitUntil: 'load', timeout: 120000 })
  await page.waitForSelector('#app > *', { timeout: 60000 })
  await sleep(8000)

  console.log('[2] 点击"选择模型"')
  await page.evaluate(() => {
    const panel = document.querySelector('.ai-side-panel-empty')
    const btns = Array.from(panel?.querySelectorAll('button') || [])
    btns.find((b) => (b.textContent || '').trim() === '选择模型')?.click()
  })
  await sleep(2000)
  await page.keyboard.press('Escape')
  await sleep(1500)

  // 注入消息
  console.log('[3] 注入测试消息')
  const injected = await page.evaluate(() => {
    const header = document.querySelector('.dialog-header')
    const c = header.__vueParentComponent
    let cur = c
    for (let i = 0; i < 30 && cur; i++) {
      const s = cur.setupState
      if (s && 'messages' in s) {
        let m = s.messages
        if (m && m.__v_isRef) m = m.value
        if (!Array.isArray(m)) return { error: 'not array' }
        m.length = 0
        m.push({
          id: 'test-user-1', role: 'user',
          content: '你好,这是一条用户测试消息',
          status: 'sent', createTime: Date.now(), liked: false,
        })
        m.push({
          id: 'test-ai-1', role: 'assistant',
          content: '你好!我是 AI 助手,这是一条 AI 测试回复。',
          status: 'sent', createTime: Date.now(), liked: false, isStreaming: false,
        })
        return { injected: true, count: m.length }
      }
      cur = cur.parent
    }
    return { error: 'not found' }
  })
  console.log('  ', injected)
  await sleep(2000)

  // 验证 message-action-btn (用 class 名识别图标)
  console.log('\n[4] 验证 message-action-btn 图标 (用 SVG class 名)')
  const btns = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.message-action-btn'))
    return buttons.map((btn) => {
      const title = btn.getAttribute('title') || ''
      const svg = btn.querySelector('svg')
      const svgClass = svg?.getAttribute('class') || ''
      return { title, svgClass }
    })
  })
  console.log('  message-action-btn count:', btns.length)

  const likeBtns = btns.filter((b) => /点赞|unlike|Like/i.test(b.title))
  const replyBtns = btns.filter((b) => /引用回复|Reply/i.test(b.title))

  console.log(`\n  点赞按钮: ${likeBtns.length} 个`)
  let likePass = false
  likeBtns.forEach((b) => {
    const isThumbsUp = /lucide-thumbs-up/.test(b.svgClass)
    const isStar = /lucide-star/.test(b.svgClass)
    console.log(`    - title="${b.title}" class="${b.svgClass}"`)
    console.log(`      → thumbsUp=${isThumbsUp} star=${isStar}`)
    if (isThumbsUp && !isStar) likePass = true
  })

  console.log(`\n  引用回复按钮: ${replyBtns.length} 个 (期望 ≥ 2)`)
  let replyPass = true
  let replyCount = 0
  replyBtns.forEach((b) => {
    const isQuote = /lucide-quote\b/.test(b.svgClass)
    const isMessageCircle = /lucide-message-circle/.test(b.svgClass)
    console.log(`    - title="${b.title}" class="${b.svgClass}"`)
    console.log(`      → quote=${isQuote} msgCircle=${isMessageCircle}`)
    if (isQuote && !isMessageCircle) replyCount++
    else replyPass = false
  })
  if (replyCount < 2) replyPass = false

  // 点击引用回复,验证 quoted-preview
  console.log('\n[5] 点击引用回复按钮')
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.message-action-btn'))
    const reply = buttons.find((b) => /引用回复|Reply/i.test(b.getAttribute('title') || ''))
    reply?.click()
  })
  await sleep(1500)

  // quoted-preview 详细定位
  const qpDetail = await page.evaluate(() => {
    const qp = document.querySelector('.quoted-preview')
    if (!qp) return { exists: false }
    const wrapper = qp.closest('.input-wrapper')
    const qpRect = qp.getBoundingClientRect()
    const wrapperRect = wrapper?.getBoundingClientRect()
    const qpStyle = getComputedStyle(qp)
    const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null
    return {
      exists: true,
      inInputWrapper: !!wrapper,
      qpRect: { top: Math.round(qpRect.top), left: Math.round(qpRect.left), width: Math.round(qpRect.width), height: Math.round(qpRect.height) },
      wrapperRect: wrapperRect ? { top: Math.round(wrapperRect.top), left: Math.round(wrapperRect.left), width: Math.round(wrapperRect.width), height: Math.round(wrapperRect.height) } : null,
      qpPadding: qpStyle.padding,
      qpMargin: qpStyle.margin,
      qpBorderRadius: qpStyle.borderRadius,
      qpBorderBottom: qpStyle.borderBottom,
      qpBg: qpStyle.backgroundColor,
      wrapperPadding: wrapperStyle?.padding,
      wrapperBorderRadius: wrapperStyle?.borderRadius,
      wrapperOverflow: wrapperStyle?.overflow,
      wrapperBg: wrapperStyle?.backgroundColor,
      content: (qp.querySelector('.quoted-preview-content')?.textContent || '').slice(0, 80),
    }
  })
  console.log('  quoted-preview 详情:')
  console.log('  ', JSON.stringify(qpDetail, null, 2))

  // 判断 quoted-preview 是否视觉上属于 input-wrapper
  // 合理: qp 在 wrapper 内, qp.left >= wrapper.left, qp.right <= wrapper.right (允许 1px 误差)
  let quotedPass = false
  if (qpDetail.exists && qpDetail.inInputWrapper && qpDetail.wrapperRect) {
    const qpR = qpDetail.qpRect
    const wR = qpDetail.wrapperRect
    const qpRight = qpR.left + qpR.width
    const qpBottom = qpR.top + qpR.height
    const wRight = wR.left + wR.width
    const wBottom = wR.top + wR.height
    const insideHorizontally = qpR.left >= wR.left - 2 && qpRight <= wRight + 2
    const insideVertically = qpR.top >= wR.top - 2 && qpBottom <= wBottom + 2
    quotedPass = insideHorizontally && insideVertically
    console.log(`\n  qp 在 wrapper 范围内: horizontal=${insideHorizontally} vertical=${insideVertically}`)
    console.log(`  qp.left(${qpR.left}) vs wrapper.left(${wR.left}) 差值=${qpR.left - wR.left}px`)
    console.log(`  qp.width(${qpR.width}) vs wrapper.width(${wR.width}) 差值=${qpR.width - wR.width}px`)
    console.log(`  qp 在 wrapper 顶部 (top 差=${qpR.top - wR.top}px), 被 overflow:hidden 裁剪顶部圆角`)
  }

  // 截图
  await page.screenshot({ path: 'G:/IHUI-AI/client/verify-reply-icons-final.png', fullPage: false })
  console.log('\n[6] 截图: verify-reply-icons-final.png')

  // 汇总
  console.log('\n=== 最终验证结果 ===')
  console.log(`  [${likePass ? '✓ PASS' : '✗ FAIL'}] 点赞按钮使用 ThumbsUp 图标 (class: lucide-thumbs-up)`)
  console.log(`  [${replyPass ? '✓ PASS' : '✗ FAIL'}] 两个引用回复按钮都使用 Quote 图标 (class: lucide-quote), 数量=${replyCount}`)
  console.log(`  [${quotedPass ? '✓ PASS' : '✗ FAIL'}] 引用预览在 input-wrapper 内 (视觉上是输入框的一部分)`)
} catch (err) {
  console.error('ERROR:', err.message)
  console.error(err.stack)
} finally {
  await browser.close()
}
