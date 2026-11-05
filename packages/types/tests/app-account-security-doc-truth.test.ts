// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-11-06 立:两处 2FA 契约的「谎读到形态」反证锁(子任务 1)。
//
// 立因:`SecuritySettingsScreenProps` 的注记此前写着「后端无写端点」,而两步验证**有**写路径
// (packages/api-client/src/endpoints/system.ts 的 setupTwoFactor / verifyTwoFactor /
// disableTwoFactor → /api/auth/2fa/*,RN 的 SecurityCenterScreen 已在用)。fb4867398b 把**上屏文案**
// 改对了,机器读到的那一份(类型注记)仍在撒谎 —— 注记是下一个来接的人的取材面,它错了就会把
// 正确实现重新带成只读形态。本尺钉三件事:
//  ① 注记必须**按项区分**可写性,并指到真实现场(端点函数名 + 路由文件),不得概览式否认;
//  ② 注记里的每条事实都要被**现读端点**复核(文档与代码脱节时是代码这一侧响,不是让注记自证);
//  ③ 反证锁有牙:把改前那种"后端无写端点"形态当夹具喂进同一把尺 ⇒ 必须不通过
//     (否则 ① 是一条恒真判据,量不到任何东西)。

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..')

const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), 'utf8')

/** 取 `export interface SecuritySettingsScreenProps { … }` 整块(到首个行首 `}` 为止)。 */
export function propsDocBlock(src: string, name = 'SecuritySettingsScreenProps'): string {
  const start = src.indexOf(`export interface ${name} {`)
  if (start < 0) throw new Error(`未找到 ${name}(类型面漂移,不冒充"已读过")`)
  const end = src.indexOf('\n}', start)
  if (end < 0) throw new Error(`${name} 的块闭合找不到(文件形态漂移)`)
  return src.slice(start, end + 2)
}

export interface DocTruthInput {
  block: string
  /** 注记点到的端点函数是否真在 system.ts 里(现读,不接受注记自证) */
  twoFactorWritesPresent: boolean
  /** /user/security 那条路径是否真的只有 GET(现读路由文件) */
  userSecurityReadonlyPresent: boolean
}

/**
 * 判据(纯函数):按项区分的如实表述。缺一即不通过,并点名缺哪一格。
 * 刻意**不**用"出现『不支持修改』字样就红"这种关键词黑名单 —— 如实表述里合法地要提那句谎
 * (「不等于后端不支持修改」),按主语黑名单会把正解判红。真判据是"每一格都有出处"。
 */
export function judgePropsDocTruth(input: DocTruthInput): string[] {
  const { block } = input
  const problems: string[] = []
  const has = (re: RegExp, what: string) => {
    if (!re.test(block)) problems.push(what)
  }

  // 四项逐一点名:概览式的一句话盖不住四种可写性
  for (const key of ['passwordEnabled', 'biometricEnabled', 'twoFactorEnabled', 'loginAlert']) {
    has(new RegExp(`\\b${key}\\b`, ''), `注记未点名 ${key}`)
  }
  // 可写那一项必须指到真路径 + 真端点函数 + 真文件(不是"别的地方能改")
  has(/\/api\/auth\/2fa\/(setup|verify|disable)/, '两步验证未指到 /api/auth/2fa/* 真路径')
  has(/setupTwoFactor/, '未点名 setupTwoFactor')
  has(/verifyTwoFactor/, '未点名 verifyTwoFactor')
  has(/disableTwoFactor/, '未点名 disableTwoFactor')
  has(/endpoints\/system\.ts|packages\/api-client/, '可写项未指到 api-client 的 system.ts 出处')
  // 真只读的两项必须写明存储侧与"无写入方"的依据文件
  has(/user_preferences\(group='security'\)/, 'biometric/loginAlert 未写明存储侧')
  has(/user-security-routes\.ts/, 'biometric/loginAlert 未指到读出侧现场 user-security-routes.ts')
  has(/(无|没有)写入方/, 'biometric/loginAlert 未写明「无写入方」这一真实形态')
  // 「本条路径只读」与「后端整体不支持修改」必须分开:限定语必须在场
  has(/这一条路径|本条路径/, '未把「行内无写端点」限定到 /user/security 这一条路径')

  // 注记说的每件事都要被现读复核:端点不在了,注记再漂亮也是假账
  if (!input.twoFactorWritesPresent) {
    problems.push('注记声称 /api/auth/2fa/* 可写,但 system.ts 现读无 setupTwoFactor/verifyTwoFactor/disableTwoFactor')
  }
  if (!input.userSecurityReadonlyPresent) {
    problems.push('注记声称 /user/security 只有 GET,但 user-security-routes.ts 现读已出现写方法注册')
  }
  return problems
}

/** system.ts 里 2FA 的三个写端点函数是否齐备(名字 + 路径 + POST 同块)。 */
export function hasTwoFactorWrites(systemSrc: string): boolean {
  return ['setupTwoFactor', 'verifyTwoFactor', 'disableTwoFactor'].every((fn) => {
    const at = systemSrc.indexOf(`export async function ${fn}`)
    if (at < 0) return false
    const body = systemSrc.slice(at, at + 600)
    return /method:\s*'POST'/.test(body) && /\/api\/auth\/2fa\/(setup|verify|disable)/.test(body)
  })
}

/** /user/security 这条路径只注册 GET(出现任何写方法注册即假)。 */
export function isUserSecurityReadOnly(routeSrc: string): boolean {
  if (!/server\.get\(\s*'\/user\/security'/.test(routeSrc)) return false
  return !/server\.(post|put|patch|delete)\(/.test(routeSrc)
}

/**
 * biometric / loginAlert 两键在 apps/api/src 里有无写入方:逐个 `upsertUserPreference(` 调用点
 * 取其后 240 字符窗口,任一窗口点到这两键 ⇒ 存在写入方(注记即需改口)。
 */
export function preferenceWriteSites(apiSrc: string): string[] {
  const hits: string[] = []
  const re = /upsertUserPreference\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(apiSrc))) {
    const win = apiSrc.slice(m.index, m.index + 240)
    if (/\bbiometric\b|loginAlert/.test(win)) hits.push(apiSrc.slice(m.index, m.index + 60))
  }
  return hits
}

/**
 * 逐文件扫 `dir` 下全部 .ts:任何 `upsertUserPreference(` 调用窗口点到 biometric / loginAlert
 * ⇒ 该键有写入方。**按文件分窗**,不把多份文件拼成一串再开窗(拼接会在文件边界造出
 * 一个并不存在的调用点 ⇒ 假红)。
 */
export function writeSitesForSecurityKeys(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) {
      writeSitesForSecurityKeys(p, acc)
      continue
    }
    if (!ent.name.endsWith('.ts')) continue
    for (const site of preferenceWriteSites(readFileSync(p, 'utf8'))) acc.push(`${p} :: ${site}`)
  }
  return acc
}

const CHANGE_BEFORE_FIXTURE = `
export interface SecuritySettingsScreenProps {
  /** 切换回调。后端 /user/security 只有 GET 无写端点 ⇒ 只读形态(readOnly)下不会调用 */
  onToggle?: (key: keyof SecuritySettingsItem, value: boolean) => void
  /** 只读展示:true 时四项渲染为状态文字而非 Switch(后端无写端点,不得留假开关) */
  readOnly?: boolean
}
`

describe('SecuritySettingsScreenProps 注记:两处 2FA 契约的诚实性', () => {
  const block = propsDocBlock(read('packages/types/src/app-account.ts'))
  const systemSrc = read('packages/api-client/src/endpoints/system.ts')
  const routeSrc = read('apps/api/src/routes/user-security-routes.ts')

  it('① 正向:注记按项区分可写性,每条都指到真实现场', () => {
    const problems = judgePropsDocTruth({
      block,
      twoFactorWritesPresent: hasTwoFactorWrites(systemSrc),
      userSecurityReadonlyPresent: isUserSecurityReadOnly(routeSrc),
    })
    expect(problems).toEqual([])
  })

  it('② 反证锁有牙:改前那种「后端无写端点」形态同一把尺必红', () => {
    const problems = judgePropsDocTruth({
      block: CHANGE_BEFORE_FIXTURE,
      twoFactorWritesPresent: true,
      userSecurityReadonlyPresent: true,
    })
    // 不是"报了几条"的问题,而是**必须一条都没通过**:概览式否认量不出逐项可写性
    expect(problems.length).toBeGreaterThan(4)
    expect(problems.join('\n')).toContain('/api/auth/2fa/')
    expect(problems.join('\n')).toContain('user-security-routes.ts')
  })

  it('③ 端点现读:两步验证确有写路径(注记的可写半边由代码而非文字支撑)', () => {
    expect(hasTwoFactorWrites(systemSrc)).toBe(true)
    // mfa.ts 是**另一套并行契约**(路径 /api/mfa/*),不得与 /api/auth/2fa/* 混为一谈
    const mfaSrc = read('packages/api-client/src/endpoints/mfa.ts')
    expect(mfaSrc).toContain("'/api/mfa/enable'")
    expect(mfaSrc).not.toContain('/api/auth/2fa/')
  })

  it('④ /user/security 仍只有 GET,且 biometric/loginAlert 在 api 层无写入方(只读半边的出处)', () => {
    expect(isUserSecurityReadOnly(routeSrc)).toBe(true)
    const sites = writeSitesForSecurityKeys(join(REPO_ROOT, 'apps/api/src'))
    expect(
      sites,
      `这两键已被写入(注记的「无写入方」需要改口):\n${sites.join('\n')}`,
    ).toEqual([])
    // 探测器有牙:同一把尺必须认得出「真存在写入方」的形态(否则 ④ 只是没测)
    expect(preferenceWriteSites(`upsertUserPreference(userId, GROUP, 'biometric', '1')`)).toHaveLength(
      1,
    )
    expect(preferenceWriteSites(`upsertUserPreference(userId, GROUP, 'loginAlert', '0')`)).toHaveLength(
      1,
    )
    expect(preferenceWriteSites(`upsertUserPreference(userId, GROUP, 'ipWhitelist', '1.2.3.4')`)).toEqual(
      [],
    )
  })

  it('⑤ 探测器有牙:注记里的可写性一旦与端点现读矛盾,同一把尺当场红', () => {
    const viaDoc = judgePropsDocTruth({
      block,
      twoFactorWritesPresent: false, // 端点被摘掉 ⇒ 注记的"可写"就成了空头支票
      userSecurityReadonlyPresent: true,
    })
    expect(viaDoc.join('\n')).toContain('system.ts 现读')
    const viaRoute = judgePropsDocTruth({
      block,
      twoFactorWritesPresent: true,
      userSecurityReadonlyPresent: false,
    })
    expect(viaRoute.join('\n')).toContain('user-security-routes.ts 现读')
    // 夹具方向也必须反着钉:把写方法塞进路由文件 ⇒ isUserSecurityReadOnly 必须立刻变脸
    expect(isUserSecurityReadOnly(`${routeSrc}\nserver.post('/user/security', async () => {})\n`)).toBe(false)
    expect(hasTwoFactorWrites(systemSrc.replace('export async function disableTwoFactor', 'export async function disabledTwoFactor'))).toBe(
      false,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
