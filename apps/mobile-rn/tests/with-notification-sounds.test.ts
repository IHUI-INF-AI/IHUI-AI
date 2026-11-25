// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * 通知铃声 raw 音源插件取证(2026-11-26 立)。
 *
 * `/android` 是 prebuild 生成目录且被 .gitignore 排除,音源必须由 config plugin 在每次
 * prebuild 时从 assets/sounds 重新生成。本用例不跑真 prebuild(破坏性重建,禁止执行),
 * 只调用抽出的纯函数 copyRingtoneSounds,用临时目录当 Android 工程根:
 *  ① 恰好产出 8 个 ringtone_<id>.wav;
 *  ② 每个副本与源 wav 逐字节相同(sha256 对拍);
 *  ③ 文件名反推的 id 全在 shared RINGTONE_IDS 内、数量 8(目录即真相源,不手抄表);
 *  ④ app.config.js 的 plugins 列表确实登记了本插件(防"写了插件没挂")。
 */
import { describe, expect, it, beforeEach, afterAll } from 'vitest'
import { createRequire } from 'node:module'
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  existsSync,
} from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { RINGTONE_IDS } from '@ihui/shared/notifications/ringtone'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const requireCjs = createRequire(join(ROOT, 'package.json'))
const plugin = requireCjs('./plugins/withNotificationSounds.cjs') as {
  copyRingtoneSounds: (
    androidProjectRoot: string,
    options?: { sourceDir?: string; validIds?: readonly string[] },
  ) => Array<{ source: string; destination: string; id: string }>
}

const SOUND_SOURCE_DIR = join(ROOT, 'assets', 'sounds')
const STAGING = join(tmpdir(), `ihui-notification-sounds-${process.pid}`)

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

beforeEach(() => {
  if (existsSync(STAGING)) rmSync(STAGING, { recursive: true, force: true })
  mkdirSync(STAGING, { recursive: true })
})

afterAll(() => {
  if (existsSync(STAGING)) rmSync(STAGING, { recursive: true, force: true })
})

describe('withNotificationSounds 音源落位插件', () => {
  it('复制到临时 Android 工程根,恰好产出 8 个 ringtone_<id>.wav', () => {
    const results = plugin.copyRingtoneSounds(STAGING, { sourceDir: SOUND_SOURCE_DIR })
    expect(results).toHaveLength(RINGTONE_IDS.length)
    const rawDir = join(STAGING, 'app', 'src', 'main', 'res', 'raw')
    expect(existsSync(rawDir)).toBe(true)
    const produced = readdirSync(rawDir).filter((f) => f.endsWith('.wav'))
    expect(produced).toHaveLength(8)
    for (const file of produced) {
      expect(file).toMatch(/^ringtone_[a-z0-9]+\.wav$/)
    }
  })

  it('每个副本与 assets/sounds 同名源逐字节相同(sha256 对拍)', () => {
    plugin.copyRingtoneSounds(STAGING, { sourceDir: SOUND_SOURCE_DIR })
    const rawDir = join(STAGING, 'app', 'src', 'main', 'res', 'raw')
    for (const produced of readdirSync(rawDir).filter((f) => f.endsWith('.wav'))) {
      const sourceName = produced.replace(/_/g, '-')
      expect(sha256(join(rawDir, produced))).toBe(sha256(join(SOUND_SOURCE_DIR, sourceName)))
    }
  })

  it('文件名反推的 id 全在 shared RINGTONE_IDS 内,数量与 shared 一致', () => {
    const results = plugin.copyRingtoneSounds(STAGING, {
      sourceDir: SOUND_SOURCE_DIR,
      validIds: RINGTONE_IDS,
    })
    const ids = results.map((r) => r.id)
    expect(ids).toHaveLength(RINGTONE_IDS.length)
    for (const id of ids) {
      expect(RINGTONE_IDS).toContain(id)
    }
    // 与 shared 清单集合相等,防止目录里混进 shared 之外的私加音源
    expect([...ids].sort()).toEqual([...RINGTONE_IDS].sort())
  })

  it('对齐校验:反推出的 id 不在合法集合内时 throw,不静默跳过', () => {
    expect(() =>
      plugin.copyRingtoneSounds(STAGING, {
        sourceDir: SOUND_SOURCE_DIR,
        validIds: ['dingdong'],
      }),
    ).toThrow(/不在 shared RINGTONE_IDS 内/)
  })

  it('app.config.js 的 plugins 列表已登记本插件(防写了插件没挂)', () => {
    const configSource = readFileSync(join(ROOT, 'app.config.js'), 'utf8')
    expect(configSource).toContain('./plugins/withNotificationSounds.cjs')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
