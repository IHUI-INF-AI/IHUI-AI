// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「登出后自动登回」第三条径路的装车锁(2026-09-29 立,G-365 第三径)。
 *
 * 为什么要有这把锁:#29 把判据收进共享层之后,web 仍有一条**没走判据**的径路 ——
 * 共享包 `PasswordLoginForm` 的 mount effect 只读 localStorage 的持久标志就
 * `requestSubmit()`,于是用户点完退出落到登录页,300ms 后表单自己把账密提交上去又登回去了。
 * `use-auth-bootstrap` 与 `lib/api.ts` 两条已收口的径路全绿,而这一条无人看守 ——
 * 同一型缺陷的第二/三条径路正是本仓"修了一处、型还在"的最高频形态(守门 102 GA4、
 * 守门 134 扩布尔档键、守门 157 门体入库,同族)。
 *
 * 判据对象是"文件形态",所以按 §22c 的教训:输入逐字取自真实文件,不用自造夹具。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// __tests__ → lib → src → web → apps → 仓根:五跳,少一跳就会把 web 入口当成组件文件来读
const ROOT = path.resolve(import.meta.dirname, '../../../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

const webFunnel = 'apps/web/src/components/login/LoginFormContent.tsx'
const form = 'packages/ui-react/src/components/login-form/password-login-form.tsx'
const parentForm = 'packages/ui-react/src/components/login-form/login-form.tsx'
const typesFile = 'packages/ui-react/src/components/login-form/types.ts'

// 取材面自证:路径读歪时这把锁会"对着另一个文件的一切正常"判绿,所以先把身份验一遍
describe('夹具身份自证(路径读歪就等于锁空转)', () => {
  it('四个被锁的文件各自含有只有它自己才有的标识', () => {
    expect(read(webFunnel)).toMatch(/interface LoginFormContentProps/)
    expect(read(form)).toMatch(/function PasswordLoginForm/)
    expect(read(parentForm)).toMatch(/export function LoginForm/)
    expect(read(typesFile)).toMatch(/LoginFormProps/)
  })
})

describe('自动提交凭据这一径路必须过跨端判据', () => {
  it('web 登录入口把 canAutoSubmitCredentials 接到共享判据 + web 落盘实现', () => {
    const src = read(webFunnel)
    expect(src).toMatch(/canAutoSubmitCredentials=\{\(\)\s*=>\s*canSilentlyReLogin\(/)
    expect(src).toMatch(/sessionLoggedOut:\s*isSessionLoggedOut/)
    expect(src).toMatch(/from '@ihui\/shared\/auth\/auto-login-policy'/)
    expect(src).toMatch(/from '@\/lib\/session-marker'/)
  })

  it('web 入口不得用 () => true 应付必填项(那等于把这一径路重新放开)', () => {
    const src = read(webFunnel)
    expect(src).not.toMatch(/canAutoSubmitCredentials=\{\(\)\s*=>\s*true\}/)
  })

  it('组件的自动提交 effect 把判据排在最前(排在后面就还会提交一次)', () => {
    const src = read(form)
    const effect = src.match(/React\.useEffect\(\(\) => \{[\s\S]*?\}, \[\]\)/)
    expect(effect, '自动提交 effect 不得改名或删除').toBeTruthy()
    const body = effect![0]
    const gate = body.indexOf('canAutoSubmitCredentials()')
    const persist = body.indexOf('enableCredentialPersistence')
    expect(gate).toBeGreaterThan(-1)
    expect(persist).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(persist)
  })

  it('必填性:types.ts 与组件解构都不得把它变成可缺省项', () => {
    expect(read(typesFile)).toMatch(/\n  canAutoSubmitCredentials: \(\) => boolean/)
    expect(read(typesFile)).not.toMatch(/canAutoSubmitCredentials\?:/)
    // 组件侧不得给默认值 —— 默认值就是"静默失效开关"(守门 91 同一课)。
    // 判据面必须先剥注释行:本文件与组件里都写着"正确写法是 canAutoSubmitCredentials={...}"
    // 这类说明文字,不剥就会把解释自己的散文判成违规(守门 131 立项当天同型事故)。
    const codeFace = read(form)
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')
    expect(codeFace).not.toMatch(/canAutoSubmitCredentials\s*=\s*/)
    // 失败说明只能挂在 expect 的第二参上 —— `toMatch` 的签名只有一个实参,
    // 写成 `.toMatch(re, 'msg')` 在 tsc 下是 TS2554(2026-09-28 实测:云端 web build 步骤因此红,
    // 而 `next build` 只看得到这条类型错,断言本身在运行时是好的)。
    expect(codeFace, '组件必须以"无默认值的解构"接这个必填项').toMatch(
      /\n\s*canAutoSubmitCredentials,/,
    )
  })

  it('父组件必须真的把它透传给 password tab(接了参数没下传=没接)', () => {
    const src = read(parentForm)
    expect(src).toMatch(/canAutoSubmitCredentials,/)
    expect(src).toMatch(/const formBaseProps = \{[\s\S]*canAutoSubmitCredentials[\s\S]*\}/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
