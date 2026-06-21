const fs = require('fs');
const path = require('path');
const mdpdf = require('markdown-pdf');

const ROOT = path.resolve(__dirname, '..');
const OUT_MD = path.join(ROOT, 'docs', '源代码打印稿.md');
const OUT_PDF = path.join(ROOT, 'docs', '源代码打印稿.pdf');
const CSS = path.join(ROOT, 'docs', 'styles', 'code-pdf.css');

// 选取核心文件，确保开头与结尾均为核心模块
const FILES = [
  // 开始部分：核心 AI/支付/登录
  'src/mixins/ai_index.js',
  'src/service/aiModels.js',
  'src/service/pay.js',
  'src/store/user.js',
  'src/api/payment.js',
  // 云函数（支付/登录/AI）
  'src/uniCloud-aliyun/cloudfunctions/payment/index.js',
  'src/uniCloud-aliyun/cloudfunctions/order/index.js',
  'src/uniCloud-aliyun/cloudfunctions/login/index.js',
  'src/uniCloud-aliyun/cloudfunctions/ai/index.js',
  // 页面入口
  'src/pagesA/ai/chat.vue',
  'src/pagesA/payment/index.vue',
  'src/pages/login/index.vue',
  // 结尾部分：再次核心文件，保证后30页覆盖核心
  'src/mixins/ai_index.js',
  'src/uniCloud-aliyun/cloudfunctions/payment/index.js'
];

function sanitize(line) {
  // 脱敏：appid/mchid/apiKey 等关键词
  return line
    .replace(/appid\s*=\s*['"][^'"]+['"]/i, "appid='REDACTED'")
    .replace(/mchid\s*=\s*['"][^'"]+['"]/i, "mchid='REDACTED'")
    .replace(/apiKey\s*=\s*['"][^'"]+['"]/i, "apiKey='REDACTED'")
    .replace(/paySign\s*:\s*['"][^'"]+['"]/i, "paySign:'REDACTED'");
}

function chunk(lines, size) {
  const res = [];
  for (let i = 0; i < lines.length; i += size) {
    res.push(lines.slice(i, i + size));
  }
  return res;
}

function buildMd() {
  let page = 1;
  const parts = [];
  parts.push(`# Ai-WXMiniVue 源代码打印稿\n`);
  parts.push(`> 说明：每页 50 行，页眉含软件名称与页码；敏感参数已脱敏；关键文件在开头与结尾均覆盖核心模块。\n`);
  parts.push(`\n`);
  for (const rel of FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf8');
    const lines = content.split(/\r?\n/).map(sanitize);
    const chunks = chunk(lines, 50);
    chunks.forEach((chunkLines, idx) => {
      parts.push(`<div class="page-header">Ai-WXMiniVue — 源代码打印稿｜${rel}｜第 ${page} 页</div>`);
      parts.push('');
      parts.push('```' + path.extname(rel).slice(1));
      parts.push(...chunkLines);
      parts.push('```');
      // 关键文件页添加说明
      if (idx === 0 && /ai_index\.js|payment\/index\.js|store\/user\.js/.test(rel)) {
        parts.push(`<div class="highlight-note">关键模块：${rel}（核心功能实现页面）</div>`);
      }
      parts.push('<div class="page-break"></div>');
      page += 1;
    });
  }
  return parts.join('\n');
}

function main() {
  const md = buildMd();
  fs.writeFileSync(OUT_MD, md, 'utf8');
  mdpdf({
    cssPath: CSS,
    remarkable: { breaks: true }
  })
    .from.string(md)
    .to(OUT_PDF, function () {
    });
}

main();