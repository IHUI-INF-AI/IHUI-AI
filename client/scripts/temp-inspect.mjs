import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

await page.evaluateOnNewDocument(() => {
  document.documentElement.classList.add('dark')
})

await page.goto('http://127.0.0.1:8888/', { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))

// Open login
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button, a'))
  const target = btns.find((b) => (b.textContent || '').trim() === '登录/注册')
  if (target) target.click()
})
await new Promise((r) => setTimeout(r, 1500))

// Switch to phone tab
await page.evaluate(() => {
  const tabs = Array.from(document.querySelectorAll('.segment-tab, button'))
  const phoneTab = tabs.find((t) => (t.textContent || '').includes('手机登录') || (t.textContent || '').includes('手机注册'))
  if (phoneTab) phoneTab.click()
})
await new Promise((r) => setTimeout(r, 800))

// Inspect sms-code layout
const layout = await page.evaluate(() => {
  const inputWrap = document.querySelector('.sms-code-input')
  if (!inputWrap) return { error: 'sms-code-input not found' }
  const cs = getComputedStyle(inputWrap)
  const input = inputWrap.querySelector('.el-input')
  const inputInner = inputWrap.querySelector('.el-input__wrapper')
  const btn = inputWrap.querySelector('.el-button')
  const csInput = input ? getComputedStyle(input) : null
  const csInner = inputInner ? getComputedStyle(inputInner) : null
  const csBtn = btn ? getComputedStyle(btn) : null
  return {
    container: { display: cs.display, alignItems: cs.alignItems, gap: cs.gap, height: inputWrap.offsetHeight },
    input: input ? { height: input.offsetHeight, h: csInput?.height } : null,
    inputInner: inputInner ? { height: inputInner.offsetHeight, h: csInner?.height } : null,
    button: btn ? { height: btn.offsetHeight, h: csBtn?.height, lineHeight: csBtn?.lineHeight, padding: csBtn?.padding, display: csBtn?.display } : null,
  }
})
console.log('SMS code layout:')
console.log(JSON.stringify(layout, null, 2))

// Inspect phone input row (for comparison)
const phoneInput = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('.el-input'))
  if (inputs.length === 0) return { error: 'no input' }
  const phoneEl = inputs[0]
  const wrapper = phoneEl.querySelector('.el-input__wrapper')
  return {
    height: phoneEl.offsetHeight,
    wrapperHeight: wrapper?.offsetHeight,
  }
})
console.log('\nPhone input height:', JSON.stringify(phoneInput))

await page.screenshot({ path: 'C:\\Users\\Administrator\\AppData\\Local\\Temp\\phone-tab-current.png', fullPage: false })

await browser.close()
console.log('Done')
