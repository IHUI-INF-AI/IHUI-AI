// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 可达键算式(scripts/lib/rn-carried-keys)的镜像测试(§22c:import 源判据,零复制)。
 *
 * 立因(2026-10-26 现读):小程序端承载 RN 壳/共享屏的页面,取词走端内包;
 * 而承载页闭包用到的键有一批只住在 `packages/i18n/messages/mobile-rn/*.json`。
 * HEAD 面现读:承载页 6 枚 / 闭包 19 枚文件 / 可达键 73 个 / 端内包取不到 26 个
 * ⇒ 页面上就是 `common.gotIt` 这种原始键名。本尺是"功能轴"那一格的判据本体
 * (编译通过、类名覆盖都不证明"文字到位")。
 *
 * 钉死五件事:
 *   K1 `t('a.b')` 取键:带插值/带第二参都算,模板串与变量键**不算**(算不出就是不算);
 *   K2 `pickByPath` 只走对象层,数组/标量中途即取不到;
 *   K3 `subsetMissing` 只补端内没有的键(端内已有的措辞一律不被 RN 包覆盖)—— 这是"零新译"的边界;
 *   K4 词包解码用与运行时同一条 base64→gunzip→JSON 路,且 `flattenKeys` 摊平口径与 `pickByPath` 对齐;
 *   K5 接线锁:生成器与门 251 import 的是这一份算式(不许出现第二套可达键判据)。
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { extractTKeys, pickByPath, subsetMissing, flattenKeys, decodePackB64, extractStringConst } from '../lib/rn-carried-keys.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
test('K1 取键:带参/带插值都算,模板串与变量键不算', () => {
  const text = [
    "const a = t('common.gotIt')",
    "const b = t('login.platformWechat', { n: 1 })",
    'const c = i18n.t(`dynamic.${x}`)',
    "const d = t(key)",
    "const e = t('ns.sub.deep.key')",
  ].join('\n')
  assert.deepEqual([...extractTKeys(text)].sort(), ['common.gotIt', 'login.platformWechat', 'ns.sub.deep.key'])
})

test('K2 pickByPath 逐段下钻:数组下标也走得通(词包里没有这种键,但算式不许在这里崩)', () => {
  const pack = { login: { platform: { wechat: 'W' } }, list: [{ a: 1 }] }
  assert.equal(pickByPath(pack, 'login.platform.wechat'), 'W')
  assert.equal(pickByPath(pack, 'list.0.a'), 1, '下钻按属性取,数组下标天然可取')
  assert.equal(pickByPath(pack, 'login.missing'), undefined)
  assert.equal(pickByPath(pack, 'login.platform.wechat.deeper'), undefined, '标量下面再钻必须停,不得抛')
})

test('K3 只补端内没有的键(RN 包不得覆盖端内已定措辞)', () => {
  const have = [{ login: { title: '端内已定' } }, { common: { gotIt: '知道了' } }]
  const rn = { login: { title: 'RN 写法', platformWechat: '微信' }, common: { gotIt: '知道了RN', loadFailed: '加载失败' } }
  const sub = subsetMissing(have, new Set(['login.title', 'common.gotIt', 'login.platformWechat', 'common.loadFailed']), rn)
  assert.deepEqual(sub, { login: { platformWechat: '微信' }, common: { loadFailed: '加载失败' } })
  assert.equal(flattenKeys(sub).size, 2, '补的只有这两条')
})

test('K4 解码与运行时同路:base64→gunzip→JSON,摊平键与取值同一口径', () => {
  const { gzipSync, strToU8 } = createRequire(join(ROOT, 'apps/miniapp-taro/package.json'))('fflate')
  const obj = { common: { gotIt: 'OK' }, login: { platform: { wechat: 'WeChat' } } }
  const b64 = Buffer.from(gzipSync(strToU8(JSON.stringify(obj)), { level: 9, mtime: 0 })).toString('base64')
  const src = `export const ZH_CN_PACK_B64 = '${b64}'\n`
  const decoded = decodePackB64(extractStringConst(src, 'ZH_CN_PACK_B64'), ROOT)
  assert.deepEqual([...flattenKeys(decoded)].sort(), ['common.gotIt', 'login.platform.wechat'])
  assert.equal(pickByPath(decoded, 'login.platform.wechat'), 'WeChat')
  assert.equal(extractStringConst(src, 'NO_SUCH_CONST'), null, '抠不到就是抠不到,不猜')
})

test('K5 接线锁:生成器与门都 import 这一份算式,门里不许多出一套取键判据', () => {
  // 读工作树副本而不是 HEAD:本锁钉的是"这一枚把两头都接上了",而它与被测代码同批落地,
  // 落地前的 HEAD 上还没有那些 import(与 rn-shell-refs S4 同一先例,但这里不必给自己开红的口子)。
  const gen = readFileSync(join(ROOT, 'scripts/gen-i18n-compressed.mjs'), 'utf8')
  const gate = readFileSync(join(ROOT, 'scripts/check-rn-compat-coverage.mjs'), 'utf8')
  assert.match(gen, /from '\.\/lib\/rn-carried-keys\.mjs'/, '生成器没接这条算式')
  assert.match(gate, /from '\.\/lib\/rn-carried-keys\.mjs'/, '门 251 没接这条算式 ⇒ 判据与补键各算一套,必然漂移')
  assert.equal(/T_KEY_RE|function extractTKeys/.test(gate), false, '门里出现了第二份取键判据')
  assert.match(gate, /makeReader\('head'\)/, 'C10 的锚点必须落在 HEAD 面上(差值棘轮的锚点不得取自被审面自己)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
