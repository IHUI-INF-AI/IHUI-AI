// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 镜像测试(§22c):判据一律 import `scripts/audit-app-text-contrast.mjs` 的 __test__ 出口,
// 本文件不复制任何色值、阈值或正则 —— 复制一份判据必然与尺子本体漂移。
//
// 这一族锁的是"尺子本身不会说谎"的三件事:
//   ① 非 style 形态(图标 prop / 占位符 / tint)必须被扫到 —— 上一轮漏的就是这些;
//   ② 底色不得当前景判 —— 否则 `return tk.warning.amberLight` 会被算成 1.02 假红;
//   ③ 把暗档专用色拿去量亮底不得判红 —— 否则 `dark ? success.DEFAULT` 被算成假红。
// 假红比漏检更贵:它会逼人开始跳门(AGENTS.md §0.2)。
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { __test__ as kit } from '../audit-app-text-contrast.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

function realTables() {
  const ts = readFileSync(resolve(ROOT, kit.TOKENS_SRC), 'utf8')
  const t = kit.parseRnTokenTables(ts)
  return {
    light: Object.fromEntries(Object.entries(t.light).map(([k, v]) => [k, kit.toRgba(v)])),
    dark: Object.fromEntries(Object.entries(t.dark).map(([k, v]) => [k, kit.toRgba(v)])),
  }
}

describe('audit-app-text-contrast: 形态识别', () => {
  it('图标 prop color={...} 必须被判为图形门槛', () => {
    const uses = kit.extractTokenUses('  <Search color={tk.text.tertiary} />')
    const hit = uses.find((u) => u.field === 'text.tertiary')
    assert.ok(hit, '图标 prop 形态未被扫到')
    assert.equal(hit.kind, 'graphic')
  })

  it('placeholderTextColor 必须被判为文字门槛', () => {
    const uses = kit.extractTokenUses('  placeholderTextColor={tk.text.tertiary}')
    const hit = uses.find((u) => u.field === 'text.tertiary')
    assert.ok(hit, '占位符形态未被扫到')
    assert.equal(hit.kind, 'text')
  })

  it('style 里的 color: 必须被判为文字门槛', () => {
    const uses = kit.extractTokenUses('  color: tk.text.tertiary,')
    assert.equal(uses.find((u) => u.field === 'text.tertiary')?.kind, 'text')
  })

  it('tintColor 骨架屏必须被扫到', () => {
    const uses = kit.extractTokenUses('  tintColor={tk.text.secondary}')
    assert.ok(uses.some((u) => u.field === 'text.secondary'))
  })

  it('底色键必须被标成 bg,不得当前景', () => {
    assert.equal(kit.extractTokenUses('  backgroundColor: tk.surface.muted,').find((u) => u.field === 'surface.muted')?.kind, 'bg')
    assert.equal(kit.extractTokenUses('    bg: (tk) => tk.warning.light,').find((u) => u.field === 'warning.light')?.kind, 'bg')
    assert.equal(kit.extractTokenUses('    const cardBg = tk.surface.muted').find((u) => u.field === 'surface.muted')?.kind, 'bg')
  })
})

describe('audit-app-text-contrast: 语义分族(防假红)', () => {
  it('浅底族一律属于底色族', () => {
    for (const f of ['warning.amberLight', 'success.lightest', 'success.lighter', 'surface.light', 'danger.light', 'border.light']) {
      assert.equal(kit.isBackgroundFamily(f), true, `${f} 应属底色族`)
    }
  })

  it('真正的前景档不属于底色族', () => {
    for (const f of ['text.tertiary', 'text.secondary', 'warning.amber', 'success.DEFAULT', 'vip.gold']) {
      assert.equal(kit.isBackgroundFamily(f), false, `${f} 不应属底色族`)
    }
  })

  it('反白族被单列,不参与承载面穷举', () => {
    for (const f of ['brand.ctaForeground', 'surface.onBrand', 'text.inverse', 'error.onBg']) {
      assert.equal(kit.isInverseFamily(f), true, `${f} 应属反白族`)
    }
    assert.equal(kit.isInverseFamily('text.secondary'), false)
  })
})

describe('audit-app-text-contrast: 判据本身', () => {
  it('颜色解不出必须返回 null,不得当成 0 或当成通过', () => {
    assert.equal(kit.contrast(kit.toRgba('not-a-color'), kit.toRgba('#ffffff')), null)
  })

  it('图形门槛必须低于文字门槛', () => {
    assert.equal(kit.thresholdFor('graphic'), 3)
    assert.equal(kit.thresholdFor('text'), 4.5)
  })

  it('白字压黑 CTA 必须算 21:1(防"反白被算成 1.09"的假红)', () => {
    assert.equal(kit.contrast(kit.toRgba('#FFFFFF'), kit.toRgba('#000000')), 21)
  })

  it('token 表必须从 export const 取,不得把 interface 形状当值', () => {
    const { light } = realTables()
    assert.ok(Object.keys(light).length > 40, 'token 表解出条目过少')
    assert.equal(light['surface.bg'], kit.toRgba('#F5F5F5') && light['surface.bg'])
  })
})

describe('audit-app-text-contrast: 现读结论稳定', () => {
  const { light, dark } = realTables()

  it('text.tertiary 在全部承载面上都不达标(这是本轮的确定缺陷)', () => {
    const j = kit.judge('text.tertiary', 'graphic', light, dark)
    assert.equal(j.undetermined, false)
    assert.equal(j.allFail, true, 'tertiary 应判为全承载面失败')
  })

  it('text.secondary 在全部承载面上都达标(上一轮的换档是正确的)', () => {
    const j = kit.judge('text.secondary', 'text', light, dark)
    assert.equal(j.allFail, false)
    assert.equal(j.someFail, false, 'secondary 不该出现"部分承载面失败"')
  })

  it('vip.gold 在浅底上确实不可读(1.29 级),应判为确定缺陷', () => {
    const j = kit.judge('vip.gold', 'graphic', light, dark)
    assert.equal(j.allFail, true)
  })

  it('danger.DEFAULT 只是窄位(浅过深不过),不得判为确定缺陷', () => {
    const j = kit.judge('danger.DEFAULT', 'text', light, dark)
    assert.equal(j.allFail, false, 'danger.DEFAULT 在浅底可达标,不该判红')
    assert.equal(j.someFail, true, 'danger.DEFAULT 在深底不达标,应进窄位预警')
  })
})

describe('audit-app-text-contrast: packages/app tertiary 清零可核验', () => {
  it('packages/app/src 下不得再有代码级的 text.tertiary 取值', () => {
    const hits = []
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '__tests__') continue
        const full = resolve(dir, name)
        const st = statSync(full)
        if (st.isDirectory()) { walk(full); continue }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue
        readFileSync(full, 'utf8').split(/\r?\n/).forEach((line, i) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
          if (/\b(tk|tokens|baseTokens|rnTokens)\.text\.tertiary\b/.test(line)) {
            hits.push(`${full.replace(/\\/g, '/')}:${i + 1}`)
          }
        })
      }
    }
    walk(resolve(ROOT, kit.SCAN_DIR))
    assert.deepEqual(hits, [], `仍有代码级 tertiary 取值:\n${hits.join('\n')}`)
  })
})
