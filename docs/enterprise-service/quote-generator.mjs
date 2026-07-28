#!/usr/bin/env node
// IHUI-AI 企业版报价单生成器
// 用法:
//   node quote-generator.mjs --tier=<starter|business|enterprise|custom> \
//     --customers=<n> --duration=<months> [--customer=<name>] [--contact=<人>] \
//     [--discount=<0-30>] [--pdf=<输出路径.pdf>]
// 输出: markdown 报价单到 stdout;--pdf 可选(需项目已安装 puppeteer,缺失时降级仅输出 markdown)。
// 依赖: 仅 Node.js 内置模块;PDF 走动态 import('puppeteer'),不引入新包。

import process from 'node:process';
import { writeFileSync } from 'node:fs';

const TIERS = {
  starter: {
    name: 'Starter 入门版',
    annual: 50000,
    userCap: 50,
    overagePerUser: 800,
    sla: '99.5%',
    response: '8h(邮件)',
    support: '邮件支持',
    features: ['基础 AI 对话', '知识库(≤5 个)', '单端(Web)', '社区版全部功能', '邮件支持'],
    deployment: 'SaaS 公有云',
  },
  business: {
    name: 'Business 商业版',
    annual: 100000,
    userCap: 200,
    overagePerUser: 500,
    sla: '99.9%',
    response: '4h(工单+群)',
    support: '工单 + 专属客户群',
    features: ['完整 AI 厂商接入(9 家)', '知识库(无限)', 'Agent + 工作流', '8 端覆盖', '工单+群支持 4h 响应'],
    deployment: 'SaaS 公有云',
  },
  enterprise: {
    name: 'Enterprise 企业版',
    annual: 300000,
    userCap: Infinity,
    overagePerUser: 0,
    sla: '99.9%',
    response: '2h(专属客户经理)',
    support: '专属客户经理 + 7x24',
    features: ['无限用户', '定制功能开发', '专属客户经理', '2h 响应 SLA 99.9%', '混合云部署'],
    deployment: '私有云 / 混合云',
  },
  custom: {
    name: 'Custom 定制版',
    annual: 500000,
    userCap: Infinity,
    overagePerUser: 0,
    sla: '99.99%',
    response: '1h(专属团队)',
    support: '专属技术团队驻场',
    features: ['私有化部署', '源码交付', '定制开发无上限', '1h 响应 SLA 99.99%', '数据完全自主可控'],
    deployment: '完全私有化',
  },
};

function parseArgs(argv) {
  const args = { tier: null, customers: 10, duration: 12, customer: '客户公司', contact: '客户联系人', discount: 0, pdf: null, out: null };
  for (const token of argv.slice(2)) {
    if (token.startsWith('--tier=')) args.tier = token.slice(7);
    else if (token.startsWith('--customers=')) args.customers = parseInt(token.slice(12), 10);
    else if (token.startsWith('--duration=')) args.duration = parseInt(token.slice(11), 10);
    else if (token.startsWith('--customer=')) args.customer = decodeURIComponent(token.slice(11));
    else if (token.startsWith('--contact=')) args.contact = decodeURIComponent(token.slice(10));
    else if (token.startsWith('--discount=')) args.discount = parseFloat(token.slice(11));
    else if (token.startsWith('--pdf=')) args.pdf = token.slice(6);
    else if (token.startsWith('--out=')) args.out = token.slice(6);
    else if (token === '--help' || token === '-h') args.help = true;
  }
  return args;
}

const HELP = `IHUI-AI 企业版报价单生成器

用法:
  node quote-generator.mjs --tier=<tier> --customers=<n> --duration=<months> [选项]

必填:
  --tier        starter | business | enterprise | custom
  --customers   用户数量(整数)
  --duration    订阅时长(月,默认 12)

可选:
  --customer    客户公司名称(默认 "客户公司",中文请 URL 编码或直接传)
  --contact     客户联系人(默认 "客户联系人")
  --discount    额外折扣百分比 0-30(默认 0)
  --pdf=<路径>  生成 PDF(需项目已安装 puppeteer,缺失时仅输出 markdown)
  -h, --help    显示本帮助

示例:
  node quote-generator.mjs --tier=business --customers=150 --duration=24 --customer=ACME
  node quote-generator.mjs --tier=enterprise --customers=1000 --duration=36 --pdf=quote.pdf

报价档位:
  Starter    5 万元/年  ≤50 用户   基础功能 邮件支持
  Business  10 万元/年  ≤200 用户  完整功能 工单+群 4h 响应
  Enterprise 30 万元/年 无限用户   定制功能 专属客户经理 2h 响应 SLA 99.9%
  Custom    50 万元+/年 私有化     源码交付 1h 响应 SLA 99.99%
`;

function fmtCNY(n) {
  return '¥' + Math.round(n).toLocaleString('zh-CN');
}

function calcQuote(tierKey, customers, durationMonths, extraDiscountPct) {
  const tier = TIERS[tierKey];
  if (!tier) throw new Error(`未知档位: ${tierKey}(可选: ${Object.keys(TIERS).join('/')})`);

  const years = durationMonths / 12;
  const baseAnnual = tier.annual;

  // 超档用户加费(starter/business 有上限,enterprise/custom 无限)
  let overageUsers = 0;
  let overageFee = 0;
  if (Number.isFinite(tier.userCap) && customers > tier.userCap) {
    overageUsers = customers - tier.userCap;
    overageFee = overageUsers * tier.overagePerUser * years;
  }

  const subtotalAnnual = (baseAnnual + overageUsers * tier.overagePerUser) * years;

  // 多年订阅折扣(不与额外折扣叠加,取较高者)
  let termDiscountPct = 0;
  if (durationMonths >= 36) termDiscountPct = 15;
  else if (durationMonths >= 24) termDiscountPct = 10;
  const discountPct = Math.max(termDiscountPct, extraDiscountPct || 0);
  const discountAmount = subtotalAnnual * (discountPct / 100);
  const total = subtotalAnnual - discountAmount;

  return { tier, customers, durationMonths, years, baseAnnual, overageUsers, overagePerUser: tier.overagePerUser, overageFee, subtotalAnnual, discountPct, discountAmount, total };
}

function buildMarkdown(q, args) {
  const today = new Date();
  const validDays = 30;
  const validUntil = new Date(today.getTime() + validDays * 86400000);
  const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const quoteNo = `IHUI-Q-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  const lines = [];
  lines.push(`# IHUI-AI 企业版报价单`);
  lines.push(``);
  lines.push(`> 报价编号: **${quoteNo}**  生成日期: ${fmtDate(today)}  有效期至: ${fmtDate(validUntil)}(${validDays} 天内确认有效)`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 一、客户信息`);
  lines.push(``);
  lines.push(`| 项目 | 内容 |`);
  lines.push(`|------|------|`);
  lines.push(`| 客户名称 | ${args.customer} |`);
  lines.push(`| 联系人 | ${args.contact} |`);
  lines.push(`| 用户规模 | ${q.customers} 人 |`);
  lines.push(`| 订阅时长 | ${q.durationMonths} 个月(${q.years.toFixed(2)} 年) |`);
  lines.push(`| 部署模式 | ${q.tier.deployment} |`);
  lines.push(``);
  lines.push(`## 二、产品档位`);
  lines.push(``);
  lines.push(`**${q.tier.name}**`);
  lines.push(``);
  lines.push(`- SLA: ${q.tier.sla}`);
  lines.push(`- 响应时效: ${q.tier.response}`);
  lines.push(`- 技术支持: ${q.tier.support}`);
  lines.push(`- 核心功能:`);
  for (const f of q.tier.features) lines.push(`  - ${f}`);
  lines.push(``);
  lines.push(`## 三、报价明细`);
  lines.push(``);
  lines.push(`| 项目 | 单价 | 数量 | 小计 |`);
  lines.push(`|------|------|------|------|`);
  lines.push(`| ${q.tier.name} 年费 | ${fmtCNY(q.baseAnnual)}/年 | ${q.years.toFixed(2)} 年 | ${fmtCNY(q.baseAnnual * q.years)} |`);
  if (q.overageUsers > 0) {
    lines.push(`| 超档用户(${q.tier.name} 上限 ${TIERS[q.tier === TIERS.starter ? 'starter' : q.tier === TIERS.business ? 'business' : 'enterprise'].userCap} 人) | ${fmtCNY(q.overagePerUser)}/人/年 | ${q.overageUsers} 人 × ${q.years.toFixed(2)} 年 | ${fmtCNY(q.overageFee)} |`);
  }
  lines.push(`| **小计** | | | **${fmtCNY(q.subtotalAnnual)}** |`);
  if (q.discountPct > 0) {
    lines.push(`| 折扣(${q.discountPct}%${q.discountPct >= 10 && q.durationMonths >= 24 ? ',多年订阅优惠' : ''}) | | | -${fmtCNY(q.discountAmount)} |`);
  }
  lines.push(`| **应付总价(含税)** | | | **${fmtCNY(q.total)}** |`);
  lines.push(``);
  lines.push(`## 四、付款方式`);
  lines.push(``);
  lines.push(`1. **合同签订后 7 个工作日内**支付首期款(总价的 50%)`);
  lines.push(`2. **服务上线验收后 15 个工作日内**支付尾款(总价的 50%)`);
  lines.push(`3. 支持对公转账 / 支付宝企业账户;多年订阅可申请分期(年付)`);
  lines.push(`4. 发票:增值税专用发票(6% 软件服务税率),开票周期 5 个工作日`);
  lines.push(``);
  lines.push(`## 五、服务说明`);
  lines.push(``);
  lines.push(`- 本报价基于 ${q.customers} 用户、${q.durationMonths} 个月订阅计算;实际用户数超出档位上限将按上表"超档用户"补费`);
  lines.push(`- 服务起算日为合同生效且首期款到账之日,到期自动终止(可续约)`);
  lines.push(`- SLA 与故障响应时效详见 [sla-terms.md](./sla-terms.md);部署模式详见 [deployment-guide.md](./deployment-guide.md)`);
  lines.push(`- 功能差异详见 [feature-comparison.md](./feature-comparison.md)`);
  lines.push(``);
  lines.push(`## 六、联系方式`);
  lines.push(``);
  lines.push(`| 项目 | 内容 |`);
  lines.push(`|------|------|`);
  lines.push(`| 销售邮箱 | sales@aizhs.top |`);
  lines.push(`| 报价人 | IHUI-AI 企业销售团队 |`);
  lines.push(`| 报价编号 | ${quoteNo} |`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`*本报价单由 IHUI-AI 企业版报价单生成器自动生成,最终价格以正式合同为准。*`);
  lines.push(``);
  return lines.join('\n');
}

async function generatePdf(markdown, pdfPath) {
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    process.stderr.write(`[warn] puppeteer 未安装,跳过 PDF 生成。markdown 已输出到 stdout。\n`);
    process.stderr.write(`[warn] 如需 PDF:在项目内安装 puppeteer(pnpm add -w puppeteer)后重跑。\n`);
    return false;
  }
  const browser = await puppeteer.default.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    // 极简 markdown → HTML(仅处理本脚本生成的子集:标题/表格/列表/引用/分隔线/粗体/段落)
    const html = mdToHtml(markdown);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: pdfPath, format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' }, printBackground: true });
    return true;
  } finally {
    await browser.close();
  }
}

function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  let html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;color:#1a1a1a;font-size:13px;line-height:1.6}
    h1{font-size:22px;border-bottom:2px solid #2563eb;padding-bottom:8px;color:#1e3a5f}
    h2{font-size:16px;color:#1e3a5f;margin-top:18px;border-left:4px solid #2563eb;padding-left:8px}
    table{border-collapse:collapse;width:100%;margin:8px 0;font-size:12px}
    th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left}
    th{background:#f3f4f6;font-weight:600}
    tr:nth-child(even){background:#fafafa}
    blockquote{border-left:3px solid #93c5fd;background:#eff6ff;margin:8px 0;padding:6px 12px;color:#1e40af;font-size:12px}
    ul{padding-left:20px} li{margin:2px 0}
    strong{color:#b91c1c}
    hr{border:none;border-top:1px solid #e5e7eb;margin:14px 0}
    code{background:#f3f4f6;padding:1px 4px;border-radius:3px;font-size:12px}
  </style></head><body>`;
  let inUl = false;
  let inTable = false;
  let tableRows = [];
  const flushTable = () => {
    if (!tableRows.length) return;
    html += '<table>';
    tableRows.forEach((row, i) => {
      const cells = row.split('|').filter((c, idx, arr) => idx > 0 && idx < arr.length - 1).map((c) => c.trim());
      const tag = i === 0 ? 'th' : 'td';
      html += '<tr>' + cells.map((c) => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
    });
    html += '</table>';
    tableRows = [];
  };
  for (const raw of lines) {
    const line = raw;
    if (line.startsWith('# ')) { if (inUl) { html += '</ul>'; inUl = false; } if (inTable) { flushTable(); inTable = false; } html += `<h1>${esc(line.slice(2))}</h1>`; continue; }
    if (line.startsWith('## ')) { if (inUl) { html += '</ul>'; inUl = false; } if (inTable) { flushTable(); inTable = false; } html += `<h2>${esc(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('> ')) { if (inUl) { html += '</ul>'; inUl = false; } if (inTable) { flushTable(); inTable = false; } html += `<blockquote>${esc(line.slice(2))}</blockquote>`; continue; }
    if (line.startsWith('---')) { if (inUl) { html += '</ul>'; inUl = false; } if (inTable) { flushTable(); inTable = false; } html += '<hr>'; continue; }
    if (line.startsWith('|')) { if (inUl) { html += '</ul>'; inUl = false; } inTable = true; tableRows.push(line); continue; }
    if (line.startsWith('- ')) { if (inTable) { flushTable(); inTable = false; } if (!inUl) { html += '<ul>'; inUl = true; } html += `<li>${esc(line.slice(2))}</li>`; continue; }
    if (line.startsWith('  - ')) { html += `<li>${esc(line.slice(4))}</li>`; continue; }
    if (line.match(/^\d+\.\s/)) { if (inUl) { html += '</ul>'; inUl = false; } if (inTable) { flushTable(); inTable = false; } html += `<p>${esc(line)}</p>`; continue; }
    if (inUl) { html += '</ul>'; inUl = false; }
    if (inTable) { flushTable(); inTable = false; }
    if (line.trim() === '') { continue; }
    html += `<p>${esc(line)}</p>`;
  }
  if (inUl) html += '</ul>';
  if (inTable) flushTable();
  html += '</body></html>';
  return html;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.tier) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : 1);
  }
  if (!Number.isFinite(args.customers) || args.customers <= 0) {
    process.stderr.write(`[error] --customers 必须为正整数\n`);
    process.exit(1);
  }
  if (!Number.isFinite(args.duration) || args.duration <= 0) {
    process.stderr.write(`[error] --duration 必须为正整数(月)\n`);
    process.exit(1);
  }
  let q;
  try {
    q = calcQuote(args.tier, args.customers, args.duration, args.discount);
  } catch (e) {
    process.stderr.write(`[error] ${e.message}\n`);
    process.exit(1);
  }
  const md = buildMarkdown(q, args);
  process.stdout.write(md);

  if (args.out) {
    writeFileSync(args.out, md, 'utf8');
    process.stderr.write(`[info] markdown 已写入: ${args.out}\n`);
  }

  if (args.pdf) {
    const ok = await generatePdf(md, args.pdf);
    if (ok) process.stderr.write(`[info] PDF 已生成: ${args.pdf}\n`);
  }
}

main().catch((e) => { process.stderr.write(`[fatal] ${e.stack || e.message}\n`); process.exit(1); });
