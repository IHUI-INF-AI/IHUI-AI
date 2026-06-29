/**
 * miniprogram-ci 命令行预览/上传脚本
 *
 * 使用前：
 *   1. 微信小程序后台 → 开发管理 → 开发设置 → 小程序代码上传密钥 → 下载私钥 .key 文件
 *   2. 将私钥文件放在 miniapp/private.key.wx27028e276ffdbc5d.key
 *      或设置环境变量 MINIPROGRAM_PRIVATE_KEY（内容为私钥文件全文）
 *   3. 后台同一页面配置 IP 白名单（本机公网 IP）
 *
 * 用法：
 *   npx tsx scripts/upload-miniprogram.ts preview   # 预览，生成二维码
 *   npx tsx scripts/upload-miniprogram.ts upload     # 上传代码到小程序后台
 *   npx tsx scripts/upload-miniprogram.ts upload --desc "v1.0.2 修复xxx"  # 指定版本描述
 *
 * 环境变量：
 *   MINIPROGRAM_PRIVATE_KEY  私钥内容（可选，优先级高于文件）
 *   MP_APPID                 小程序 appid（可选，默认 wx27028e276ffdbc5d）
 */
import * as nodePath from 'node:path'
import * as fs from 'node:fs/promises'
import * as crypto from 'node:crypto'

// 微信小程序 appid（mp-weixin 配置）
const DEFAULT_APPID = 'wx27028e276ffdbc5d'
// build 产物路径
const PROJECT_PATH = nodePath.resolve(__dirname, '..', 'dist', 'build', 'mp-weixin')
// 私钥文件路径
const PRIVATE_KEY_FILE = nodePath.resolve(__dirname, '..', `private.key.${DEFAULT_APPID}.key`)

interface CliArgs {
  command: 'preview' | 'upload'
  desc: string
  appid: string
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  const command = argv[0] as 'preview' | 'upload'
  if (command !== 'preview' && command !== 'upload') {
    console.error('用法: npx tsx scripts/upload-miniprogram.ts <preview|upload> [--desc "版本描述"]')
    process.exit(1)
  }

  let desc = ''
  let appid = process.env.MP_APPID || DEFAULT_APPID

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--desc' && i + 1 < argv.length) {
      desc = argv[++i]
    } else if (arg === '--appid' && i + 1 < argv.length) {
      appid = argv[++i]
    }
  }

  if (command === 'upload' && !desc) {
    desc = `自动上传 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
  }

  return { command, desc, appid }
}

async function readPrivateKey(): Promise<string> {
  // 1. 优先从环境变量读取
  const envKey = process.env.MINIPROGRAM_PRIVATE_KEY
  if (envKey && envKey.trim()) {
    return envKey
  }

  // 2. 从文件读取
  try {
    const content = await fs.readFile(PRIVATE_KEY_FILE, 'utf-8')
    if (content.trim()) {
      return content
    }
  } catch {
    // 文件不存在，继续报错
  }

  console.error('错误：未找到小程序上传私钥')
  console.error('')
  console.error('请选择以下方式之一提供私钥：')
  console.error(`  1. 将私钥文件放在 ${PRIVATE_KEY_FILE}`)
  console.error('     下载地址：微信小程序后台 → 开发管理 → 开发设置 → 小程序代码上传密钥')
  console.error('  2. 设置环境变量 MINIPROGRAM_PRIVATE_KEY（内容为私钥文件全文）')
  console.error('')
  console.error('注意：还需在后台配置 IP 白名单（本机公网 IP）')
  process.exit(1)
}

async function validateProject(): Promise<void> {
  try {
    await fs.access(PROJECT_PATH)
  } catch {
    console.error(`错误：构建产物目录不存在: ${PROJECT_PATH}`)
    console.error('请先运行 npm run build:mp-weixin 生成构建产物')
    process.exit(1)
  }

  const configFile = nodePath.join(PROJECT_PATH, 'project.config.json')
  try {
    await fs.access(configFile)
  } catch {
    console.error(`错误：project.config.json 不存在: ${configFile}`)
    console.error('请先运行 npm run build:mp-weixin 生成构建产物')
    process.exit(1)
  }
}

async function main() {
  const args = parseArgs()

  console.log('=== miniprogram-ci 命令行工具 ===')
  console.log(`命令: ${args.command}`)
  console.log(`AppID: ${args.appid}`)
  console.log(`项目路径: ${PROJECT_PATH}`)
  if (args.command === 'upload') {
    console.log(`版本描述: ${args.desc}`)
  }
  console.log('')

  // 1. 校验构建产物
  await validateProject()

  // 2. 读取私钥
  const privateKey = await readPrivateKey()
  console.log('✓ 私钥已加载')

  // 3. 动态导入 miniprogram-ci（避免未安装时报错）
  let ci: typeof import('miniprogram-ci')
  try {
    ci = await import('miniprogram-ci')
  } catch {
    console.error('错误：miniprogram-ci 未安装')
    console.error('请运行: npm install miniprogram-ci --save-dev')
    process.exit(1)
  }

  // 4. 创建项目对象
  const project = new ci.Project({
    appid: args.appid,
    type: 'miniProgram',
    projectPath: PROJECT_PATH,
    privateKey,
    ignores: ['node_modules/**'],
  })

  console.log('✓ 项目对象已创建')

  // 5. 执行命令
  try {
    if (args.command === 'preview') {
      // 预览：生成二维码
      const previewResult = await ci.preview({
        project,
        desc: args.desc || '预览',
        setting: {
          es6: true,
          minify: true,
        },
        qrcodeFormat: 'image',
        qrcodeOutputDest: nodePath.resolve(__dirname, '..', 'preview-qr.png'),
        onProgressUpdate: (info: unknown) => {
          const msg = (info as { message?: string })?.message || ''
          if (msg) console.log(`  预览进度: ${msg}`)
        },
      })
      console.log('')
      console.log('✓ 预览成功！')
      console.log(`  二维码图片: ${nodePath.resolve(__dirname, '..', 'preview-qr.png')}`)
      console.log('  用微信扫码即可预览小程序')
      if (previewResult) {
        console.log('  预览结果:', previewResult)
      }
    } else {
      // 上传
      const uploadResult = await ci.upload({
        project,
        desc: args.desc,
        setting: {
          es6: true,
          minify: true,
        },
        onProgressUpdate: (info: unknown) => {
          const msg = (info as { message?: string })?.message || ''
          if (msg) console.log(`  上传进度: ${msg}`)
        },
      })
      console.log('')
      console.log('✓ 上传成功！')
      console.log('  请到微信小程序后台提交审核：')
      console.log('  https://mp.weixin.qq.com/wxamp/wacodepage/getcodepage')
      if (uploadResult) {
        console.log('  上传结果:', uploadResult)
      }
    }
  } catch (error) {
    console.error('')
    console.error('✗ 执行失败:', error instanceof Error ? error.message : error)
    if (error instanceof Error && error.stack) {
      console.error('')
      console.error('堆栈:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 生成简单的版本号哈希（用于上传时 subpackage 标识）
function generateVersionHash(): string {
  return crypto.createHash('md5').update(String(Date.now())).digest('hex').slice(0, 8)
}

// 标记未使用但保留的工具函数（未来可能用到）
void generateVersionHash

main().catch((error) => {
  console.error('未捕获的错误:', error)
  process.exit(1)
})
