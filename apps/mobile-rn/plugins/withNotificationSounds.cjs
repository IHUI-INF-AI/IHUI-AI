// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知铃声 raw 音源插件(2026-11-26 立)。
 *
 * 为什么必须走插件而不是裸放 res/raw:
 *   `apps/mobile-rn/.gitignore` 第 2 行 `/android` 把整个原生目录排除(Expo prebuild
 *   生成目录,EAS/干净 prebuild 时整棵重建)。直接拷进 `android/app/src/main/res/raw/`
 *   的 wav 不入库,下次 prebuild 即消失 —— 等于没做。故在每次 prebuild 时由本插件
 *   从 `assets/sounds/ringtone-*.wav` 重新生成 raw 资源,与 withSplash 拷开屏图同型。
 *
 * 命名对齐:Android 资源标识符只允许 `[a-z0-9_]`,源文件 `ringtone-dingdong.wav`
 * 落到 raw 必须改名 `ringtone_dingdong.wav`(引用名 `ringtone_dingdong`)。改名规则
 * = 源文件名内 `-` → `_`,目录即真相源;id / channelId / sound 表仍由 shared 单一
 *   真相源派生,本插件不内置第二张铃声清单。
 *
 * 纯函数 copyRingtoneSounds 抽出以便测试注入临时目录;**不**为测试跑真 prebuild
 * (本机 android 目录已存在,`expo prebuild --clean` 会整棵重建,属破坏性动作,禁止执行)。
 */
const fs = require('fs')
const path = require('path')
const { withDangerousMod } = require('expo/config-plugins')

const SOUND_SOURCE_DIR = path.join('assets', 'sounds')
// ringtone-<id>.wav;<id> 为小写字母/数字组合(与 shared RingtoneId 字符集对齐的形态校验)
const SOUND_FILE_PATTERN = /^ringtone-([a-z0-9]+)\.wav$/i

/** 从源文件名反推铃声 id:`ringtone-dingdong.wav` → `dingdong`;形态非法返回 null。 */
function ringtoneIdFromFileName(fileName) {
  const match = SOUND_FILE_PATTERN.exec(fileName)
  return match ? match[1] : null
}

/**
 * 把 sourceDir 下的 `ringtone-*.wav` 逐字节复制到 `<androidProjectRoot>/app/src/main/res/raw/`,
 * 目标文件名把 `-` 替换为 `_`。
 *
 * @param {string} androidProjectRoot Android 工程根(内含 `app/src/main/res`)
 * @param {{ sourceDir?: string, validIds?: readonly string[] }} [options]
 *   - sourceDir: 音源源目录;缺省由调用方在插件腿内按 projectRoot 拼出。
 *   - validIds: 传入合法铃声 id 集合(测试从 shared `RINGTONE_IDS` 取)做对齐校验;
 *     预构建 Node 环境无法直引 shared ESM 源码,故插件腿不传,对齐判据落在测试对拍。
 * @returns {Array<{ source: string, destination: string, id: string }>}
 */
function copyRingtoneSounds(androidProjectRoot, options = {}) {
  const { sourceDir, validIds } = options

  if (!sourceDir) {
    throw new Error('[withNotificationSounds] sourceDir 未提供')
  }
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`[withNotificationSounds] 音源目录不存在: ${sourceDir}`)
  }

  const files = fs
    .readdirSync(sourceDir)
    .filter((entry) => SOUND_FILE_PATTERN.test(entry))
  if (files.length === 0) {
    throw new Error(`[withNotificationSounds] ${sourceDir} 下没有 ringtone-*.wav,音源缺失`)
  }

  const rawDir = path.join(androidProjectRoot, 'app', 'src', 'main', 'res', 'raw')
  fs.mkdirSync(rawDir, { recursive: true })

  const results = []
  for (const fileName of files) {
    const id = ringtoneIdFromFileName(fileName)
    if (!id) {
      throw new Error(`[withNotificationSounds] 音源文件名形态非法: ${fileName}`)
    }
    if (validIds && !validIds.includes(id)) {
      throw new Error(
        `[withNotificationSounds] 铃声 id '${id}' 不在 shared RINGTONE_IDS 内(文件 ${fileName})`,
      )
    }
    const sourcePath = path.join(sourceDir, fileName)
    const targetName = fileName.replace(/-/g, '_')
    const destinationPath = path.join(rawDir, targetName)
    fs.copyFileSync(sourcePath, destinationPath)
    results.push({ source: sourcePath, destination: destinationPath, id })
  }
  return results
}

/**
 * expo config plugin:prebuild 的 android 腿,把音源拷进生成目录的 res/raw。
 * 渠道创建本身是 JS 运行时 `setNotificationChannelAsync` 完成的;本插件只负责音源资源落位。
 */
function withNotificationSounds(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      copyRingtoneSounds(cfg.modRequest.platformProjectRoot, {
        sourceDir: path.join(cfg.modRequest.projectRoot, SOUND_SOURCE_DIR),
      })
      return cfg
    },
  ])
}

module.exports = withNotificationSounds
module.exports.copyRingtoneSounds = copyRingtoneSounds
module.exports.ringtoneIdFromFileName = ringtoneIdFromFileName
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
