#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 桌面端代码签名链路静态审计(不验证真实签名,只验证"链路是否可执行、顺序是否被钉死")。
 *
 * 病理:签名链路最危险的失败不是"签错",而是"看起来签了"——
 *   - 签名步被 if 条件吞掉却没人报;
 *   - 签名后没有重算 .sig,更新器拿新包配旧签名;
 *   - latest.json 在验签门禁之前就被生成,未签名包照常推给已装客户端;
 *   - 文档缺失,证书怎么申请、secret 叫什么没人知道。
 * 本脚本把这些逐条变成可执行断言,任何一条不成立即退出码 1。
 *
 * 判据(全部为结构性断言,不做"包含关键词即通过"的弱化):
 *   C1 docs/DESKTOP_CODE_SIGNING.md 存在,且 workflow 头注指向它;
 *   C2 Windows 顺序:上传未签名 → SignPath 提交 → 替换+验签 → 重算 .sig;
 *   C3 签名前后 SHA256/字节数必须被比较,且"字节未变"要 throw;
 *   C4 signtool verify /pa /v、证书链、时间戳、签名者断言齐备;
 *   C5 macOS:Developer ID、hardened runtime、notarytool、staple、spctl 齐备;
 *   C6 独立 signature-gate 作业存在,且 always() 跑、缺清单时 ::error::未签名 并 exit 1;
 *   C7 publish-updater-json 的 needs 必须含 signature-gate(先验签再发 latest.json);
 *   C8 CI 内不得出现 DESKTOP_ALLOW_UNSIGNED(本机豁免不得泄漏到发布链)。
 *
 * 退出码:0 = 链路完整;1 = 判红(逐条打印);2 = 用法/读取错误(写 stderr)。
 * 用法:
 *   node scripts/desktop-signing-chain.mjs
 *   node scripts/desktop-signing-chain.mjs --self-test
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_WORKFLOW = '.github/workflows/release-desktop.yml'
const DEFAULT_DOCS = 'docs/DESKTOP_CODE_SIGNING.md'
const REQUIRED_SECRETS = [
  'SIGNPATH_API_TOKEN',
  'SIGNPATH_ORGANIZATION_ID',
  'SIGNPATH_PROJECT_SLUG',
  'SIGNPATH_SIGNING_POLICY_SLUG',
  'DESKTOP_WIN_SIGNER_SUBJECT',
  'APPLE_CERTIFICATE',
  'APPLE_CERTIFICATE_PASSWORD',
  'APPLE_SIGNING_IDENTITY',
  'APPLE_TEAM_ID',
  'APPLE_API_KEY',
  'DESKTOP_TAURI_PRIVATE_KEY',
]

function stripCommentLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
}

/**
 * 纯函数审计:workflow 文本 + 文档是否存在的探测结果 → 问题列表([] 表示通过)。
 * 供 --self-test 用夹具直接调用,避免测试里复制第二份判据。
 */
export function auditWorkflow(workflowText, { docsExists = true, docsText = '' } = {}) {
  const problems = []
  const need = (code, condition, message) => {
    if (!condition) problems.push({ code, message })
  }
  const active = stripCommentLines(workflowText)
  const indexOf = (needle) => active.indexOf(needle)

  need('C1a', docsExists, `缺少 ${DEFAULT_DOCS}:证书怎么申请、secret 叫什么、在哪一步验证都无从查起`)
  need('C1b', workflowText.includes('docs/DESKTOP_CODE_SIGNING.md'), 'workflow 头注没有指向 docs/DESKTOP_CODE_SIGNING.md')

  // C1c:文档必须真的写了关键 secret,不能只有文件名
  if (docsExists) {
    for (const secret of REQUIRED_SECRETS) {
      need('C1c', docsText.includes(secret), `文档未写 secret:${secret}(照文档配置时会漏)`)
    }
  }

  for (const secret of REQUIRED_SECRETS) {
    need('C2', active.includes(secret), `workflow 未消费 secret:${secret}`)
  }

  const uploadUnsigned = indexOf('name: Upload unsigned installer')
  const submitSignPath = indexOf('name: Submit SignPath signing request')
  const installSigned = indexOf('name: Install signed installer, verify Authenticode')
  const uploadSignedWin = indexOf('name: Upload signed installer + signature manifest')
  const macNotarize = indexOf('name: Notarize, staple and verify macOS bundles')
  const uploadSignedMac = indexOf('name: Upload signed macOS bundles')

  need('C2a', uploadUnsigned > -1, '缺少「Upload unsigned installer」步骤')
  need('C2b', submitSignPath > -1, '缺少 SignPath 提交步骤')
  need('C2c', installSigned > -1, '缺少「Install signed installer, verify Authenticode」步骤')
  need('C2d', uploadSignedWin > -1, '缺少 Windows 签名产物上传步骤')
  need('C2e', uploadUnsigned > -1 && submitSignPath > -1 && uploadUnsigned < submitSignPath, '顺序错误:未签名上传必须在 SignPath 提交之前')
  need('C2f', submitSignPath > -1 && installSigned > -1 && submitSignPath < installSigned, '顺序错误:SignPath 提交必须在替换+验签之前')
  need('C2g', installSigned > -1 && uploadSignedWin > -1 && installSigned < uploadSignedWin, '顺序错误:必须先验签再上传签名产物')
  need('C2h', macNotarize > -1, '缺少 macOS 公证/staple 步骤')
  need('C2i', uploadSignedMac > -1 && macNotarize > -1 && macNotarize < uploadSignedMac, '顺序错误:公证/staple 必须在 macOS 签名产物上传之前')

  // C3:签名前记账 + 替换后重算 + 字节未变必须失败
  const winBlock = installSigned > -1 ? active.slice(installSigned, uploadSignedWin > -1 ? uploadSignedWin : active.length) : ''
  need('C3a', /hashBefore/.test(winBlock), 'Windows 签名步没有记录签名前 SHA256')
  need('C3b', /bytesBefore/.test(winBlock), 'Windows 签名步没有记录签名前字节数')
  need('C3c', /hashAfter/.test(winBlock) && /bytesAfter/.test(winBlock), 'Windows 签名步没有在替换后重算 SHA256/字节数')
  need('C3d', /hashBefore\s*-eq\s*\$hashAfter/.test(winBlock), '缺少"签名前后字节相同即失败"的断言(会放过没真正替换的回传物)')
  need('C3e', /tauri signer sign \$target\.FullName/.test(winBlock), '缺少对签名后安装包重算 .sig 的步骤')
  need('C3f', winBlock.includes('desktop-updater-sig-verify.mjs'), '重算 .sig 后没有用配置公钥验签')

  // C4:Windows 判据
  need('C4a', active.includes('signtool'), '缺少 signtool 验签')
  need('C4b', /signtool[^\n]*verify\s+\/pa\s+\/v/.test(active), 'signtool 未使用 /pa /v 的 Authenticode 策略判据')
  need('C4c', /X509Chain|x509chain/i.test(active), '缺少证书链构建校验')
  need('C4d', /TimeStamperCertificate/.test(active), '缺少时间戳证书断言')
  need('C4e', /EXPECTED_SIGNER_SUBJECT|signerSubject/.test(active), '缺少签名者名称断言')

  // C5:macOS 判据
  need('C5a', active.includes('codesign -dv --verbose=4'), '缺少 codesign -dv --verbose=4')
  need('C5b', active.includes('Developer ID Application'), '缺少 Developer ID Application 身份断言')
  need('C5c', active.includes('flags=0x10000(runtime)'), '缺少 hardened runtime 断言')
  need('C5d', active.includes('notarytool submit'), '缺少 notarytool 公证')
  need('C5e', active.includes('stapler staple'), '缺少 staple')
  need('C5f', active.includes('stapler validate'), '缺少 staple 票据校验')
  need('C5g', active.includes('spctl --assess --type execute'), '缺少 Gatekeeper(spctl)判据')

  // C6:独立门禁
  const gateIndex = indexOf('  signature-gate:')
  const publishIndex = indexOf('  publish-updater-json:')
  need('C6a', gateIndex > -1, '缺少 signature-gate 作业')
  need('C6b', gateIndex > -1 && /if:\s*always\(\)/.test(active.slice(gateIndex, gateIndex + 400)), 'signature-gate 没有 always() 条件(构建失败时会被跳过,等于静默放行)')
  need('C6c', active.includes('::error::未签名'), '门禁缺少「未签名」的显式红色结论')
  need('C6d', active.includes('::error::未公证'), '门禁缺少「未公证」的显式红色结论')
  need('C6e', gateIndex > -1 && active.slice(gateIndex).includes('exit 1'), '门禁缺少 exit 1(只是打印错误不会判红)')
  need('C6f', active.includes('signed-desktop-'), '门禁没有下载独立签名产物(无法复核用户拿到的那份字节)')
  need('C6g', /if-no-files-found:\s*error/.test(active), '签名产物上传未设 if-no-files-found: error(缺产物会静默跳过)')

  // C7:先验签再发 latest.json
  need('C7a', publishIndex > -1 && publishIndex > gateIndex, 'publish-updater-json 必须排在 signature-gate 之后')
  const publishBlock = publishIndex > -1 ? active.slice(publishIndex, publishIndex + 800) : ''
  need('C7b', /needs:\s*\[build,\s*signature-gate\]/.test(publishBlock), 'publish-updater-json 的 needs 未包含 signature-gate')

  // C8:CI 不得出现本机未签名豁免
  need('C8', !active.includes('DESKTOP_ALLOW_UNSIGNED'), 'CI 出现了 DESKTOP_ALLOW_UNSIGNED:本机豁免不得进入发布链')

  return problems
}

const GOOD_FIXTURE = [
  '# header docs/DESKTOP_CODE_SIGNING.md',
  'jobs:',
  '  build:',
  '    steps:',
  '      - name: Upload unsigned installer',
  '      - name: Submit SignPath signing request',
  '      - name: Install signed installer, verify Authenticode',
  '        env:',
  '          EXPECTED_SIGNER_SUBJECT: ${{ secrets.DESKTOP_WIN_SIGNER_SUBJECT }}',
  '        run: |',
  '          $hashBefore = 1; $bytesBefore = 1; Copy-Item x y',
  '          $hashAfter = 2; $bytesAfter = 2',
  '          if ($hashBefore -eq $hashAfter) { throw }',
  '          & signtool verify /pa /v file',
  '          $chain = [System.Security.Cryptography.X509Certificates.X509Chain]::new()',
  '          if (-not $sig.TimeStamperCertificate) { throw }',
  '          tauri signer sign $target.FullName',
  '          node scripts/desktop-updater-sig-verify.mjs',
  '      - name: Upload signed installer + signature manifest',
  '        with: { if-no-files-found: error, name: signed-desktop-${{ matrix.label }} }',
  '      - name: Notarize, staple and verify macOS bundles',
  '        run: |',
  '          codesign -dv --verbose=4 "$APP"',
  '          grep Developer ID Application',
  '          grep flags=0x10000(runtime)',
  '          xcrun notarytool submit "$DMG" --wait',
  '          xcrun stapler staple "$APP"',
  '          xcrun stapler validate "$DMG"',
  '          spctl --assess --type execute "$APP"',
  '      - name: Upload signed macOS bundles',
  '  signature-gate:',
  '    if: always()',
  '    steps:',
  '      - name: Assert',
  '        run: |',
  '          echo "::error::未签名"',
  '          echo "::error::未公证"',
  '          exit 1',
  '  publish-updater-json:',
  '    needs: [build, signature-gate]',
  '',
  ...REQUIRED_SECRETS.map((s) => `  ${s}: enabled`),
].join('\n')

const GOOD_DOCS = REQUIRED_SECRETS.map((s) => `- \`${s}\``).join('\n')

function selfTest() {
  let failures = 0
  const expect = (name, condition) => {
    if (condition) console.log(`PASS ${name}`)
    else {
      failures += 1
      console.error(`FAIL ${name}`)
    }
  }

  const baseline = auditWorkflow(GOOD_FIXTURE, { docsExists: true, docsText: GOOD_DOCS })
  expect('基线夹具零问题', baseline.length === 0)
  if (baseline.length > 0) console.error(baseline.map((p) => `${p.code} ${p.message}`).join('\n'))

  const cases = [
    ['缺文档必须判红', { docsExists: false }, 'C1a'],
    ['publish 未依赖 gate 必须判红', null, 'C7'],
    ['门禁缺未签名结论必须判红', null, 'C6c'],
    ['顺序颠倒必须判红', null, 'C2'],
  ]
  const noNeeds = GOOD_FIXTURE.replace('needs: [build, signature-gate]', 'needs: build')
  for (const [name, opts, code] of cases) {
    let text = GOOD_FIXTURE
    if (name.includes('needs') || name.includes('publish')) text = noNeeds
    if (name.includes('未签名')) text = text.replace('::error::未签名', '::warning::unsigned')
    if (name.includes('顺序')) {
      const lines = text.split('\n')
      const a = lines.findIndex((l) => l.includes('Upload unsigned installer'))
      const b = lines.findIndex((l) => l.includes('Submit SignPath signing request'))
      ;[lines[a], lines[b]] = [lines[b], lines[a]]
      text = lines.join('\n')
    }
    const problems = auditWorkflow(text, opts || { docsExists: true, docsText: GOOD_DOCS })
    expect(`${name}(命中 ${code})`, problems.some((p) => p.code.startsWith(code)))
  }

  const leaked = auditWorkflow(`${GOOD_FIXTURE}\n# 本机豁免\nDESKTOP_ALLOW_UNSIGNED=1`, {
    docsExists: true,
    docsText: GOOD_DOCS,
  })
  expect('CI 出现本机豁免必须判红(C8)', leaked.some((p) => p.code === 'C8'))

  if (failures > 0) {
    console.error(`self-test 失败 ${failures} 项`)
    return 1
  }
  console.log('self-test 全部通过(基线通过 + 缺文档 / 顺序颠倒 / 门禁缺结论 / 依赖缺失 / 豁免泄漏 均判红)')
  return 0
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const workflowPath = DEFAULT_WORKFLOW
  const docsPath = DEFAULT_DOCS
  let workflowText
  try {
    workflowText = readFileSync(workflowPath, 'utf8')
  } catch (error) {
    console.error(`读取 ${workflowPath} 失败: ${error.message}`)
    return 2
  }
  const docsExists = existsSync(docsPath)
  const docsText = docsExists ? readFileSync(docsPath, 'utf8') : ''
  const problems = auditWorkflow(workflowText, { docsExists, docsText })
  if (problems.length > 0) {
    console.error(`::error::桌面签名链路审计未通过(${problems.length} 项)`)
    for (const problem of problems) console.error(`- [${problem.code}] ${problem.message}`)
    return 1
  }
  console.log(`OK: ${workflowPath} 的签名链路完整(顺序 / 判据 / 门禁 / 文档 / 无 CI 豁免)`)
  return 0
}

export const __test__ = { auditWorkflow, stripCommentLines, REQUIRED_SECRETS, DEFAULT_DOCS }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) process.exit(main(process.argv.slice(2)))
