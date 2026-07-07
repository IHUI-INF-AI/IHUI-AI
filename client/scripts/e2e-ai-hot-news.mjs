/**
 * AI HOT 资讯 E2E 测试 (Puppeteer)
 *
 * 测试项:
 *   1. 页面加载, AI资讯 Tab 默认激活
 *   2. .ai-hot-bar 存在且 >=3 条热点
 *   3. .ai-cat-bar 6 个分类标签可见
 *   4. .news-hero__hot 最热徽章存在
 *   5. .news-list-item__cover img 配图 naturalWidth > 0
 *   6. .ai-daily-panel 日报面板存在
 *   7. .ai-hot-bar__search 搜索框存在
 *   8. 点击"加载更多"后列表条目数增加
 *   9. /aihot-api/api/public/items 网络请求返回 200
 *
 * 用法: node scripts/e2e-ai-hot-news.mjs
 * 前置: dev server 运行在 http://127.0.0.1:8888/
 */
import puppeteer from 'puppeteer'

const BASE = 'http://127.0.0.1:8888/'
const TIMEOUT = 15000

async function waitForAiHot(page) {
  await page.waitForSelector('.news-magazine', { timeout: TIMEOUT, visible: true })
  // 额外等待 aihot 数据加载
  await new Promise(r => setTimeout(r, 5000))
}

async function runTests() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  
  const results = { passed: 0, failed: 0, tests: [] }
  
  function assert(name, condition, detail = '') {
    if (condition) {
      results.passed++
      results.tests.push({ name, status: 'PASS', detail })
    } else {
      results.failed++
      results.tests.push({ name, status: 'FAIL', detail })
    }
  }

  try {
    // 监听网络请求
    let aihotApiStatus = null
    page.on('response', (res) => {
      if (res.url().includes('/aihot-api/api/public/items')) {
        aihotApiStatus = res.status()
      }
    })

    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 })
    await waitForAiHot(page)

    // Test 1: AI资讯 Tab 默认激活
    const activeTab = await page.$eval('.news-tabs__item--active', el => el.textContent.trim()).catch(() => '')
    assert('AI资讯 Tab 默认激活', activeTab === 'AI资讯', `实际: ${activeTab}`)

    // Test 2: ai-hot-bar 存在且 >=3 条
    const hotItemsCount = await page.$$eval('.ai-hot-bar__item', els => els.length).catch(() => 0)
    assert('今日热点 >=3 条', hotItemsCount >= 3, `实际: ${hotItemsCount}`)

    // Test 3: 分类标签 6 个
    const catCount = await page.$$eval('.ai-cat-bar__item', els => els.length).catch(() => 0)
    assert('分类标签 6 个', catCount >= 6, `实际: ${catCount}`)

    // Test 4: 最热徽章
    const hotBadge = await page.$('.news-hero__hot')
    assert('最热徽章存在', !!hotBadge)

    // Test 5: 配图加载
    const imgLoaded = await page.$$eval('.news-list-item__cover img', imgs => 
      imgs.filter(img => img.naturalWidth > 0).length
    ).catch(() => 0)
    assert('列表配图已加载', imgLoaded > 0, `已加载: ${imgLoaded}`)

    // Test 6: 日报面板
    const dailyPanel = await page.$('.ai-daily-panel')
    assert('日报面板存在', !!dailyPanel)

    // Test 7: 搜索框
    const searchInput = await page.$('.ai-hot-bar__search-input')
    assert('搜索框存在', !!searchInput)

    // Test 8: 加载更多
    const beforeCount = await page.$$eval('.news-list-item', els => els.length).catch(() => 0)
    const loadMoreBtn = await page.$('.ai-load-more__btn')
    if (loadMoreBtn) {
      await loadMoreBtn.click()
      await new Promise(r => setTimeout(r, 3000))
      const afterCount = await page.$$eval('.news-list-item', els => els.length).catch(() => 0)
      assert('加载更多增加条目', afterCount > beforeCount, `之前: ${beforeCount}, 之后: ${afterCount}`)
    } else {
      assert('加载更多按钮存在', false, '按钮未找到')
    }

    // Test 9: API 请求返回 200
    assert('aihot API 返回 200', aihotApiStatus === 200, `状态: ${aihotApiStatus}`)

  } catch (err) {
    assert('测试执行', false, err.message)
  } finally {
    await browser.close()
  }

  // 输出结果
  console.log('\n=== AI HOT 资讯 E2E 测试 ===\n')
  for (const t of results.tests) {
    const icon = t.status === 'PASS' ? '✓' : '✗'
    const color = t.status === 'PASS' ? '\x1b[32m' : '\x1b[31m'
    console.log(`${color}${icon}\x1b[0m ${t.name}${t.detail ? ` (${t.detail})` : ''}`)
  }
  console.log(`\n通过: ${results.passed}, 失败: ${results.failed}\n`)
  process.exit(results.failed > 0 ? 1 : 0)
}

runTests().catch(err => {
  console.error('测试运行失败:', err)
  process.exit(1)
})
