// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { TARGETS } from './lib/i18n-scan-targets.mjs'
import { scanCode, isInUsedNamespace, walkDir } from './_i18n-scan-helpers.mjs'

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const MESSAGES_DIR = join(process.cwd(), 'packages', 'i18n', 'messages')
// **仓根从 import.meta.url 推导,不用 cwd**:要扫的"消费者代码"永远是本仓的源码,
// 与调用者的 cwd 无关。(cwd 只决定"改哪份词包",那是测试通道需要的可换面。)
// 硬编码绝对路径是本仓明令禁止的(见各脚本头注),故走脚本自身位置推导。
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 2026-10-05 加装:**删除前必须验"这个键还有没有消费者"**。
 *
 * 成因(实证,不是推演):`154f407499`(2026-09-26)「摘除 8 条零消费者死腿 + 同批清 12 个语言包死键」
 * 一批删掉 miniapp-taro 的 `verify.*`(6 键)/ `Menu.d1` / `tail.8` / `tail.12` / `VerifyCodeModal.p2,p3` /
 * `VoiceInput.p1` 共 12 键;而**同一枚提交的父提交**里 `Menu.tsx:57` 已在 `tt('Menu.d1','音乐')`、
 * `VerifyCodeModal.tsx` 已在 `tt('verify.phoneEmpty','手机号为空')` 等 9 处、
 * `VoiceInput.tsx:65` 已在 `tt('VoiceInput.p1','录音启动失败')`、
 * `PageLoading.tsx:12` 已在 `t('tail.8')` —— 逐条 `grep -c` 都数得到,四个文件**都不在**那 8 条死腿之列
 * (该提交正文自己写着"Menu/VoiceInput 本就不在其中")。
 *
 * 为什么审计器没拦住(这是本票要修的真机制,不是"再加一道扫描"):
 *   死键审计判的是"**键还在包里、但代码里没人引**"⇒ 删掉一个键之后,它连"键存在"都不成立了,
 *   自然永远报不出这一格。**删除动作本身没有任何出口会验证**,于是
 *   "审计读数 0"被当成了"可以随便删"的许可证 —— 而读数 0 只说明"剩下的都没被引",
 *   对"我要删的这几个还有没有被引"一个字都没说。
 *   审计器给出的答案方向是反的:它能证明"死"的那一族里没有你要删的键,前提是**你删之前问它**;
 *   不问就删,证据就永远晚于事实。
 *
 * 因此:本器复用审计器**同一份**取材面与判据(scanCode / isInUsedNamespace),
 * 删之前逐键验一次;**有消费者 ⇒ 整批拒删、点名、退出码非零**,不留 `--force` 逃生口
 * ——删活键没有"正当理由"可言,真要删先改代码。(§12e:这是 fail-closed,不产生恒红门,
 * 因为它只在真有人要删活键时才响,而那正是它该响的时刻。)
 *
 * **取材面不许在本器里另抄一份**:scanTargets 取自上面 import 的 TARGETS ——
 * 两处各写一份,就是"审计器看不见的死键"那一型的复发。
 */
export function collectConsumers(targetName) {
  const cfg = TARGETS[targetName]
  if (!cfg) {
    console.warn('[WARN] 未知 target(在 scan-dead-i18n-keys.mjs 的 TARGETS 里没有): ' + targetName)
    return null
  }
  const files = []
  for (const dir of cfg.scanTargets) {
    const full = join(ROOT, dir)
    if (!existsSync(full)) {
      console.warn('[WARN] scanTarget 不存在: ' + dir)
      continue
    }
    // 遍历与取材剪枝走 helpers 的 walkDir —— 与审计器同一份,本器不另写一遍目录剪枝
    files.push(...walkDir(full))
  }
  const { staticRefs, usedNamespaces } = scanCode(files)
  return { staticRefs, usedNamespaces, scanned: files.length }
}

/** 键 ns.sub.leaf 在给定消费者的取材面下是否仍被引用。 */
export function isStillConsumed(dottedKey, consumers) {
  if (!consumers) return true // 取材失败 ⇒ 未判定,按"还有消费者"处理(fail-closed)
  if (consumers.staticRefs.has(dottedKey)) return true
  // 命名空间被整体引用时(动态拼接),该 ns 下的键一律视为在用 —— 与审计器同一条口径
  if (isInUsedNamespace(dottedKey, consumers.usedNamespaces)) return true
  return false
}

const MOBILE_RN_DEAD = {
  activityDetail: ['loadFailed'],
  agentReviewDetail: ['loadFailed'],
  debug: [
    'apiBaseUrl', 'clearCache', 'clearStorage', 'cleared', 'confirm',
    'copied', 'copyFailed', 'copyLogs', 'env', 'locale', 'platform',
    'title', 'version', 'warning',
  ],
  exam: ['startHint'],
  helpDetail: ['loadFailed'],
  lecturerDetail: ['loadFailed'],
  taskDispatch: [
    'title', 'inputPlaceholder', 'send', 'sending', 'loadTasksFailed',
    'loadDevicesFailed', 'selectDeviceFirst', 'dispatchFailed', 'emptyTasks',
    'noDevices', 'target',
    'status.pending', 'status.running', 'status.completed', 'status.failed', 'status.cancelled',
    'cancel.cancelButton', 'cancel.cancelling', 'cancel.cancelFailed',
    'reconnect.reconnecting',
    'file.attach', 'file.attached', 'file.tooLarge', 'file.invalidBase64',
    'file.missingFilename', 'file.filenamePlaceholder', 'file.mimePlaceholder', 'file.contentPlaceholder',
  ],
}

const MINIAPP_TARO_DEAD = {
  news: ['views'],
}

function removeKeys(obj, deadMap) {
  for (const [ns, keys] of Object.entries(deadMap)) {
    if (!(ns in obj)) {
      console.warn('[WARN] namespace "' + ns + '" not found')
      continue
    }
    for (const key of keys) {
      const parts = key.split('.')
      let cur = obj[ns]
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === null || cur[parts[i]] === undefined) {
          console.warn('[WARN] path "' + ns + '.' + key + '" broken at "' + parts[i] + '"')
          break
        }
        cur = cur[parts[i]]
      }
      const leaf = parts[parts.length - 1]
      if (cur !== null && cur !== undefined && leaf in cur) {
        delete cur[leaf]
      } else {
        console.warn('[WARN] key "' + ns + '.' + key + '" not found')
      }
    }
    if (Object.keys(obj[ns]).length === 0) {
      delete obj[ns]
    }
  }
}

/**
 * 删之前先验:把本批要删的键逐条送进消费者判据。
 * 返回 true = 整批可以删;false = 有键仍被引用,调用方必须整批拒删(半批删是更坏的结果:
 * 删掉一部分活键,剩下的"看起来对",没人会再回头查)。
 */
export function verifyAllDead(deadMap, consumers, targetLabel) {
  const alive = []
  for (const [ns, keys] of Object.entries(deadMap)) {
    for (const key of keys) {
      // 死键清单里的 key 可以自带点号(如 `status.pending` / `file.attach`),
      // 拼出的全名恒为 `ns + '.' + key`,与 removeKeys 里的删除路径逐字同一条。
      const dotted = `${ns}.${key}`
      if (isStillConsumed(dotted, consumers)) alive.push(dotted)
    }
  }
  if (alive.length === 0) return true
  console.error(
    `\n❌ 拒删(${targetLabel}):下面 ${alive.length} 个键**仍有代码消费者**,本批一律不动。\n` +
      alive.map((k) => `   - ${k}`).join('\n') +
      `\n   这些键是被 ` +
      `154f407499 一类"按清单删键"的动作误删过的同族(见本文件头注)。` +
      `\n   要删它们,先改代码;若你认为判据错了,改的是判据(判据只有一份:` +
      `scripts/_i18n-scan-helpers.mjs),不是在这里开逃生口。\n`,
  )
  return false
}

function processFile(relPath, deadMap, consumers, targetLabel) {
  const fullPath = join(MESSAGES_DIR, relPath)
  if (!existsSync(fullPath)) {
    console.warn('[WARN] file not found: ' + fullPath)
    return
  }
  const raw = readFileSync(fullPath, 'utf-8')
  const obj = JSON.parse(raw)
  const beforeKeys = JSON.stringify(Object.keys(obj).sort())
  removeKeys(obj, deadMap)
  writeFileSync(fullPath, JSON.stringify(obj, null, 2) + '\n', 'utf-8')
  console.log(relPath + ': ' + beforeKeys.slice(0, 40) + '...')
}

// 本文件既可 CLI 直跑,也可被镜像测试 import(§22c:源文件 export + isDirectRun 守卫)。
// 守卫的意义是实的:没有它,测试 import 就会真的去删词包。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  // 消费者取材:两个 target 各取一次(判据与 scan-dead-i18n-keys.mjs 同一份,见头注)
  const CONSUMERS_MOBILE_RN = collectConsumers('mobile-rn')
  const CONSUMERS_MINIAPP = collectConsumers('miniapp-taro')

  let refused = 0
  if (!verifyAllDead(MOBILE_RN_DEAD, CONSUMERS_MOBILE_RN, 'mobile-rn')) refused++
  if (!verifyAllDead(MINIAPP_TARO_DEAD, CONSUMERS_MINIAPP, 'miniapp-taro')) refused++

  if (refused > 0) {
    console.error(`\n❌ 一键都没删(${refused} 个 target 拒删)。删活键没有"正当理由"可言 —— 先改代码。`)
    process.exit(1)
  }

  for (const loc of LOCALES) {
    processFile(join('mobile-rn', loc + '.json'), MOBILE_RN_DEAD)
  }

  for (const loc of LOCALES) {
    processFile(join('miniapp-taro', loc + '.json'), MINIAPP_TARO_DEAD)
  }

  console.info('\nDone')
  // ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

}
