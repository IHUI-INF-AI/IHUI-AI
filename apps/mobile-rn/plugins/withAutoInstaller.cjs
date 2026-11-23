// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import android.accessibilityservice.AccessibilityServiceInfo
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * 代点系统安装器确认键(由 withAutoInstaller.cjs 生成,不要直接改 android/ 下的副本)。
 *
 * 只在本应用名(IHUI / 智汇)出现在安装器界面时动作,且点击词限于安装确认类;
 * 安装器是两步(安装 -> 完成),所以一次事件最多连点 3 轮、每轮间隔 1.2s。
 *
 * 2026-11-23 修:此前按「文本包含确认词」全树深度优先取第一个可点节点,
 * 会被确认页的说明文字(如 "Do you want to update this app?" 含 Update)先命中,
 * 于是每轮都在点说明文字、真正的按钮永远点不到(实机验证:Update 对话框挂 14s 无人点)。
 * 现改为:只认短标签(≤12 字,排除整句)且与确认词整词/前缀相等,并按
 * 「Button 类 + 整词命中」加权择优;同时补上「更新/升级/下一步/Next/Upgrade」。
 */
class __CLASS__ : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
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
        debug("installer event pkg=" + pkg)
        handler.removeCallbacksAndMessages(null)
        handler.postDelayed({ clickConfirm(0) }, 700)
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

    override fun onServiceConnected() {
        super.onServiceConnected()
        // 运行时再锁一次 flags:改 XML 后系统偶尔仍用旧的 ServiceInfo(实测 flag IncludeNotImportantViews 不生效)
        val info = serviceInfo ?: return
        info.flags = info.flags or
            AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS or
            AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
        setServiceInfo(info)
        debug("service connected flags=" + info.flags)
    }

    private fun clickConfirm(attempt: Int) {
        if (attempt >= MAX_ATTEMPTS) return
        // 根窗口必须是安装器本身:安装结束/被取消后根窗口会变回本应用,
        // 此时若继续按短标签点「打开/确定」,就会误点自己界面上的链接。
        val root = rootInActiveWindow
        if (root == null) {
            debug("root null, attempt=" + attempt)
            scheduleNext(attempt)
            return
        }
        if (!isInstaller(root.packageName?.toString().orEmpty())) {
            debug("window left installer, attempt=" + attempt)
            return
        }
        if (!mentionsOurApp(root)) {
            debug("app name absent, attempt=" + attempt)
            scheduleNext(attempt)
            return
        }
        debug(
            "root pkg=" + root.packageName + " cls=" + root.className +
                " children=" + root.childCount + " attempt=" + attempt,
        )
        val best = bestFromWindows() ?: bestConfirm(root, 0, null) ?: bestByText(root)
        if (best == null) {
            debug("no confirm node, attempt=" + attempt)
            if (attempt == 0) dumpTree(root, 0)
            // 再试按资源 id 直取(树遍历里看不到正向按钮时,按 id 有时仍可取到)
            val byId = root.findAccessibilityNodeInfosByViewId("android:id/button1")
            debug("byId button1 size=" + (byId?.size ?: -1))
            debug("byText Update size=" + (root.findAccessibilityNodeInfosByText("Update")?.size ?: -1))
            if (!byId.isNullOrEmpty()) {
                val n = byId[0]
                val label0 = labelOf(n)
                val clicked0 = n.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                debug("byId click '" + label0 + "' ok=" + clicked0)
                if (clicked0) {
                    scheduleNext(attempt)
                    return
                }
            }
            scheduleNext(attempt)
            return
        }
        val label = labelOf(best.node)
        val clicked = best.node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        debug("attempt=" + attempt + " click '" + label + "' score=" + best.score + " ok=" + clicked)
        scheduleNext(attempt)
    }

    /** 安装器界面是渐进出现的(暂存进度 -> 确认页 -> 安装中 -> 完成页),单次找不到就按轮询重试。 */
    private fun scheduleNext(attempt: Int) {
        if (attempt + 1 >= MAX_ATTEMPTS) return
        handler.postDelayed({ clickConfirm(attempt + 1) }, 1200)
    }

    /**
     * 枚举交互窗口再找确认键:实测 AOSP 安装器确认页的正向按钮
     * 有时不在 rootInActiveWindow 的树里(2026-11-23 实机:树里只有 Cancel,
     * 同屏 uiautomator 却能看到 android:id/button1),逐个窗口取根更稳。
     */
    private fun bestFromWindows(): Best? {
        val wins = windows ?: return null
        debug("windows=" + wins.size)
        var out: Best? = null
        for (w in wins) {
            val r = w.root ?: continue
            val pkg = r.packageName?.toString().orEmpty()
            if (!isInstaller(pkg) || !mentionsOurApp(r)) continue
            val cand = bestConfirm(r, 0, null) ?: continue
            if (out == null || cand.score > out.score) out = cand
        }
        return out
    }

    /**
     * 按文字在整棵视图树里找确认键(2026-11-23 实机验证):
     * AOSP 安装器确认页的 android:id/button1 不在 root.getChild 逐层遍历里,
     * findAccessibilityNodeInfosByViewId 也取不到,但 findAccessibilityNodeInfosByText("Update") 能命中。
     */
    private fun bestByText(root: AccessibilityNodeInfo): Best? {
        var out: Best? = null
        for (word in CONFIRM_WORDS) {
            val list = root.findAccessibilityNodeInfosByText(word) ?: continue
            for (n in list) {
                if (!n.isClickable) continue
                val label = labelOf(n)
                if (label.isEmpty() || label.length > 12) continue
                val exact = label.equals(word, true)
                if (!exact && !label.startsWith(word, true)) continue
                val isButton = n.className?.toString().orEmpty().contains("Button", true)
                val score = if (isButton && exact) 4 else if (exact) 3 else if (isButton) 2 else 1
                if (out == null || score > out.score) out = Best(n, score)
            }
        }
        return out
    }

    private class Best(val node: AccessibilityNodeInfo, val score: Int)

    /**
     * 深度优先找「最像确认键」的节点。
     * 命中条件:短标签(≤12 字,排除整句说明) ∧ 与确认词整词或前缀相等 ∧ 可点 ∧ 对用户可见。
     * 加权:Button 类+整词 > 整词 > Button 类 > 前缀。
     */
    private fun bestConfirm(node: AccessibilityNodeInfo?, depth: Int, best: Best?): Best? {
        if (node == null || depth > 40) return best
        var out = best
        val label = labelOf(node)
        if (node.isClickable) {
            debug("clickable '" + label + "' visible=" + node.isVisibleToUser + " cls=" + node.className)
        }
        if (label.isNotEmpty() && label.length <= 12 &&
            node.isEnabled && node.isClickable && node.isVisibleToUser
        ) {
            val exact = CONFIRM_WORDS.any { label.equals(it, true) }
            val prefix = !exact && CONFIRM_WORDS.any { label.startsWith(it, true) }
            if (exact || prefix) {
                val isButton = node.className?.toString().orEmpty().contains("Button", true) ||
                    node.viewIdResourceName?.endsWith("button1") == true
                val score = when {
                    isButton && exact -> 4
                    exact -> 3
                    isButton -> 2
                    else -> 1
                }
                if (out == null || score > out.score) out = Best(node, score)
            }
        }
        for (i in 0 until node.childCount) {
            out = bestConfirm(node.getChild(i), depth + 1, out)
        }
        return out
    }

    private fun dumpTree(node: AccessibilityNodeInfo?, depth: Int) {
        if (node == null || depth > 12) return
        debug(
            "  ".repeat(depth) + "cls=" + node.className + " text='" + node.text +
                "' desc='" + node.contentDescription + "' click=" + node.isClickable +
                " vis=" + node.isVisibleToUser + " id=" + node.viewIdResourceName,
        )
        for (i in 0 until node.childCount) dumpTree(node.getChild(i), depth + 1)
    }

    private fun labelOf(node: AccessibilityNodeInfo): String {
        val t = node.text?.toString().orEmpty().trim()
        if (t.isNotEmpty()) return t
        return node.contentDescription?.toString().orEmpty().trim()
    }

    private fun debug(msg: String) {
        if (BuildConfig.DEBUG) Log.d("IHUI.A11y", msg)
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    companion object {
        /** 单次事件最多尝试 12 轮(约 14s),覆盖暂存进度 -> 确认页 -> 安装中 -> 完成页。 */
        private const val MAX_ATTEMPTS = 12

        /** 安装确认词:覆盖 AOSP / Google / 小米 / 华为 / 三星 / 英文界面。 */
        private val CONFIRM_WORDS = arrayOf(
            "安装", "更新", "升级", "继续", "下一步", "完成", "打开", "确定",
            "Install", "Update", "Upgrade", "Continue", "Next", "Done", "Open", "OK",
        )
    }
}
`

/**
 * 配置里 android:isAccessibilityTool="true" 是硬前提(2026-11-23 实机定位):
 * 系统 PackageInstaller 把安装/更新/完成的按钮标记为 accessibilityDataSensitive,
 * 只允许「accessibility tool」类服务读取;缺这一条时树里只剩 Cancel、
 * button1 连 findAccessibilityNodeInfosByViewId/ByText 都取不到,永远点不下去。
 * 逐项实机验证:补上后同一对话框立刻出现 Update 按钮并被 ACTION_CLICK 点中,安装完成。
 */
const XML_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/${DESC_STRING}"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagReportViewIds|flagRetrieveInteractiveWindows|flagIncludeNotImportantViews"
    android:canRetrieveWindowContent="true"
    android:isAccessibilityTool="true"
    android:notificationTimeout="200" />
`

function ensureService(manifest, _pkg) {
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
      xml = ensureString(
        xml,
        DESC_STRING,
        '仅在本应用自身更新时，自动点击系统安装器的「安装/继续/完成」按钮；只识别安装器界面且出现本应用名称时才动作，不读取其他应用内容。',
      )
      writeIfChanged(stringsFile, xml)
      return cfg
    },
  ])
}

module.exports.__test__ = { ensureService, ensureString, SERVICE_CLASS, XML_RES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
