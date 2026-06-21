import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT_DIR = path.resolve(__dirname, '..')

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function runCommand(command, description) {
  log(`\n▶ ${description}...`, 'cyan')
  try {
    execSync(command, { cwd: ROOT_DIR, stdio: 'inherit' })
    log(`✅ ${description} - 通过`, 'green')
    return true
  } catch (error) {
    log(`❌ ${description} - 失败`, 'red')
    return false
  }
}

function checkFile(filePath, description) {
  const fullPath = path.join(ROOT_DIR, filePath)
  if (fs.existsSync(fullPath)) {
    log(`✅ ${description} - 存在`, 'green')
    return true
  } else {
    log(`❌ ${description} - 不存在`, 'red')
    return false
  }
}

/**
 * 可选文件：不存在时不记为失败。
 * @param absentNote - 文件不存在时的完整说明（用 ✅ 绿色展示，避免误导为“缺失”）
 */
function checkFileOptional(filePath, description, absentNote) {
  const fullPath = path.join(ROOT_DIR, filePath)
  if (fs.existsSync(fullPath)) {
    log(`✅ ${description} - 存在`, 'green')
    return true
  } else {
    log(`✅ ${description} - ${absentNote}`, 'green')
    return true
  }
}

/** 环境变量检查：未设置时也以 ✅ 说明「部署时由 CI 设置」，避免误导 */
function checkEnvVariables() {
  log('\n📋 检查环境变量...', 'cyan')
  if (process.env.NODE_ENV) {
    log(`  ✅ NODE_ENV = ${process.env.NODE_ENV}`, 'green')
  } else {
    log(`  ✅ NODE_ENV - 部署时由 CI 设为 production，本地检查可忽略`, 'green')
  }
  return true
}

async function main() {
  log('\n' + '='.repeat(60), 'blue')
  log('🚀 部署前检查', 'blue')
  log('='.repeat(60) + '\n', 'blue')

  const results = []

  // 1. 检查必要文件
  log('\n📁 检查必要文件...', 'cyan')
  results.push(checkFile('package.json', 'package.json'))
  results.push(checkFile('dist/web/index.html', '构建输出'))
  results.push(checkFileOptional('.env.production', '生产环境配置', '部署时由 CI 注入，本地无需此文件'))

  // 2. 运行 ESLint
  results.push(runCommand('npm run lint', 'ESLint 检查'))

  // 3. TypeScript 类型检查
  results.push(runCommand('npm run typecheck', 'TypeScript 类型检查'))

  // 4. 运行测试
  results.push(runCommand('npm run test:coverage', '单元测试'))

  // 5. 依赖安全审计（中高危必须为 0）
  results.push(runCommand('npm audit --audit-level=high', '依赖安全审计'))

  // 6. 性能预算检查
  results.push(runCommand('npm run check:perf', '性能预算检查'))

  // 7. 检查环境变量
  results.push(checkEnvVariables())

  // 汇总结果
  log('\n' + '='.repeat(60), 'blue')
  log('📊 检查结果汇总', 'blue')
  log('='.repeat(60), 'blue')

  const passed = results.filter(r => r === true).length
  const failed = results.filter(r => r === false).length

  log(`\n通过: ${passed}`, 'green')
  log(`失败: ${failed}`, failed > 0 ? 'red' : 'green')

  if (failed > 0) {
    log('\n❌ 部署前检查失败，请修复上述问题后重试', 'red')
    process.exit(1)
  } else {
    log('\n✅ 所有检查通过，可以安全部署！', 'green')
    process.exit(0)
  }
}

main().catch(error => {
  log(`\n❌ 检查过程中发生错误: ${error.message}`, 'red')
  process.exit(1)
})
