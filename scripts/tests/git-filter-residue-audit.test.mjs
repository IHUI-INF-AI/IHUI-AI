// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * git filter 残留巡检(`auditGitFilterResidue`)的镜像测试(§22c:import 源脚本 __test__,零复算)。
 *
 * 立因(一手取证):Qoder CN 桌面端每次会话启动都跑
 * `git config --name-only --get-regexp '^filter\..*\.(clean|smudge|process|required)$'`;
 * 只要任一作用域命中 filter 键,它就把工作树快照标成不可信
 * (`(not collected: Git content filters are configured; working-tree cleanliness is unknown)`)。
 * 本机根因是 git-lfs 安装器写进 system/global 的 `filter.lfs.*`,且 56 个仓库 `git lfs ls-files`
 * 全空 —— 这些键没有任何消费者。复发通道是重装/升级 Git for Windows 或再跑 `git lfs install`,
 * 所以需要一条自动摘除的巡检腿。
 *
 * 钉的四件事:
 *   T1 空输出(无匹配)⇒ 空清单,绝不把"干净"判成"取不到";
 *   T2 四条 `filter.lfs.*` ⇒ `['lfs']`(同名前缀只留一枚);
 *   T3 混合 `filter.lfs.*` + `filter.foo.clean` ⇒ 按首次出现顺序 `['lfs','foo']`;
 *   T4 CRLF / 前后空白 / 空行 / 非 filter 行都不干扰解析;
 *   T5 形状锁:函数定义存在、`!CHECK_ONLY` 挂点存在、`__test__` 已导出该判据;
 *   T6 边界锁:摘除只认字面量 `filter.lfs`(非 lfs 的名字不许被任何动态段带进删除命令)。
 *
 * 为什么 T5/T6 读源码而不跑函数:本函数会真改本机 system/global gitconfig,镜像测试必须
 * 零副作用;行为维只能靠"挂点/导出/删除面"的形状锁钉住(与既有 dispatch 类镜像测试同款)。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { __test__ as G } from '../git-guardian.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

test('T1 空输出 ⇒ 空清单(无匹配 = 干净,不是取不到)', () => {
  assert.deepEqual(G.parseGitFilterKeys(''), [])
  // undefined/null 也不得炸:探针层已把"无匹配"归成空串,null 只代表取不到,由调用方判未判定
  assert.deepEqual(G.parseGitFilterKeys(null), [])
  assert.deepEqual(G.parseGitFilterKeys('   \r\n\r\n  '), [])
})

test("T2 四条 filter.lfs.* ⇒ ['lfs'](同名前缀只留一枚)", () => {
  const raw = [
    'filter.lfs.clean',
    'filter.lfs.smudge',
    'filter.lfs.process',
    'filter.lfs.required',
  ].join('\n')
  assert.deepEqual(G.parseGitFilterKeys(raw), ['lfs'])
})

test("T3 混合 lfs + foo ⇒ ['lfs','foo'] 按首次出现顺序", () => {
  const lfsFirst = ['filter.lfs.clean', 'filter.lfs.required', 'filter.foo.clean'].join('\n')
  assert.deepEqual(G.parseGitFilterKeys(lfsFirst), ['lfs', 'foo'])
  // 反向顺序也必须保序(证明不是按字母排序,也不是按 key 归类)
  const fooFirst = ['filter.foo.smudge', 'filter.lfs.process'].join('\n')
  assert.deepEqual(G.parseGitFilterKeys(fooFirst), ['foo', 'lfs'])
})

test('T4 CRLF / 前后空白 / 空行 / 非 filter 行都不干扰', () => {
  const raw = [
    '',
    '  filter.lfs.clean  ',
    '\t',
    'filter.lfs.required\r',
    'core.autocrlf\r',
    'filter.foo.process\r',
    '',
  ].join('\r\n')
  assert.deepEqual(G.parseGitFilterKeys(raw), ['lfs', 'foo'])
})

test('T5 形状锁:定义存在 ∧ !CHECK_ONLY 挂点存在 ∧ 判据已进 __test__ 出口', () => {
  assert.equal(typeof G.parseGitFilterKeys, 'function')
  assert.equal(typeof G.auditGitFilterResidue, 'function')
  assert.ok(
    /function auditGitFilterResidue\(\) \{/.test(SRC),
    'auditGitFilterResidue 的定义不见了(挂点会当场 ReferenceError)',
  )
  assert.ok(
    SRC.includes('if (!CHECK_ONLY) auditGitFilterResidue()'),
    '挂点必须带 !CHECK_ONLY:--check 是零副作用档,破坏性摘除绝不能进只读档',
  )
  // 挂点必须排在函数定义之后、且与既有巡检腿同格(健康轮次早退之前)
  const defAt = SRC.indexOf('function auditGitFilterResidue() {')
  const callAt = SRC.indexOf('if (!CHECK_ONLY) auditGitFilterResidue()')
  assert.ok(defAt > 0 && callAt > defAt, '挂点顺序错:调用必须排在定义之后')
  assert.ok(
    SRC.indexOf('if (!CHECK_ONLY) auditHostTimezone()') < callAt,
    '挂点语义:本腿紧随 auditHostTimezone(),同属"健康轮次早退之前"那一族',
  )
})

test('T6 边界锁:自动摘除只认字面量 filter.lfs,非 lfs 名字不许进删除命令', () => {
  // 只有 lfs 才走摘除分支(names.every(n => n === 'lfs') 是唯一闸)
  assert.ok(/every\(\(n\) => n === 'lfs'\)/.test(SRC), '"只有 lfs 才自动摘除"的闸被改掉了')
  // --remove-section 的段名必须是字面量 'filter.lfs';出现模板/变量注入 = 别人的 filter 可能被删
  const removeSites = SRC.match(/--remove-section[^\n]*/g) || []
  const mine = removeSites.filter((s) => s.includes('filter.lfs'))
  assert.ok(mine.length >= 1, '摘除命令不见了(自动摘除腿被摘掉就是哑的)')
  for (const site of mine) {
    assert.ok(/'filter\.lfs'/.test(site), `摘除段名必须是字面量 'filter.lfs',实测:${site.trim()}`)
    assert.ok(!/`|\$\{/.test(site), `摘除段名禁止动态拼接(那是删别人 filter 的通道):${site.trim()}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
