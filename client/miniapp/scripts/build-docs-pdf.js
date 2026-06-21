const path = require('path');
const fs = require('fs');
const mdpdf = require('markdown-pdf');

const ROOT = path.resolve(__dirname, '..');
const CSS = path.join(ROOT, 'docs', 'styles', 'code-pdf.css');

const files = [
  path.join(ROOT, 'docs', '程序设计说明书.md'),
  path.join(ROOT, 'docs', '程序功能说明书.md'),
  path.join(ROOT, 'docs', '关键代码节选.md'),
  path.join(ROOT, 'docs', '鉴别材料目录清单.md'),
  path.join(ROOT, 'docs', '版权与第三方说明.md')
];

function buildAll() {
  files.forEach((src) => {
    if (!fs.existsSync(src)) return;
    const out = src.replace(/\.md$/, '.pdf');
    mdpdf({ cssPath: CSS, remarkable: { breaks: true } })
      .from(src)
      .to(out, function () {
      });
  });
}

buildAll();