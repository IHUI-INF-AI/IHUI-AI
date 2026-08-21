/**
 * Fix agent-screen.test.tsx Animated mock and clean i18n dead keys
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Task 1: Fix agent-screen.test.tsx Animated mock ----
const testFile = path.join(__dirname, '../apps/mobile-rn/tests/agent-screen.test.tsx');
let testContent = fs.readFileSync(testFile, 'utf8');

const animatedBlock = `    Platform: { OS: 'web' as const },
    Animated: {
      View: mk('div'),
      Text: mk('span'),
      createAnimatedComponent: (c) => c,
      timing: () => ({ start: () => {} }),
      spring: () => ({ start: () => {} }),
      Value: class { constructor(_v) {} setValue(_v) {} interpolate() { return { __getValue: () => 0 }; } }
    },
  }`;

testContent = testContent.replace(
  /Platform: \{ OS: 'web' as const \},\n  \}/,
  animatedBlock
);

fs.writeFileSync(testFile, testContent, 'utf8');
console.log('[OK] agent-screen.test.tsx: added Animated mock');

// ---- Task 2: Clean i18n dead keys ----
const LANG_FILES = ['zh-CN.json', 'zh-TW.json', 'en.json', 'ja.json', 'ko.json'];
const MOBILE_RN_DIR = path.join(__dirname, '../packages/i18n/messages/mobile-rn');
const MINIAPP_DIR = path.join(__dirname, '../packages/i18n/messages/miniapp-taro');

for (const lang of LANG_FILES) {
  const filePath = path.join(MOBILE_RN_DIR, lang);
  let content = fs.readFileSync(filePath, 'utf8');
  const obj = JSON.parse(content);
  let changed = false;

  // Remove entire devEnter section (7 dead keys)
  if ('devEnter' in obj) {
    delete obj.devEnter;
    changed = true;
  }

  // Remove carte.loadFailed
  if (obj.carte && 'loadFailed' in obj.carte) {
    delete obj.carte.loadFailed;
    changed = true;
  }

  // Remove recruitment.loadFailed
  if (obj.recruitment && 'loadFailed' in obj.recruitment) {
    delete obj.recruitment.loadFailed;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    console.log(`[OK] ${lang}: removed devEnter + carte.loadFailed + recruitment.loadFailed`);
  } else {
    console.log(`[SKIP] ${lang}: no changes needed`);
  }
}

// Clean miniapp-taro zh-CN.json - remove news.views
const miniappFile = path.join(MINIAPP_DIR, 'zh-CN.json');
let miniappContent = fs.readFileSync(miniappFile, 'utf8');
const miniappObj = JSON.parse(miniappContent);
if (miniappObj.news && 'views' in miniappObj.news) {
  delete miniappObj.news.views;
  fs.writeFileSync(miniappFile, JSON.stringify(miniappObj, null, 2) + '\n', 'utf8');
  console.log('[OK] miniapp-taro/zh-CN.json: removed news.views');
} else {
  console.log('[SKIP] miniapp-taro/zh-CN.json: no news.views to remove');
}

console.log('\nDone.');
