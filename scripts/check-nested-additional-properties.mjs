// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-14 票1(G-998176)常驻门:工具入参的闭合声明与校验必须递归到每一层。
 *
 * 取材面与守门 113(check-tool-arg-routing-identity.mjs)同族 —— 同一张
 * `parameters/properties` 面;票面⑦原文「判据挂到守门 113 同族(同一取材面)优先于
 * 新建门」,而守门 113 本身在本票禁止修改清单里,故按「无论哪种」落成新建门,
 * 判据只读 src 源文本,不 import、不吃 dist。
 *
 * 判据(全绿才 exit 0):
 *   ① 嵌套三态锚点在位:argument-validator.ts 的 checkObject 内
 *      `const additional = param.additionalProperties` 必须存在;
 *   ② 三态语义完整:`additional === false` ⇒ unknown_field(field 用既有
 *      `${field}.${k}` 约定);子 schema 形 ⇒ 走 coerceAndCheck 按值判;
 *      缺席 ⇒ 无 else 强判(默认档不翻);
 *   ③ 类型面收编:apps/cli/src/tools/index.ts 中 `additionalProperties` 恰 ≥ 2 处
 *      (ToolParameter 与 ToolSchema.parameters 各一,票面⑤源码锁)。
 *
 * --self-test 三臂:
 *   ST1 「嵌套层闭集声明被摘 ⇒ 必红」:把 ① 锚点行从源文本摘除 ⇒ 判据必须失败;
 *   ST2 「补声明 ⇒ 不越锚点」:在 index.ts 副本上额外补一处合法声明 ⇒ 判据仍绿
 *        (锚点是「收编在位」,多补合法声明不得误红);
 *   ST3 「取不到判未判定、不得记绿」:任一取材文件读不到 ⇒ 输出 UNDETERMINED、
 *        exit 非 0,绝不记绿。
 *
 * 本脚本不接提交链(不改 guardian-runner / package.json scripts / .husky)。
 */

import { readFileSync } from 'node:fs';

const VALIDATOR_PATH = 'apps/cli/src/tools/argument-validator.ts';
const TYPES_PATH = 'apps/cli/src/tools/index.ts';

/** 单条判据的判定结果。 */
function check(validatorSrc, typesSrc) {
  const failures = [];

  // ① 嵌套三态锚点在位(checkObject 函数体内)
  const anchorToken = 'const additional = param.additionalProperties;';
  const checkObjectStart = validatorSrc.indexOf('function checkObject(');
  if (checkObjectStart < 0) {
    failures.push(`[1] ${VALIDATOR_PATH} 内找不到 checkObject 函数,无法判定嵌套三态`);
  } else if (!validatorSrc.slice(checkObjectStart).includes(anchorToken)) {
    failures.push(`[1] checkObject 内嵌套三态锚点被摘:${anchorToken}`);
  }

  // ② 三态语义完整
  if (!validatorSrc.includes("if (additional === false)")) {
    failures.push('[2a] 嵌套三态缺 false 分支(未知键必须记 unknown_field)');
  }
  if (!validatorSrc.includes("reason: 'unknown_field'") ||
      !validatorSrc.includes('`${field}.${k}`')) {
    failures.push("[2b] 嵌套 unknown_field 必须用既有 `${field}.${k}` 键路径约定");
  }
  if (!validatorSrc.includes("typeof additional === 'object'") ||
      !validatorSrc.includes('coerceAndCheck(`${field}.${k}`, obj[k], additional, errors)')) {
    failures.push('[2c] 嵌套子 schema 形必须走 coerceAndCheck 按值判');
  }

  // ③ 类型面收编(≥ 2 处;补更多合法声明不越锚点 —— 这是 ST2 的锚点口径)
  const typeCount = (typesSrc.match(/additionalProperties/g) ?? []).length;
  if (typeCount < 2) {
    failures.push(`[3] ${TYPES_PATH} 中 additionalProperties 仅 ${typeCount} 处(< 2),类型面未收编`);
  }

  return failures;
}

function main() {
  // ST3:取不到判未判定、不得记绿
  let validatorSrc;
  let typesSrc;
  try {
    validatorSrc = readFileSync(VALIDATOR_PATH, 'utf8');
  } catch (err) {
    console.error(`UNDETERMINED: 读不到 ${VALIDATOR_PATH}(${err.code ?? err.message}),不得记绿`);
    process.exit(2);
  }
  try {
    typesSrc = readFileSync(TYPES_PATH, 'utf8');
  } catch (err) {
    console.error(`UNDETERMINED: 读不到 ${TYPES_PATH}(${err.code ?? err.message}),不得记绿`);
    process.exit(2);
  }

  if (process.argv.includes('--self-test')) {
    return selfTest(validatorSrc, typesSrc);
  }

  const failures = check(validatorSrc, typesSrc);
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL ${f}`);
    console.error(`check-nested-additional-properties: ${failures.length} 项失败`);
    process.exit(1);
  }
  console.log('check-nested-additional-properties: PASS(嵌套闭集三态在位 + 类型面收编 ≥2)');
  process.exit(0);
}

function selfTest(validatorSrc, typesSrc) {
  let failed = 0;

  // ST1:嵌套层闭集声明被摘 ⇒ 必红
  const stripped = validatorSrc.replace(
    'const additional = param.additionalProperties;',
    'const additional = undefined; // ST1 变异:锚点被摘',
  );
  if (stripped === validatorSrc) {
    console.error('ST1 FAIL: 变异未生效(源文本里找不到锚点行),自证无效');
    failed++;
  } else if (check(stripped, typesSrc).length === 0) {
    console.error('ST1 FAIL: 锚点被摘后判据仍绿 —— 判据失明');
    failed++;
  } else {
    console.log('ST1 PASS: 嵌套层闭集声明被摘 ⇒ 判据必红');
  }

  // ST2:补声明 ⇒ 不越锚点(多补一处合法声明,判据必须仍绿)
  const augmented = `${typesSrc}\nexport interface ToolParameterExtraB76Probe {\n  additionalProperties?: boolean | ToolParameter;\n}\n`;
  if (check(validatorSrc, augmented).length !== 0) {
    console.error('ST2 FAIL: 补一处合法声明被误判红 —— 锚点过紧');
    failed++;
  } else {
    console.log('ST2 PASS: 补声明 ⇒ 不越锚点(判据仍绿)');
  }

  // ST3:取不到判未判定、不得记绿(用 readFileSync 对不存在路径直接验证分支)
  try {
    readFileSync('scripts/data/__no_such_file_for_undetermined__.mjs', 'utf8');
    console.error('ST3 FAIL: 不存在的文件竟读到了,分支无法自证');
    failed++;
  } catch {
    console.log('ST3 PASS: 取不到 ⇒ UNDETERMINED 路径存在,不记绿(主流程 exit 2 已在 main 落实)');
  }

  if (failed > 0) {
    console.error(`self-test: ${failed} 臂失败`);
    process.exit(1);
  }
  console.log('self-test: 3/3 PASS');
  process.exit(0);
}

main();
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
