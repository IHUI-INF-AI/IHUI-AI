#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * Tauri 更新器签名(.sig / minisign)离线验签器。
 *
 * 病理:Windows 安装包被 Authenticode 签名后字节已变,若 `.sig` 还停留在覆盖前的
 * 字节上,所有已装客户端的自动更新都会在验签阶段失败(而 CI 可能全绿)。
 * 本脚本把"这份 .sig 是否确实覆盖这份字节"变成一条可执行判据:
 *   - 只读 tauri.conf.json 里钉住的 pubkey(与客户端同一把公钥,不是另一份配置);
 *   - 支持 minisign 两种算法:legacy("Ed",对文件原始字节签名)与 prehash("ED",
 *     对 Blake2b-512 摘要签名);
 *   - 校验 keyId 与 pubkey 一致,避免"签名合法但属于另一把钥匙"。
 *
 * 判据:退出码 0 = 签名覆盖该字节;1 = 不匹配/损坏;2 = 用法或读取错误(写 stderr)。
 * 用法:
 *   node scripts/desktop-updater-sig-verify.mjs --artifact <file> --signature <file.sig> \
 *     --config apps/desktop/src-tauri/tauri.conf.json
 *   node scripts/desktop-updater-sig-verify.mjs --self-test
 */
import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const B64_ALG_LEGACY = 'Ed'
const B64_ALG_PREHASH = 'ED'

/** 把 minisign 公钥文本(base64 包裹的 .pub 文件内容,或裸 42 字节 blob)解成 { keyId, key } */
export function decodeMinisignPublicKey(pubkeyBase64) {
  if (typeof pubkeyBase64 !== 'string' || pubkeyBase64.trim() === '') {
    throw new Error('pubkey 为空')
  }
  let decoded
  try {
    decoded = Buffer.from(pubkeyBase64.trim(), 'base64')
  } catch (error) {
    throw new Error(`pubkey 不是合法 base64: ${error.message}`)
  }
  let blob = decoded
  // tauri.conf.json 里的 pubkey 是整份 .pub 文件的 base64(含 untrusted comment 行)
  if (decoded.length !== 42 && decoded.toString('utf8').includes('untrusted comment:')) {
    const lines = decoded
      .toString('utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('untrusted comment:') && !line.startsWith('trusted comment:'))
    if (lines.length === 0) throw new Error('pubkey 文本里没有密钥行')
    blob = Buffer.from(lines[0], 'base64')
  }
  if (blob.length !== 42) {
    throw new Error(`minisign 公钥长度应为 42 字节(alg+keyId+key),实际 ${blob.length}`)
  }
  return {
    algorithm: blob.subarray(0, 2).toString('utf8'),
    keyId: blob.subarray(2, 10),
    key: blob.subarray(10),
  }
}

/** 读取 .sig 文件,返回 { algorithm, keyId, signature, trustedComment } */
export function decodeSignatureFile(sigText) {
  const lines = sigText.split(/\r?\n/)
  const blobLine = lines.find(
    (line) => line.trim() !== '' && !line.startsWith('untrusted comment:') && !line.startsWith('trusted comment:'),
  )
  if (!blobLine) throw new Error('.sig 文件里没有签名块')
  const blob = Buffer.from(blobLine.trim(), 'base64')
  if (blob.length !== 74) {
    throw new Error(`minisign 签名块长度应为 74 字节(alg+keyId+signature),实际 ${blob.length}`)
  }
  const trustedLine = lines.find((line) => line.startsWith('trusted comment:'))
  return {
    algorithm: blob.subarray(0, 2).toString('utf8'),
    keyId: blob.subarray(2, 10),
    signature: blob.subarray(10),
    trustedComment: trustedLine ? trustedLine.slice('trusted comment:'.length).trim() : '',
  }
}

function keyObjectFromRaw(rawKey) {
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, rawKey]),
    format: 'der',
    type: 'spki',
  })
}

/**
 * 验签主判据。artifactBytes + sigText + pubkeyBase64 → { ok, algorithm, keyId, reason }
 * 任一步不满足都返回 ok=false 且 reason 具体到"哪一项不成立",不做静默降级。
 */
export function verifyUpdaterSignature({ artifactBytes, sigText, pubkeyBase64 }) {
  try {
    const pub = decodeMinisignPublicKey(pubkeyBase64)
    const sig = decodeSignatureFile(sigText)
    if (sig.algorithm !== B64_ALG_LEGACY && sig.algorithm !== B64_ALG_PREHASH) {
      return { ok: false, reason: `未知签名算法 "${sig.algorithm}"(期望 Ed 或 ED)` }
    }
    if (!sig.keyId.equals(pub.keyId)) {
      return { ok: false, reason: `keyId 不匹配:签名 ${sig.keyId.toString('hex')},pubkey ${pub.keyId.toString('hex')}` }
    }
    const message =
      sig.algorithm === B64_ALG_PREHASH
        ? createHash('blake2b512').update(artifactBytes).digest()
        : artifactBytes
    const ok = cryptoVerify(null, message, keyObjectFromRaw(pub.key), sig.signature)
    return {
      ok,
      algorithm: sig.algorithm,
      keyId: sig.keyId.toString('hex').toUpperCase(),
      reason: ok ? '' : 'Ed25519 验签失败(.sig 覆盖的不是这份字节)',
    }
  } catch (error) {
    return { ok: false, reason: error.message }
  }
}

/** 读取 tauri.conf.json 中的 updater.pubkey(只认这一处,避免验签用的钥匙和客户端不一致) */
export function readPubkeyFromConfig(configPath) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  const pubkey = config?.plugins?.updater?.pubkey
  if (typeof pubkey !== 'string' || pubkey.trim() === '') {
    throw new Error(`${configPath} 里没有 plugins.updater.pubkey`)
  }
  return pubkey
}

/** 供 self-test 使用:用给定的 Ed25519 密钥与算法生成一份 minisign 文本 */
export function buildSignatureForTest({ artifactBytes, privateKey, publicRawKey, algorithm, keyIdHex }) {
  const keyId = Buffer.from(keyIdHex, 'hex')
  const message =
    algorithm === B64_ALG_PREHASH
      ? createHash('blake2b512').update(artifactBytes).digest()
      : artifactBytes
  const signature = cryptoSign(null, message, privateKey)
  const blob = Buffer.concat([Buffer.from(algorithm, 'utf8'), keyId, signature])
  const pubBlob = Buffer.concat([Buffer.from(algorithm, 'utf8'), keyId, publicRawKey])
  const pubkeyBase64 = Buffer.from(`untrusted comment: minisign public key\n${pubBlob.toString('base64')}\n`, 'utf8').toString('base64')
  return {
    sigText: `untrusted comment: signature\n${blob.toString('base64')}\ntrusted comment: test\n${signature.toString('base64')}\n`,
    pubkeyBase64,
  }
}

function selfTest() {
  let failures = 0
  const check = (name, ok, detail = '') => {
    if (ok) {
      console.log(`PASS ${name}`)
    } else {
      failures += 1
      console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`)
    }
  }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const publicRawKey = Buffer.from(
    publicKey.export({ format: 'der', type: 'spki' }).subarray(ED25519_SPKI_PREFIX.length),
  )
  const artifactBytes = Buffer.from('unsigned installer bytes 未签名安装包', 'utf8')
  const keyIdHex = 'B5D7E67EA2B1DB08'

  for (const algorithm of [B64_ALG_LEGACY, B64_ALG_PREHASH]) {
    const fixture = buildSignatureForTest({ artifactBytes, privateKey, publicRawKey, algorithm, keyIdHex })
    const good = verifyUpdaterSignature({
      artifactBytes,
      sigText: fixture.sigText,
      pubkeyBase64: fixture.pubkeyBase64,
    })
    check(`${algorithm}: 正确签名字节验签通过`, good.ok, good.reason)

    const tampered = Buffer.concat([artifactBytes, Buffer.from('x')])
    const bad = verifyUpdaterSignature({
      artifactBytes: tampered,
      sigText: fixture.sigText,
      pubkeyBase64: fixture.pubkeyBase64,
    })
    check(`${algorithm}: 篡改字节必须失败`, !bad.ok, bad.reason)

    const other = generateKeyPairSync('ed25519')
    const wrongKey = verifyUpdaterSignature({
      artifactBytes,
      sigText: fixture.sigText,
      pubkeyBase64: Buffer.from(
        `untrusted comment: minisign public key\n${Buffer.concat([
          Buffer.from(algorithm, 'utf8'),
          Buffer.from(keyIdHex, 'hex'),
          Buffer.from(other.publicKey.export({ format: 'der', type: 'spki' }).subarray(ED25519_SPKI_PREFIX.length)),
        ]).toString('base64')}\n`,
        'utf8',
      ).toString('base64'),
    })
    check(`${algorithm}: 换一把公钥必须失败`, !wrongKey.ok, wrongKey.reason)
  }

  // 签名块长度不足 / 非 base64 必须给出具体原因,而不是抛栈
  const truncated = verifyUpdaterSignature({
    artifactBytes,
    sigText: 'untrusted comment: x\nAAAA\n',
    pubkeyBase64: buildSignatureForTest({
      artifactBytes,
      privateKey,
      publicRawKey,
      algorithm: B64_ALG_LEGACY,
      keyIdHex,
    }).pubkeyBase64,
  })
  check('截断的 .sig 必须失败并给原因', !truncated.ok && truncated.reason.includes('长度'), truncated.reason)

  if (failures > 0) {
    console.error(`self-test 失败 ${failures} 项`)
    return 1
  }
  console.log('self-test 全部通过(legacy Ed + prehash ED 双算法、篡改/错钥匙/坏文件均判红)')
  return 0
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) {
        out[key] = true
      } else {
        out[key] = value
        i += 1
      }
    }
  }
  return out
}

function main(argv) {
  const args = parseArgs(argv)
  if (args['self-test']) return selfTest()
  const artifactPath = args.artifact
  const signaturePath = args.signature
  const configPath = args.config || 'apps/desktop/src-tauri/tauri.conf.json'
  if (!artifactPath || !signaturePath) {
    console.error('用法: node scripts/desktop-updater-sig-verify.mjs --artifact <file> --signature <file.sig> [--config tauri.conf.json]')
    return 2
  }
  let artifactBytes
  let sigText
  let pubkeyBase64
  try {
    artifactBytes = readFileSync(artifactPath)
    sigText = readFileSync(signaturePath, 'utf8')
    pubkeyBase64 = readPubkeyFromConfig(configPath)
  } catch (error) {
    console.error(`读取失败: ${error.message}`)
    return 2
  }
  const result = verifyUpdaterSignature({ artifactBytes, sigText, pubkeyBase64 })
  if (!result.ok) {
    console.error(`::error::更新器签名无效: ${artifactPath} —— ${result.reason}`)
    return 1
  }
  console.log(
    `OK: ${artifactPath} 的 .sig 覆盖该文件字节(alg=${result.algorithm}, keyId=${result.keyId}, ${artifactBytes.length} 字节)`,
  )
  return 0
}

export const __test__ = {
  decodeMinisignPublicKey,
  decodeSignatureFile,
  verifyUpdaterSignature,
  buildSignatureForTest,
  readPubkeyFromConfig,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) process.exit(main(process.argv.slice(2)))
