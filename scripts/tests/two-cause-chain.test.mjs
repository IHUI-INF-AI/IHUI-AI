// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-697(2026-10-03):双因果链合成器的镜像测试。
 *
 * 验收判据(逐字取自台账 G-697):镜像用例「主体失败+释放失败 ⇒ AggregateError.errors
 * 两项都在且 message 点名两因果链」—— T1 就是这条。
 * 其余为反向对照(§22c:没有反例的正例是复读机):
 *   T2 只有主体失败 ⇒ 抛的是**主体错误本身**(同一实例,不包装 —— 调用方的
 *      instanceof / code 判据不得被丢掉);
 *   T3 只有释放失败 ⇒ 抛释放错误(必须响,不得吞);
 *   T4 都不失败 ⇒ 返回 work 的结果值;
 *   T5 接线证明:deploy-lock 的 runUnderLock catch 路径真的经 throwTwoCauseChain
 *      合成(源码形状锁,不在测试里重跑整条 CLI);
 *   T6 git-lock 同出口:顶层 re-export 在位(消费方 import { runWithRelease } 可用)。
 * 全程零派生、零真实锁目录(测试隔离铁律):runUnderLock 只做源码形状锁,不真跑。
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runWithRelease, throwTwoCauseChain } from '../lib/two-cause-chain.mjs'
import * as gitLock from '../git-lock.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('T1 验收判据:主体失败+释放失败 ⇒ AggregateError.errors 两项都在且 message 点名两因果链', async () => {
  const mainError = new Error('构建在第 3 步失败:exit 1')
  const releaseError = new Error('锁文件删除失败: EBUSY resource busy')
  await assert.rejects(
    () =>
      runWithRelease({
        work: () => {
          throw mainError
        },
        release: () => {
          throw releaseError
        },
        label: 'deploy-lock run',
      }),
    (e) => {
      assert.ok(e instanceof AggregateError, `必须是 AggregateError,实为 ${e?.constructor?.name}`)
      assert.equal(e.errors.length, 2, '两条因果链都必须在 errors 里,谁也不顶掉谁')
      assert.equal(e.errors[0], mainError, 'errors[0] 是主体失败(同一实例)')
      assert.equal(e.errors[1], releaseError, 'errors[1] 是释放失败(同一实例)')
      assert.match(e.message, /主体/, '聚合 message 必须点名主体链')
      assert.match(e.message, /释放/, '聚合 message 必须点名释放链')
      assert.match(e.message, /构建在第 3 步失败/, '聚合 message 含主体 message')
      assert.match(e.message, /EBUSY/, '聚合 message 含释放 message')
      return true
    },
  )
})

test('T2 反向对照:只有主体失败 ⇒ 抛主体错误本身(同一实例,不包 AggregateError)', async () => {
  const mainError = new Error('只有主体失败')
  await assert.rejects(
    () =>
      runWithRelease({
        work: () => {
          throw mainError
        },
        release: () => {},
      }),
    (e) => {
      assert.equal(e, mainError, '必须是同一实例 —— 包装成别的形状会丢调用方的判据')
      assert.ok(!(e instanceof AggregateError), '单失败不得包成 AggregateError')
      return true
    },
  )
})

test('T3 反向对照:只有释放失败 ⇒ 抛释放错误(必须响,不得静默)', async () => {
  const releaseError = new Error('只有释放失败')
  await assert.rejects(
    () =>
      runWithRelease({
        work: () => 'ok',
        release: () => {
          throw releaseError
        },
      }),
    (e) => {
      assert.equal(e, releaseError)
      return true
    },
  )
})

test('T4 反向对照:都不失败 ⇒ 返回 work 的结果值,release 必被调用', async () => {
  let releaseCalled = 0
  const result = await runWithRelease({
    work: () => ({ rc: 0 }),
    release: () => {
      releaseCalled += 1
    },
  })
  assert.deepEqual(result, { rc: 0 })
  assert.equal(releaseCalled, 1, 'work 成功后 release 也必须跑一次')
})

test('T5 接线证明:deploy-lock runUnderLock 的 catch 路径经 throwTwoCauseChain 合成', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/deploy-lock.mjs'), 'utf8')
  assert.match(
    src,
    /import \{ throwTwoCauseChain \} from '\.\/lib\/two-cause-chain\.mjs'/,
    'deploy-lock 必须引共用合成器',
  )
  assert.match(src, /catch \(mainErr\)/, 'runUnderLock catch 形状在位')
  assert.match(
    src,
    /relOutcome && relOutcome\.error[\s\S]{0,300}throwTwoCauseChain\(\{[\s\S]{0,200}mainError: mainErr,[\s\S]{0,200}releaseError: relOutcome\.error,/,
    '双失败必须经合成器抛 AggregateError —— 释放失败不得只 warn 后丢掉',
  )
})

test('T6 git-lock 同出口:顶层 re-export 在位且来自唯一实现', () => {
  assert.equal(
    typeof gitLock.runWithRelease,
    'function',
    '消费方应能 import { runWithRelease } from git-lock',
  )
  assert.equal(typeof gitLock.throwTwoCauseChain, 'function')
  const src = readFileSync(resolve(ROOT, 'scripts/git-lock.mjs'), 'utf8')
  assert.match(
    src,
    /export \{ runWithRelease, throwTwoCauseChain \} from '\.\/lib\/two-cause-chain\.mjs'/,
    '必须是 re-export 唯一实现,不得在 git-lock 抄第二份',
  )
})

test('T7 throwTwoCauseChain 直用:label 进 message;无失败调用显式报错不静默', () => {
  assert.throws(
    () =>
      throwTwoCauseChain({ mainError: new Error('A'), releaseError: new Error('B'), label: 'x' }),
    (e) => e instanceof AggregateError && e.message.startsWith('[x] '),
  )
  assert.throws(() => throwTwoCauseChain({ mainError: null, releaseError: null }), /不得静默吞/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
