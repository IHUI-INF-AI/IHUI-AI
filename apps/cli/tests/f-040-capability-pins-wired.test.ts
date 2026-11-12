// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 票 F-040 回归钉:三份桌面能力回归钉必须真的被某个 runner 调度。
//
// 缺陷本体不是"判据写错了",而是"判据没人跑":capabilities-*.test.mjs 早已入库,
// 却不在任何 package.json / scripts/** / workflow 里 ⇒ F-045/F-047/F-061 这类
// capabilities/default.json 配置回归永久静默。所以这里断的不是那三份文件的内容,
// 而是"登记面"本身:列举开关能吐出来 + 注册表元数据齐全 + 执行面真的消费注册表。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, it } from 'vitest'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const RUNNER = join(REPO_ROOT, 'scripts', 'all-checks-runner.mjs')

/** 缺陷普查点名的三份钉(缺一即回归)。 */
const PIN_FILES = [
  'apps/desktop/tests/capabilities-allow-open.test.mjs',
  'apps/desktop/tests/capabilities-fs-remote-denied.test.mjs',
  'apps/desktop/tests/capabilities-store-scope.test.mjs',
]

interface PinEntry {
  name: string
  path: string
  timeoutMs: number
}

describe('F-040 三份能力回归钉已接入 all-checks-runner', () => {
  it('列举开关吐出三份钉(直接 spawn,不依赖 import 副作用)', () => {
    const res = spawnSync(process.execPath, [RUNNER, '--print-steps'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
    })
    assert.equal(res.status, 0, `--print-steps 退出码非 0: ${res.stderr}`)
    const steps = JSON.parse(res.stdout) as string[]
    assert.ok(Array.isArray(steps) && steps.length > 0, '列举面为空 ⇒ 空扫不记绿')
    for (const file of PIN_FILES) {
      assert.ok(
        steps.includes(`node ${file}`),
        `列举面缺少能力回归钉(等于没接线): ${file}`,
      )
    }
  })

  it('注册表按 {name,path,timeoutMs} 登记且落点真实存在', async () => {
    const mod = (await import(pathToFileURL(RUNNER).href)) as {
      CAPABILITY_PIN_CHECKS: PinEntry[]
    }
    const pins = mod.CAPABILITY_PIN_CHECKS
    assert.ok(Array.isArray(pins), 'CAPABILITY_PIN_CHECKS 必须以数组形态导出')

    for (const file of PIN_FILES) {
      const pin = pins.find((p) => p.path === file)
      assert.ok(pin, `注册表缺少 ${file}`)
      assert.equal(typeof pin.name, 'string', `${file} 缺 name(失败清单里点不出是谁)`)
      assert.ok(pin.name.trim().length > 0, `${file} 的 name 为空`)
      assert.equal(typeof pin.timeoutMs, 'number', `${file} 缺 timeoutMs`)
      assert.ok(pin.timeoutMs > 0, `${file} 的 timeoutMs 必须为正数`)
      // 登记了但文件不存在 ⇒ 每次全量档都派生失败,"未跑完"会被当成常态噪声。
      assert.ok(existsSync(join(REPO_ROOT, pin.path)), `登记的钉文件不存在: ${pin.path}`)
    }
  })

  it('执行面真的消费注册表(而不只是导出常量)', () => {
    // 只切 main 这一小段做结构断言:不对整份脚本做全文匹配(那样任何注释改动都会假红),
    // 也钉住"导出即装车"这个最容易漏的环节(AGENTS「造好没装车 = 没有」)。
    const src = readFileSync(RUNNER, 'utf8')
    const body = src.slice(src.indexOf('function main()'), src.indexOf('function runSelfTest()'))
    assert.ok(body.length > 0, '定位不到 main 函数体,源码结构已变,请复核本断言')
    assert.ok(
      body.includes('CAPABILITY_PIN_CHECKS'),
      'main 没有消费 CAPABILITY_PIN_CHECKS ⇒ 注册了但不会执行',
    )
    const loop = body.slice(body.indexOf('CAPABILITY_PIN_CHECKS'))
    assert.ok(loop.includes('runStep('), '能力回归钉没有走 runStep ⇒ 失败不会进汇总/退出码')
  })
})
