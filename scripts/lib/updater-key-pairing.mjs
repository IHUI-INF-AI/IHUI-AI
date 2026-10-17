// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端更新签名钥匙的"配对"纯判据(无 IO、无副作用,供本机发版脚本与测试共用一份真相)。
//
// 成因(2026-10-17 实测):`~/.tauri/ihui-updater.key` + `ihui-updater.key.pub` +
// `tauri.conf.json` 三样可以各自都存在、格式都合法,却**互相不属于同一把钥匙** ——
// 那天本机就躺着这样一套:私钥内嵌公钥 `2a4f1192…`、邻居 .pub 是 `392ca89b…`、
// 而 conf 里被写进去的正是后者。发版脚本当时只判 `existsSync(keyPath)`,于是它会
// 照样签出一个"构建绿、.sig 存在、但全天下没有客户端验得过"的死链包。
//
// 另一条同型陷阱:minisign 公钥文件里的 `untrusted comment: … key: <16 hex>` 与
// keynum 相等**只证明那一个文件自洽**,不证明它和任何私钥成对(注释本来就是由
// keynum 生成的)。所以判据必须比"公钥字节",不能比注释、也不能比文件名。
//
// 取材事实(全部逐字节核过):
//   · 私钥文件 = 一行 base64,解开是 minisign 文本;其最后一行再 base64 解出 158 字节
//     blob,头 6 字节魔数 `EdScB2`,明文公钥段固定落在 `len-96 .. len-64`
//     (`len-64` 之后是 secretbox 密文,本判据一律不读、不打印)。
//   · conf 的 `plugins.updater.pubkey` = 一行 base64,解开是 minisign 公钥文本,
//     第二行再 base64 解出 42 字节:`alg(2) + keynum(8) + pubkey(32)`。
//   · 注释里的 keynum 是 raw keynum 字节**逆序**的 hex。从偏移 0 读 16 位会把 2 字节
//     算法魔数(`Ed`/签名侧 `ED`)并进 keynum,凭空造出一把不存在的钥匙。

/** 从 conf 的 updater pubkey(base64 字符串)取出 keynum 与公钥字节 hex。 */
export function decodeUpdaterPubkey(confPubkeyB64) {
  if (typeof confPubkeyB64 !== 'string' || confPubkeyB64.trim() === '') {
    return { error: 'tauri.conf.json 里读不到 plugins.updater.pubkey(不是缺文件,是这一格本身没有值)' }
  }
  const lines = Buffer.from(confPubkeyB64.trim(), 'base64')
    .toString('latin1')
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
  if (lines.length < 2) return { error: '配置的 pubkey 解出来不是 minisign 公钥文本(应含注释行 + 数据行)' }
  const raw = Buffer.from(lines[1], 'base64')
  if (raw.length !== 42) return { error: `minisign 公钥 blob 应为 42 字节,实际 ${raw.length}` }
  return {
    pubHex: raw.subarray(10).toString('hex'),
    keynum: raw.subarray(2, 10).toString('hex').toUpperCase(),
    // 注释只是自洽性证据,一并取出供报错时对照,不参与配对判定
    commentKeynum: (/key: *([0-9A-Fa-f]*)/.exec(lines[0]) ?? [, ''])[1],
  }
}

/** 从 minisign 私钥文本(未再包一层的那种原始两行形态)取出内嵌的明文公钥 hex。 */
export function decodeSecretEmbeddedPub(secretText) {
  if (typeof secretText !== 'string' || secretText.trim() === '') {
    return { error: '私钥内容为空' }
  }
  const lines = secretText.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length < 2) return { error: '私钥不是 minisign 文本形态(缺注释行或数据行)' }
  const blob = Buffer.from(lines[lines.length - 1], 'base64')
  const magic = blob.subarray(0, 6).toString('latin1')
  if (magic !== 'EdScB2') return { error: `私钥魔数不是 EdScB2(实得 ${JSON.stringify(magic)},blob ${blob.length} 字节)` }
  if (blob.length < 96) return { error: `私钥 blob 过短(${blob.length} < 96),取不到内嵌公钥段` }
  return { pubHex: blob.subarray(blob.length - 96, blob.length - 64).toString('hex') }
}

/**
 * 判"这把私钥是不是配置里信任的那把"。三档结论,失败方向是多要一次说明,不是放行。
 * @returns {{verdict:'ok'|'orphan'|'undetermined', reason:string, conf?:object, secret?:object}}
 */
export function judgeUpdaterKeyPairing({ confPubkey, secretText }) {
  const conf = decodeUpdaterPubkey(confPubkey)
  if (conf.error) return { verdict: 'undetermined', reason: `配置侧无法解析:${conf.error}` }
  const secret = decodeSecretEmbeddedPub(secretText)
  if (secret.error) return { verdict: 'undetermined', reason: `私钥侧无法解析:${secret.error}` }
  const head = `私钥内嵌公钥 ${secret.pubHex} vs 配置信任公钥 ${conf.pubHex}(keynum ${conf.keynum})`
  if (secret.pubHex === conf.pubHex) return { verdict: 'ok', reason: `${head} —— 同一把`, conf, secret }
  return { verdict: 'orphan', reason: `${head} —— 不是同一把`, conf, secret }
}

/** 仅供测试造夹具:拼出一枚 `EdScB2` 私钥文本(密文段填占位,判据不读它)。 */
export function buildSecretTextFixtureForTest(pubHex) {
  const pub = Buffer.from(pubHex, 'hex')
  if (pub.length !== 32) throw new TypeError('夹具公钥必须是 32 字节 hex')
  const blob = Buffer.concat([Buffer.from('EdScB2', 'latin1'), Buffer.alloc(16), Buffer.alloc(40), pub, Buffer.alloc(64, 0xa5)])
  const inner = `untrusted comment: rsign encrypted secret key\n${blob.toString('base64')}\n`
  return Buffer.from(inner, 'latin1').toString('base64')
}

/** 仅供测试造夹具:拼出一枚 conf 形态的 updater pubkey base64。 */
export function buildConfPubkeyFixtureForTest(pubHex, keynumHex = '08DBB1A27EE6D7B5') {
  const raw = Buffer.concat([Buffer.from([0x45, 0x64]), Buffer.from(keynumHex, 'hex'), Buffer.from(pubHex, 'hex')])
  const inner = `untrusted comment: minisign public key: ${Buffer.from(keynumHex, 'hex').reverse().toString('hex').toUpperCase()}\n${raw.toString('base64')}\n`
  return Buffer.from(inner, 'latin1').toString('base64')
}

export const __test__ = {
  decodeUpdaterPubkey,
  decodeSecretEmbeddedPub,
  judgeUpdaterKeyPairing,
  buildSecretTextFixtureForTest,
  buildConfPubkeyFixtureForTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
