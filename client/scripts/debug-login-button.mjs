import puppeteer from 'puppeteer'

const BASE = 'http://127.0.0.1:8888'

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-cache', '--disk-cache-size=1']
})

const page = await browser.newPage()
await page.setCacheEnabled(false)
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('darkMode', 'dark')
})

// 触发登录弹窗
const cacheBuster = '?t=' + Date.now()
await page.goto(BASE + '/ai-community' + cacheBuster, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise(r => setTimeout(r, 2500))

// 点击"登录/注册"按钮打开登录弹窗
const opened = await page.evaluate(() => {
  const btn = document.querySelector('.login-button')
  if (btn) {
    btn.click()
    return true
  }
  return false
})
console.log('点击登录按钮:', opened)
await new Promise(r => setTimeout(r, 2000))

// 查找"立即登录"按钮
const result = await page.evaluate(() => {
  // 找所有包含"立即登录"文字的元素
  const all = document.querySelectorAll('button, span, .el-button, [class*="submit"], [class*="login-btn"]')
  const results = []
  for (const el of all) {
    const text = (el.textContent || '').trim()
    if (text === '立即登录' || text === '立即注册' || text === '登录/注册') {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0) continue
      const cs = getComputedStyle(el)
      // 向上找父按钮
      let parentBtn = el
      while (parentBtn && parentBtn.tagName !== 'BUTTON' && parentBtn.tagName !== 'DIV') {
        parentBtn = parentBtn.parentElement
      }
      const parentCs = parentBtn ? getComputedStyle(parentBtn) : null
      results.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 80),
        text,
        color: cs.color,
        bg: cs.backgroundColor,
        parentTag: parentBtn?.tagName.toLowerCase(),
        parentCls: String(parentBtn?.className || '').slice(0, 80),
        parentBg: parentCs?.backgroundColor,
        parentColor: parentCs?.color,
        borderColor: parentCs?.borderColor,
      })
    }
  }
  return results
})

console.log('找到"立即登录"相关元素:')
console.log(JSON.stringify(result, null, 2))

// 截图
await page.screenshot({ path: 'g:/IHUI-AI/debug-login-dialog.png', fullPage: false })

await browser.close()
