// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * withAutoInstaller.cjs — 免点击安装的原生侧声明(2026-11-05 立)
 *
 * 立因(机主:「都不行」= 不恢复出厂 / 无 root / 不开无线调试,但仍要「完全自动」):
 *   Android 的系统安装器确认页是安全模型的一部分,**
 *   除 Device Owner、root、ADB 之外没有 API 能绕过**。剩下唯一合法的自动化手段是
 *   AccessibilityService:由用户一次性在系统设置里启用,此后由服务在本应用拉起的
 *   安装器界面上代点「安装/继续/完成」。
 *
 * 与 withApkInstaller 的分工:
 *   · withApkInstaller 只补 `REQUEST_INSTALL_PACKAGES`(拉得起安装器);
 *   · 本插件补"点得下安装器上的确认键"——缺任一环,链路都停在"弹出来了但没人点"。
 *
 * 为什么必须走 plugin:`android/` 是 prebuild 生成物(.gitignore 内),直改既不进仓、
 * 也会被下一次 `prebuild --clean` 洗掉。本插件在 prebuild 期写三样东西:
 *   ① Kotlin 服务类(android/app/src/main/java/<pkg>/A11yAutoInstallService.kt)
 *   ② 服务配置(android/app/src/main/res/xml/ihui_auto_install.xml)
 *   ③ AndroidManifest 里的 <service> 声明
 * 全部幂等:重复 prebuild 不会重复插入。
 *
 * 安全边界(刻意收窄,不做成"万能点击器"):
 *   · 只在安装器系包名(packageinstaller / permissioncontroller / installer)的窗口里工作;
 *   · 只有界面文本出现本应用名(IHUI / 智汇)时才继续 —— 装别的 App 一律不碰;
 *   · 只点文本命中安装确认词的节点,每轮最多 3 次,不做坐标点击、不模拟全局手势。
 */

const fs = require('fs')
const path = require('path')
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins')

const NAME = 'android:name'
const SERVICE_CLASS = 'A11yAutoInstallService'
const XML_RES = 'ihui_auto_install'
const DESC_STRING = 'ihui_auto_install_desc'
const LABEL_STRING = 'ihui_auto_install_label'

const KOTLIN_SOURCE = `package __PACKAGE__

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * 代点系统安装器确认键(由 withAutoInstaller.cjs 生成,不要直接改 android/ 下的副本)。
 *
 * 只在本应用名(IHUI / 智汇)出现在安装器界面时动作,且点击词限于安装确认类;
 * 安装器是两步(安装 -> 完成),所以一次事件最多连点 3 轮、每轮间隔 1.2s。
 */
class __CLASS__ : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private var clicks = 0
    private var lastEventAt = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
        ) return

        val pkg = event.packageName?.toString().orEmpty()
        if (!isInstaller(pkg)) return
        val root = rootInActiveWindow ?: return
        if (!mentionsOurApp(root)) return

        val now = System.currentTimeMillis()
        if (now - lastEventAt < 600) return
        lastEventAt = now
        clicks = 0
        handler.removeCallbacksAndMessages(null)
        handler.postDelayed({ clickConfirm(clicks) }, 700)
    }

    /** 安装器系包名(各家 ROM 不同,统一按子串判,避免漏掉厂商安装器)。 */
    private fun isInstaller(pkg: String): Boolean {
        val p = pkg.lowercase()
        return p.contains("packageinstaller") ||
            p.contains("permissioncontroller") ||
            p.contains("installer")
    }

    /** 界面里出现本应用名才继续 —— 这一条是"不误点别的 App"的硬闸。 */
    private fun mentionsOurApp(node: AccessibilityNodeInfo?, depth: Int = 0): Boolean {
        if (node == null || depth > 40) return false
        val text = (node.text?.toString().orEmpty() + " " + node.contentDescription?.toString().orEmpty())
        if (text.contains("IHUI", true) || text.contains("智汇")) return true
        for (i in 0 until node.childCount) {
            if (mentionsOurApp(node.getChild(i), depth + 1)) return true
        }
        return false
    }

    private fun clickConfirm(round: Int) {
        if (round >= 3) return
        val root = rootInActiveWindow ?: return
        if (!mentionsOurApp(root)) return
        if (findAndClick(root, 0)) {
            handler.postDelayed({ clickConfirm(round + 1) }, 1200)
        }
    }

    private fun findAndClick(node: AccessibilityNodeInfo?, depth: Int): Boolean {
        if (node == null || depth > 40) return false
        val text = (node.text?.toString().orEmpty() + " " + node.contentDescription?.toString().orEmpty())
        if (text.isNotBlank() && node.isEnabled && node.isClickable &&
            CONFIRM_WORDS.any { text.contains(it, true) }
        ) {
            if (node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
        }
        for (i in 0 until node.childCount) {
            if (findAndClick(node.getChild(i), depth + 1)) return true
        }
        return false
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    companion object {
        /** 安装确认词:覆盖 AOSP / Google / 小米 / 华为 / 三星 / 英文界面。 */
        private val CONFIRM_WORDS = arrayOf(
            "安装", "继续", "完成", "打开", "确定",
            "Install", "Update", "Continue", "Done", "Open", "OK",
        )
    }
}
`

const XML_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/${DESC_STRING}"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagReportViewIds|flagRetrieveInteractiveWindows"
    android:canRetrieveWindowContent="true"
    android:notificationTimeout="200" />
`

function ensureService(manifest, pkg) {
  const app = manifest.application?.[0]
  if (!app) return { added: false }
  const services = app.service ?? []
  const attr = (e) => e?.$?.[NAME] ?? e?.[NAME]
  if (services.some((e) => String(attr(e) || '').includes(SERVICE_CLASS))) {
    return { added: false }
  }
  services.push({
    $: {
      [NAME]: `.${SERVICE_CLASS}`,
      'android:exported': 'true',
      'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
      'android:label': `@string/${LABEL_STRING}`,
    },
    'intent-filter': [
      {
        action: [{ $: { [NAME]: 'android.accessibilityservice.AccessibilityService' } }],
      },
    ],
    'meta-data': [
      {
        $: {
          [NAME]: 'android.accessibilityservice',
          'android:resource': `@xml/${XML_RES}`,
        },
      },
    ],
  })
  app.service = services
  return { added: true }
}

function ensureString(xml, key, value) {
  if (new RegExp(`name="${key}"`).test(xml)) return xml
  const esc = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const line = `  <string name="${key}">${esc}</string>\n`
  return xml.includes('</resources>')
    ? xml.replace('</resources>', `${line}</resources>`)
    : `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${line}</resources>\n`
}

function writeIfChanged(file, content) {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false
  fs.writeFileSync(file, content)
  return true
}

module.exports = function withAutoInstaller(config) {
  const pkg = config?.android?.package
  if (!pkg) {
    throw new Error('[withAutoInstaller] 缺少 android.package,无法生成无障碍服务类')
  }

  config = withAndroidManifest(config, (cfg) => {
    if (!cfg.modResults?.manifest) return cfg
    const { added } = ensureService(cfg.modResults.manifest, pkg)
    if (added) {
      console.info(`[withAutoInstaller] 注入 ${SERVICE_CLASS}(安装器确认键代点,需用户一次性启用)`)
    }
    return cfg
  })

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.platformProjectRoot
      const javaDir = path.join(root, 'app/src/main/java', ...pkg.split('.'))
      const kotlin = KOTLIN_SOURCE.replace(/__PACKAGE__/g, pkg).replace(/__CLASS__/g, SERVICE_CLASS)
      writeIfChanged(path.join(javaDir, `${SERVICE_CLASS}.kt`), kotlin)
      writeIfChanged(path.join(root, `app/src/main/res/xml/${XML_RES}.xml`), XML_CONFIG)

      const stringsFile = path.join(root, 'app/src/main/res/values/strings.xml')
      let xml = fs.existsSync(stringsFile) ? fs.readFileSync(stringsFile, 'utf8') : ''
      xml = ensureString(xml, LABEL_STRING, 'IHUI 自动安装')
      xml = ensureString(xml, DESC_STRING, '在本应用更新时自动点击系统安装器的安装按钮')
      writeIfChanged(stringsFile, xml)
      return cfg
    },
  ])
}

module.exports.__test__ = { ensureService, ensureString, SERVICE_CLASS, XML_RES }
