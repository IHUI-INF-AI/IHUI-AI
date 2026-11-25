// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 攻击工具指纹(2026-11-24 三轮)。
 *
 * 干什么:从 User-Agent / 常见扫描头里认出"对手用的是什么工具",好把那句话从
 * 「你被记录了」升级成「你用的工具我认识」—— 后者对脚本作者的心理压力完全不同。
 *
 * 两条纪律:
 *   ① **只认明确工具名**,不认 `curl` / `python-requests` / `go-http-client`:
 *      这些是我们自己的监控、CI、合法爬虫天天在用的,写进"你是攻击工具"就是冤枉人;
 *   ② **措辞只说"携带…特征"**,不说"你是 X":UA 可以伪造,断言身份会被对手反将一军;
 *      说"携带特征"是事实,他伪造也只能证明"他故意伪装成 X",反而更像攻击者。
 *
 * 纯函数,零 IO;识别不到就返回 null,调用方据此不加那一段。
 */
const SIGNATURES = [
  ['sqlmap', /\bsqlmap\b/i],
  ['Nikto', /\bnikto\b/i],
  ['Nuclei', /\bnuclei(?:-|_)?(?:v?\d|\b)/i],
  ['Nmap', /\bnmap\b|\bnmap-nse\b/i],
  ['masscan', /\bmasscan\b/i],
  ['zgrab', /\bzgrab\b/i],
  ['Xray', /\bxray\b|\bxpoc\b/i],
  ['Acunetix', /\bacunetix\b|\bawvs\b/i],
  ['AppScan', /\bappscan\b/i],
  ['dirsearch', /\bdirsearch\b/i],
  ['gobuster', /\bgobuster\b/i],
  ['ffuf', /\bffuf\b/i],
  ['WPScan', /\bwpscan\b/i],
  ['JoomScan', /\bjoomscan\b/i],
  ['Burp Suite', /\bburp(?:suite|collaborator|proxy)?\b/i],
  ['OWASP ZAP', /\bzaproxy\b|\bowasp[- ]?zap\b/i],
  ['Hydra', /\bhydra\b/i],
  ['Metasploit', /\bmetasploit\b|\bmsfconsole\b/i],
  ['Nessus', /\bnessus\b/i],
  ['OpenVAS', /\bopenvas\b/i],
  ['Censys', /\bcensys\b/i],
]

/** 除了 UA,扫描器还常在自带头里露名字(如 `X-Scanner`、`X-Check`)。 */
const EXTRA_HEADERS = ['x-scanner', 'x-scan', 'x-check', 'x-tool', 'x-attack']

/**
 * @param {string} ua           User-Agent 原文
 * @param {object} headers      请求头(小写键即可,大小写都接受)
 * @returns {{id:string,name:string}|null}
 */
export function identifyTool(ua = '', headers = {}) {
  const parts = [String(ua ?? '')]
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (EXTRA_HEADERS.includes(String(k).toLowerCase())) parts.push(String(v ?? ''))
  }
  const hay = parts.join(' ')
  if (!hay.trim()) return null
  for (const [name, re] of SIGNATURES) {
    if (re.test(hay)) return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name }
  }
  return null
}

export const __test__ = { identifyTool, SIGNATURES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
