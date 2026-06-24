/**
 * 生成 CSS 自定义数据（用于 IDE 自动补全）
 *
 * 用法：
 *   node scripts/generate-css-custom-data.cjs        # 生成自动补全数据
 *   node scripts/generate-css-custom-data.cjs --docs # 同时生成文档
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

function extractTokens(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf-8');
  const tokens = [];
  const regex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({ name: match[1], value: match[2].trim() });
  }
  return tokens;
}

function main() {
  const args = process.argv.slice(2);
  const generateDocs = args.includes('--docs');

  const tokenFiles = [
    path.join(srcDir, 'styles/_global-tokens.scss'),
    path.join(srcDir, 'styles/_header-actions.scss'),
    path.join(srcDir, 'styles/_table-responsive.scss'),
  ];

  const allTokens = [];
  for (const file of tokenFiles) {
    allTokens.push(...extractTokens(file));
  }

  const customData = {
    properties: allTokens.map(t => ({
      name: `--${t.name}`,
      values: t.value ? [{ name: t.value }] : [],
    })),
  };

  const outDir = path.join(rootDir, '.vscode');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'css_custom_data.json');
  fs.writeFileSync(outPath, JSON.stringify(customData, null, 2));
  console.log(`✓ CSS 自定义数据已生成: ${outPath}  (${allTokens.length} 个 token)`);

  if (generateDocs) {
    const docsPath = path.join(__dirname, 'tokens-docs.md');
    const docs = allTokens.map(t => `| \`--${t.name}\` | ${t.value} |`).join('\n');
    fs.writeFileSync(docsPath, `# CSS Token 文档\n\n| Token | 值 |\n|-------|-----|\n${docs}\n`);
    console.log(`✓ Token 文档已生成: ${docsPath}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
