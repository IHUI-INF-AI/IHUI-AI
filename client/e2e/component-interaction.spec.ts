import { test, expect } from '@playwright/test'

// 鐜鍣０杩囨护
const NOISE_PATTERNS = ['WebSocket', 'vite', 'ws://', 'wss://', 'Failed to fetch', 'NetworkError', 'ERR_CONNECTION', 'net::ERR', 'favicon', 'service-worker', 'ResizeObserver']
const isNoise = (t: string) => NOISE_PATTERNS.some(p => t.includes(p))

// 鍦ㄦ墍鏈夋祴璇曞墠璁剧疆 localStorage,闃绘鎺ㄥ箍寮圭獥鏄剧ず
test.beforeEach(async ({ page: p }) => {
  await p.addInitScript(() => {
    // 璁剧疆鎺ㄥ箍寮圭獥宸插叧闂椂闂存埑(褰撳墠鏃堕棿),闃绘 24 灏忔椂鍐呭啀娆℃樉绀?
    localStorage.setItem('promotion-modal-dismissed-time', Date.now().toString())
    // 璁剧疆浼氳瘽绾ф爣璁?闃绘褰撳墠浼氳瘽鏄剧ず
    sessionStorage.setItem('promotion-modal-session-shown', 'true')
  })
})

// 鍏抽棴鍙兘鍑虹幇鐨勬帹骞垮脊绐?閬僵
async function dismissPromotionModal(p: import('@playwright/test').Page) {
  // 灏濊瘯鎸?ESC 鍏抽棴
  await p.keyboard.press('Escape').catch(() => {})
  await p.waitForTimeout(300)
  // 灏濊瘯鐐瑰嚮閬僵澶栧尯鍩熷叧闂?
  const overlay = p.locator('.promotion-modal-overlay:visible').first()
  if (await overlay.count() > 0) {
    await p.evaluate(() => {
      const el = document.querySelector('.promotion-modal-overlay') as HTMLElement
      if (el) el.click()
    }).catch(() => {})
    await p.waitForTimeout(300)
  }
  // 鍐嶆鎸?ESC
  await p.keyboard.press('Escape').catch(() => {})
  await p.waitForTimeout(300)
}

test.describe('缁勪欢浜や簰妫€鏌?, () => {

  test('涓婚鍒囨崲:浜壊鈫掓殫鑹测啋浜壊', async ({ page: p }) => {
    const errors: string[] = []
    p.on('pageerror', e => { if (!isNoise(e.message)) errors.push(e.message) })

    await p.goto('/', { waitUntil: 'domcontentloaded' })


    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(2000)
    await dismissPromotionModal(p)

    // 鍒濆搴斾负浜壊
    const initialDark = await p.evaluate(() => document.documentElement.classList.contains('dark'))

    // 妗岄潰绔敤 .theme-toggle-fallback,绉诲姩绔彍鍗曠敤 .theme-toggle
    const themeToggle = p.locator('.theme-toggle-fallback:visible, .theme-toggle:visible').first()
    await expect(themeToggle).toBeVisible({ timeout: 10000 })

    // 鍒囨崲鍒版殫鑹?
    await themeToggle.click()
    await p.waitForTimeout(1000)
    const afterClickDark = await p.evaluate(() => document.documentElement.classList.contains('dark'))

    // 鍒囨崲鍥炴潵
    await themeToggle.click()
    await p.waitForTimeout(1000)
    const afterSecondClickDark = await p.evaluate(() => document.documentElement.classList.contains('dark'))

    console.log(`[涓婚鍒囨崲] 鍒濆dark=${initialDark} 鐐瑰嚮鍚巇ark=${afterClickDark} 鍐嶇偣鍑诲悗dark=${afterSecondClickDark}`)

    // 鑷冲皯搴旇鏈夊彉鍖?鍒囨崲鐢熸晥)
    expect(afterClickDark !== initialDark || afterSecondClickDark !== afterClickDark).toBeTruthy()
  })

  test('璇█鍒囨崲涓嬫媺鑿滃崟', async ({ page: p }) => {
    await p.goto('/', { waitUntil: 'domcontentloaded' })

    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(2000)
    await dismissPromotionModal(p)

    // 鎵惧埌璇█鍒囨崲鎸夐挳(鍖呭惈"绠€浣撲腑鏂?鎴栬瑷€鍥炬爣)
    const langBtn = p.locator('button:has-text("绠€浣撲腑鏂?), [aria-label*="璇█"], [aria-label*="language"], .language-switcher').first()
    const langBtnExists = await langBtn.count()

    if (langBtnExists > 0) {
      await langBtn.click()
      await p.waitForTimeout(500)

      // 妫€鏌ヤ笅鎷夎彍鍗曟槸鍚﹀嚭鐜?
      const dropdown = p.locator('.el-dropdown-menu:visible, .el-select-dropdown:visible').first()
      const dropdownVisible = await dropdown.count()

      if (dropdownVisible > 0) {
        // 妫€鏌ヨ彍鍗曢」鏂囧瓧鏄惁鍙(瀵规瘮搴?
        const items = dropdown.locator('.el-dropdown-menu__item, .el-select-dropdown__item')
        const itemCount = await items.count()
        console.log(`[璇█鍒囨崲] 涓嬫媺鑿滃崟鍑虹幇, ${itemCount}涓€夐」`)

        // 妫€鏌ヨ彍鍗曢」鏂囧瓧棰滆壊涓庤儗鏅姣斿害
        const contrastOk = await dropdown.evaluate((el) => {
          const cs = getComputedStyle(el)
          const bg = cs.backgroundColor
          const items = el.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item')
          if (items.length === 0) return true
          const itemCs = getComputedStyle(items[0])
          const color = itemCs.color
          // 绠€鍗曟鏌?涓嶆槸鍚岃壊
          return color !== bg
        })
        expect(contrastOk).toBeTruthy()
        console.log(`[璇█鍒囨崲] 鑿滃崟椤瑰姣斿害OK=${contrastOk}`)
      } else {
        console.log('[璇█鍒囨崲] 涓嬫媺鑿滃崟鏈嚭鐜?鍙兘鐢ㄥ叾浠栨柟寮?')
      }
    } else {
      console.log('[璇█鍒囨崲] 鏈壘鍒拌瑷€鍒囨崲鎸夐挳,璺宠繃')
    }
  })

  test('鎼滅储鍔熻兘', async ({ page: p }) => {
    await p.goto('/', { waitUntil: 'domcontentloaded' })

    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(2000)
    await dismissPromotionModal(p)

    // 鎵惧埌鎼滅储鎸夐挳
    const searchBtn = p.locator('button:has-text("鎼滅储"), [aria-label*="鎼滅储"], [aria-label*="search"], .search-btn, .header-search, .search-trigger').first()
    const searchBtnExists = await searchBtn.count()

    if (searchBtnExists > 0) {
      await searchBtn.click()
      await p.waitForTimeout(1000)

      // 妫€鏌ユ悳绱㈡鏄惁鍑虹幇
      const searchInput = p.locator('input[placeholder*="鎼滅储"], input[placeholder*="search"], .search-input input, .el-input__inner:visible').first()
      const inputExists = await searchInput.count()

      if (inputExists > 0) {
        // 妫€鏌ヨ緭鍏ユ鍙鎬?
        const inputVisible = await searchInput.evaluate((el: HTMLInputElement) => {
          const cs = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return cs.visibility !== 'hidden' && cs.display !== 'none' && rect.width > 0 && rect.height > 0
        })
        expect(inputVisible).toBeTruthy()
        console.log('[鎼滅储] 鎼滅储妗嗗彲瑙?)

        // 灏濊瘯杈撳叆
        await searchInput.fill('娴嬭瘯')
        await p.waitForTimeout(500)
        const inputValue = await searchInput.inputValue()
        expect(inputValue).toBe('娴嬭瘯')
        console.log('[鎼滅储] 杈撳叆鍔熻兘姝ｅ父')
      } else {
        console.log('[鎼滅储] 鎼滅储妗嗘湭鍑虹幇')
      }
    } else {
      console.log('[鎼滅储] 鏈壘鍒版悳绱㈡寜閽?璺宠繃')
    }
  })

  test('鐧诲綍椤佃〃鍗?, async ({ page: p }) => {
    await p.goto('/login', { waitUntil: 'domcontentloaded' })

    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    // 鐧诲綍椤典娇鐢ㄥ紓姝ョ粍浠?闇€瑕佹洿闀跨瓑寰呮椂闂?
    await p.waitForTimeout(4000)

    // 妫€鏌ョ櫥褰曡〃鍗曠殑杈撳叆妗?杩囨护鎺?opacity:0 鐨勯殣钘忓厓绱?
    const inputs = p.locator('input:visible')
    await p.waitForTimeout(1000)
    const inputCount = await inputs.count()
    console.log(`[鐧诲綍琛ㄥ崟] 鎵惧埌${inputCount}涓彲瑙佽緭鍏ユ`)

    // 鍏堟敹闆嗘墍鏈夎緭鍏ユ淇℃伅
    const allInputInfos: Array<{
      index: number
      id: string
      name: string
      type: string
      className: string
      width: number
      height: number
      color: string
      bg: string
      opacity: string
      visibility: string
      display: string
      parentClass: string
    }> = []

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)
      const info = await input.evaluate((el: HTMLInputElement) => {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          id: el.id || '',
          name: el.name || '',
          type: el.type || '',
          className: el.className || '',
          width: rect.width,
          height: rect.height,
          color: cs.color,
          bg: cs.backgroundColor,
          opacity: cs.opacity,
          visibility: cs.visibility,
          display: cs.display,
          parentClass: el.parentElement?.className || '',
        }
      })
      allInputInfos.push({ index: i, ...info })
      console.log(`[鐧诲綍琛ㄥ崟] 杈撳叆妗?{i}: id="${info.id}" name="${info.name}" type="${info.type}" ${info.width}x${info.height} opacity=${info.opacity} parent="${info.parentClass.slice(0, 50)}"`)
    }

    // 妫€鏌ユ瘡涓緭鍏ユ鐨勫彲瑙佹€?杈规銆佹枃瀛?,璺宠繃闅愯棌鍏冪礌鍜岀壒娈婄被鍨?
    let checkedCount = 0
    for (const info of allInputInfos) {
      // 璺宠繃闅愯棌鍏冪礌(opacity:0 鎴?visibility:hidden 鎴?display:none)
      if (info.opacity === '0' || info.visibility === 'hidden' || info.display === 'none') {
        console.log(`[鐧诲綍琛ㄥ崟] 杈撳叆妗?{info.index} 鏄殣钘忓厓绱?璺宠繃`)
        continue
      }

      // 璺宠繃 checkbox/radio 绫诲瀷(瀹藉害灏忔槸姝ｅ父鐨?
      if (info.type === 'checkbox' || info.type === 'radio') {
        console.log(`[鐧诲綍琛ㄥ崟] 杈撳叆妗?{info.index} 鏄?${info.type},璺宠繃灏哄妫€鏌)
        continue
      }

      // 璺宠繃瀹藉害涓?0 鐨勫厓绱?
      if (info.width === 0) {
        console.log(`[鐧诲綍琛ㄥ崟] 杈撳叆妗?{info.index} 瀹藉害涓?0,璺宠繃`)
        continue
      }

      // 璺宠繃 el-select 鍐呴儴鐨?input(杩欎簺鏄?Element Plus select 缁勪欢鐨勮緟鍔?input,涓嶆槸鐢ㄦ埛杈撳叆妗?
      if (info.parentClass.includes('el-select') || info.className.includes('el-select')) {
        console.log(`[鐧诲綍琛ㄥ崟] 杈撳叆妗?{info.index} 鏄?el-select 鍐呴儴 input,璺宠繃灏哄妫€鏌)
        continue
      }

      // 璺宠繃楠岃瘉鐮佽緭鍏ユ(姣忎釜妗嗗彧杈撳叆涓€涓暟瀛?瀹藉害灏忔槸姝ｅ父鐨?
      if (info.id.startsWith('verification-code-') || info.parentClass.includes('verification-code-inputs')) {
        console.log(`[鐧诲綍琛ㄥ崟] 杈撳叆妗?{info.index} 鏄獙璇佺爜杈撳叆妗?璺宠繃灏哄妫€鏌)
        continue
      }

      checkedCount++
      // 鏂囨湰杈撳叆妗嗗簲璇ユ湁瓒冲澶у皬
      expect(info.width).toBeGreaterThan(50)
      expect(info.height).toBeGreaterThan(20)
    }
    console.log(`[鐧诲綍琛ㄥ崟] 瀹為檯妫€鏌ヤ簡 ${checkedCount} 涓湁鏁堣緭鍏ユ`)

    // 妫€鏌ョ櫥褰曟寜閽?
    const loginBtn = p.locator('button:has-text("鐧诲綍"), button:has-text("娉ㄥ唽"), button:has-text("Login"), .login-btn, [type="submit"]').first()
    const btnExists = await loginBtn.count()
    if (btnExists > 0) {
      const btnInfo = await loginBtn.evaluate((el: HTMLButtonElement) => {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          color: cs.color,
          bg: cs.backgroundColor,
        }
      })
      console.log(`[鐧诲綍琛ㄥ崟] 鐧诲綍鎸夐挳: ${btnInfo.width}x${btnInfo.height} color=${btnInfo.color} bg=${btnInfo.bg}`)

      // 鎸夐挳鏂囧瓧涓庤儗鏅笉鑳藉悓鑹?
      expect(btnInfo.color !== btnInfo.bg || btnInfo.bg === 'rgba(0, 0, 0, 0)').toBeTruthy()
      // 鎸夐挳搴旇鏈夎冻澶熷ぇ灏?
      expect(btnInfo.height).toBeGreaterThanOrEqual(28)
    }
  })

  test('瀵艰埅鑿滃崟灞曞紑(鏇村鍔熻兘)', async ({ page: p }) => {
    await p.goto('/', { waitUntil: 'domcontentloaded' })

    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(2000)
    // 鍏抽棴鎺ㄥ箍寮圭獥
    await dismissPromotionModal(p)

    // 鎵惧埌"鏇村鍔熻兘"鎴栫被浼肩殑涓嬫媺瑙﹀彂鍣?
    const moreBtn = p.locator('button:has-text("鏇村"), [aria-label*="鏇村"], .more-btn, .nav-more').first()
    const moreBtnExists = await moreBtn.count()

    if (moreBtnExists > 0) {
      // 鍏堟粴鍔ㄥ埌鎸夐挳浣嶇疆,纭繚涓嶈閬尅
      await moreBtn.scrollIntoViewIfNeeded().catch(() => {})
      await p.waitForTimeout(300)

      // 浣跨敤 force click 閬垮厤琚叾浠栧厓绱犳嫤鎴?
      await moreBtn.click({ force: true }).catch(async () => {
        // 濡傛灉 force click 涔熷け璐?灏濊瘯鐢?JS 鐐瑰嚮
        await moreBtn.evaluate((el: HTMLElement) => el.click())
      })
      await p.waitForTimeout(500)

      // 妫€鏌ヤ笅鎷夎彍鍗?
      const dropdown = p.locator('.el-dropdown-menu:visible, .el-popover:visible, .more-menu:visible').first()
      const dropdownVisible = await dropdown.count()

      if (dropdownVisible > 0) {
        // 妫€鏌ヨ彍鍗曢」鏂囧瓧鍙鎬?
        const items = dropdown.locator('a, button, .el-dropdown-menu__item, .nav-item')
        const itemCount = await items.count()
        console.log(`[瀵艰埅鏇村] 涓嬫媺鑿滃崟鍑虹幇, ${itemCount}涓€夐」`)

        // 妫€鏌ョ涓€椤圭殑鏂囧瓧瀵规瘮搴?
        if (itemCount > 0) {
          const contrastOk = await items.first().evaluate((el: HTMLElement) => {
            const cs = getComputedStyle(el)
            const parent = el.parentElement
            const parentCs = parent ? getComputedStyle(parent) : null
            const color = cs.color
            const bg = parentCs?.backgroundColor || cs.backgroundColor
            return color !== bg
          })
          expect(contrastOk).toBeTruthy()
          console.log('[瀵艰埅鏇村] 鑿滃崟椤瑰姣斿害OK')
        }
      } else {
        console.log('[瀵艰埅鏇村] 涓嬫媺鑿滃崟鏈嚭鐜?)
      }
    } else {
      console.log('[瀵艰埅鏇村] 鏈壘鍒?鏇村"鎸夐挳,璺宠繃')
    }
  })

  test('宸ュ叿椤垫帓搴忎笅鎷?, async ({ page: p }) => {
    await p.goto('/tools', { waitUntil: 'domcontentloaded' })

    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(2000)

    // 鎵惧埌鎺掑簭閫夋嫨鍣?Tools.vue 浣跨敤 select.toolbar-sort)
    const sortSelect = p.locator('.toolbar-sort, select[class*="sort"]').first()
    const sortSelectExists = await sortSelect.count()

    if (sortSelectExists > 0) {
      // 鍏堟粴鍔ㄥ埌閫夋嫨鍣ㄤ綅缃?纭繚涓嶈 header 閬尅
      await sortSelect.scrollIntoViewIfNeeded().catch(() => {})
      await p.waitForTimeout(300)

      // 妫€鏌ラ€夋嫨鍣ㄥ彲瑙佹€у拰灏哄
      const selectInfo = await sortSelect.evaluate((el: HTMLSelectElement) => {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          color: cs.color,
          bg: cs.backgroundColor,
          border: cs.borderColor,
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
        }
      })
      console.log(`[宸ュ叿鎺掑簭] 閫夋嫨鍣? ${selectInfo.width}x${selectInfo.height} color=${selectInfo.color} bg=${selectInfo.bg} visible=${selectInfo.visible}`)

      // 閫夋嫨鍣ㄥ簲璇ユ湁瓒冲澶у皬
      expect(selectInfo.width).toBeGreaterThan(50)
      expect(selectInfo.height).toBeGreaterThan(20)

      // 妫€鏌ユ枃瀛椾笌鑳屾櫙瀵规瘮搴?
      expect(selectInfo.color !== selectInfo.bg).toBeTruthy()

      // 灏濊瘯浣跨敤 selectOption 閫夋嫨
      await sortSelect.selectOption('name').catch(() => {})
      await p.waitForTimeout(500)
      const selectedValue = await sortSelect.evaluate((el: HTMLSelectElement) => el.value)
      console.log(`[宸ュ叿鎺掑簭] 閫夋嫨鍚庡€? ${selectedValue}`)
    } else {
      console.log('[宸ュ叿鎺掑簭] 鏈壘鍒版帓搴忛€夋嫨鍣?璺宠繃')
    }
  })

  test('VIP椤靛脊绐?鐐瑰嚮寮€閫氭寜閽?', async ({ page: p }) => {
    await p.goto('/vip', { waitUntil: 'domcontentloaded' })

    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(3000)

    // 鎵惧埌"绔嬪嵆寮€閫?鎴?绔嬪嵆鍗囩骇"鎸夐挳
    const ctaBtn = p.locator('button:has-text("寮€閫?), button:has-text("鍗囩骇"), button:has-text("璐拱"), .select-plan-btn, .cta-btn').first()
    const btnExists = await ctaBtn.count()

    if (btnExists > 0) {
      // 妫€鏌ユ寜閽枃瀛楀彲瑙佹€?
      const btnInfo = await ctaBtn.evaluate((el: HTMLButtonElement) => {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          color: cs.color,
          bg: cs.backgroundColor,
          text: el.textContent?.trim().slice(0, 20),
        }
      })
      console.log(`[VIP寮圭獥] 鎸夐挳: "${btnInfo.text}" ${btnInfo.width}x${btnInfo.height} color=${btnInfo.color} bg=${btnInfo.bg}`)

      // 鎸夐挳鏂囧瓧涓庤儗鏅笉鑳藉悓鑹?
      expect(btnInfo.color !== btnInfo.bg || btnInfo.bg === 'rgba(0, 0, 0, 0)').toBeTruthy()
      // 鎸夐挳搴旇鏈夎冻澶熷ぇ灏?
      expect(btnInfo.height).toBeGreaterThanOrEqual(28)
    } else {
      console.log('[VIP寮圭獥] 鏈壘鍒板紑閫氭寜閽?璺宠繃')
    }
  })
})
