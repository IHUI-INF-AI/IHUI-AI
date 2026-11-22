// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * toggle 图标语义守门(`scripts/check-toggle-icon-semantics.mjs`)的镜像测试。
 *
 * §22c:判据一律从源脚本 `__test__` import,本文件不复制任何判据常量;
 * §22d:源脚本能被 import 而不跑主流程,由本文件 import 成功本身证明。
 *
 * 立项形态(2026-11-21):用户实报「桌面端窗口置顶按钮逻辑正好相反」——
 * `pinned ? <PinOff/> : <Pin/>` 在带 aria-pressed + 高亮的常驻开关上,视觉读反。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-toggle-icon-semantics.mjs'

const hit = (src) => gate.findViolations(src)

test('病形态:aria-pressed 真值支画 PinOff(括号/无括号两种写法)', () => {
  assert.equal(hit('<button aria-pressed={pinned}>{pinned ? <PinOff /> : <Pin />}</button>').length, 1)
  assert.equal(
    hit('<button aria-pressed={pinned}>{pinned ? (<PinOff />) : (<Pin />)}</button>').length,
    1,
  )
})

test('病形态:data-state on/off 双态的真值支画解除型图标', () => {
  const src = `<button data-state={on ? 'on' : 'off'}>{on ? <EyeOff /> : <Eye />}</button>`
  assert.equal(hit(src).length, 1)
})

test('正确形态:状态式真值支画开启态图标', () => {
  assert.equal(hit('<button aria-pressed={pinned}>{pinned ? <Pin /> : <PinOff />}</button>').length, 0)
  assert.equal(hit('<button aria-pressed={on}>{on ? <Star /> : <StarOff />}</button>').length, 0)
})

test('豁免:菜单项(role=menuitem)与带可见文字的动作按钮', () => {
  assert.equal(hit('<button role="menuitem">{pinned ? <PinOff /> : <Pin />}</button>').length, 0)
  assert.equal(
    hit('<button aria-pressed={reveal}>{reveal ? <EyeOff /> : <Eye />}<span>隐藏</span></button>')
      .length,
    0,
  )
})

test('豁免:关闭态族图标(静音/关麦)本身即状态', () => {
  assert.equal(hit('<button aria-pressed={muted}>{muted ? <VolumeX /> : <Volume2 />}</button>').length, 0)
  assert.equal(
    hit('<button aria-pressed={off}>{off ? <MicOff /> : <Mic />}</button>').length,
    0,
  )
})

test('不在射程:aria-expanded 展开收起控件(侧栏搜索的 X)', () => {
  assert.equal(hit('<button aria-expanded={open}>{open ? <X /> : <Search />}</button>').length, 0)
})

test('豁免:行内 toggle-icon-exempt 必须带原因', () => {
  assert.equal(
    hit('<button aria-pressed={p}>{/* toggle-icon-exempt: 外部设计稿 */}{p ? <PinOff /> : <Pin />}</button>')
      .length,
    0,
  )
  // 只写标记不写原因 ⇒ 不算豁免
  assert.equal(
    hit('<button aria-pressed={p}>{/* toggle-icon-exempt: */}{p ? <PinOff /> : <Pin />}</button>')
      .length,
    1,
  )
})

test('判据名单锁:含解除族、不含关闭态族', () => {
  const names = gate.ACTION_OFF_ICONS
  for (const n of ['PinOff', 'BellOff', 'StarOff', 'EyeOff']) {
    assert.ok(names.includes(n), `${n} 必须在解除族名单里`)
  }
  for (const n of ['VolumeX', 'MicOff', 'VideoOff', 'CameraOff', 'Unlock']) {
    assert.ok(!names.includes(n), `${n} 属关闭态族,不得误判`)
  }
})

test('有可见文字判定不会被 className 的 {cn(...)} 误伤', () => {
  const withCn =
    "<button aria-pressed={p} className={cn('a', p && 'b')}>{p ? <PinOff /> : <Pin />}</button>"
  assert.equal(hit(withCn).length, 1, 'cn(...) 不是可见文字,不得整段豁免')
  const withText =
    "<button aria-pressed={p} className={cn('a', p && 'b')}>{p ? <PinOff /> : <Pin />}<span>置顶</span></button>"
  assert.equal(hit(withText).length, 0, '有 <span> 文字 ⇒ 动作式合法')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
