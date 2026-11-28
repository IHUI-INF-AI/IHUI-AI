// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/*
 * AI 画中画监看：WS 被 CDN 阻断时的同源画面兜底。
 *
 * 背景：生产 EdgeOne 不保证把 WebSocket Upgrade 透传到 ai-service，页面会停在
 * 「画面已断开」。这个兜底不依赖任何 Next chunk（chunk 可能被 CDN 长期缓存），
 * 而是作为 public 静态文件独立加载：
 *   1. 优先用同源 MJPEG（/api/browser/sessions/{id}/mjpeg）承接 CDP screencast，
 *      与 WS 共用同一条推流，动态页面仍是 20~30fps；
 *   2. MJPEG 4s 内没有首帧时，退回 300ms 截图轮询（静态页也有稳定画面）。
 * 页面一旦收到真实 WS 帧、断开提示消失，本兜底立即停手。
 *
 * token 来源与主组件一致：Tauri 建窗时由 initialization_script 注入
 * window.__IHUI_PIP_TOKEN__，不进页面 URL、不落盘（MJPEG 的 query token 仅在本
 * 请求内有效，且是 15 分钟短票）。
 */
;(function () {
  'use strict'
  console.log('[pip-fallback] script loaded')
  window.__PIP_FALLBACK_LOADED__ = true
  var params = new URLSearchParams(window.location.search)
  var sessionId = params.get('session')
  if (!sessionId) return
  var busy = false
  var objectUrl = null
  var mjpeg = null
  var mjpegTimer = null
  var mjpegStarted = false
  var screenshotStarted = false

  function disconnectedOverlay() {
    var spans = document.querySelectorAll('span')
    for (var i = 0; i < spans.length; i += 1) {
      if (spans[i].textContent && spans[i].textContent.trim() === '画面已断开') {
        return spans[i]
      }
    }
    return null
  }

  function hideOverlay(span) {
    var box = span.closest('div')
    if (box) box.style.setProperty('display', 'none', 'important')
  }

  function drawSource(source, width, height) {
    var canvas = document.querySelector('canvas')
    var ctx = canvas && canvas.getContext('2d')
    if (!canvas || !ctx) return false
    if (width && canvas.width !== width) canvas.width = width
    if (height && canvas.height !== height) canvas.height = height
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    return true
  }

  function stopMjpeg() {
    if (mjpegTimer !== null) {
      window.clearInterval(mjpegTimer)
      mjpegTimer = null
    }
    if (mjpeg) {
      mjpeg.src = ''
      if (mjpeg.parentNode) mjpeg.parentNode.removeChild(mjpeg)
      mjpeg = null
    }
    mjpegStarted = false
  }

  function startScreenshotFallback(token) {
    if (screenshotStarted) return
    screenshotStarted = true
    window.setInterval(function () {
      if (busy) return
      var overlay = disconnectedOverlay()
      if (!overlay) return
      busy = true
      fetch('/api/browser/sessions/' + encodeURIComponent(sessionId) + '/screenshot', {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      })
        .then(function (resp) {
          if (!resp.ok) throw new Error('screenshot ' + resp.status)
          return resp.blob()
        })
        .then(function (blob) {
          return new Promise(function (resolve, reject) {
            objectUrl = URL.createObjectURL(blob)
            var img = new Image()
            img.onload = function () {
              try {
                drawSource(img, img.naturalWidth || 1280, img.naturalHeight || 720)
                resolve()
              } catch (err) {
                reject(err)
              }
            }
            img.onerror = reject
            img.src = objectUrl
          })
        })
        .then(function () {
          hideOverlay(overlay)
        })
        .catch(function () {
          /* 单帧失败不改状态，下一轮继续 */
        })
        .finally(function () {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl)
            objectUrl = null
          }
          busy = false
        })
    }, 300)
  }

  function startMjpeg(token) {
    console.log('[pip-fallback] startMjpeg', !!token, sessionId)
    if (mjpegStarted) return
    mjpegStarted = true
    mjpeg = new Image()
    mjpeg.alt = ''
    mjpeg.style.cssText =
      'position:fixed;left:-10px;top:-10px;width:1px;height:1px;opacity:0;pointer-events:none;'
    mjpeg.onload = function () {
      /* multipart 的首帧到达；后续帧会复用同一 naturalWidth/naturalHeight */
      console.log('[pip-fallback] mjpeg first frame', mjpeg.naturalWidth, mjpeg.naturalHeight)
      mjpegStarted = true
    }
    mjpeg.onerror = function () {
      console.log('[pip-fallback] mjpeg error')
      stopMjpeg()
      startScreenshotFallback(token)
    }
    mjpeg.src =
      '/api/browser/sessions/' +
      encodeURIComponent(sessionId) +
      '/mjpeg?token=' +
      encodeURIComponent(token)
    document.body.appendChild(mjpeg)

    mjpegTimer = window.setInterval(function () {
      var overlay = disconnectedOverlay()
      if (!overlay) {
        stopMjpeg()
        return
      }
      if (!mjpeg || !mjpeg.naturalWidth) return
      if (drawSource(mjpeg, mjpeg.naturalWidth, mjpeg.naturalHeight)) hideOverlay(overlay)
    }, 40)

    window.setTimeout(function () {
      if (!mjpegStarted) {
        console.log('[pip-fallback] mjpeg no first frame, fallback screenshot')
        stopMjpeg()
        startScreenshotFallback(token)
      }
    }, 4000)
  }

  /* MJPEG 需要 token；token 尚未注入时等一小会儿再试 */
  function boot() {
    var token = window.__IHUI_PIP_TOKEN__
    var overlay = disconnectedOverlay()
    if (!overlay) return
    if (!token) {
      window.setTimeout(boot, 250)
      return
    }
    startMjpeg(token)
  }

  window.setTimeout(boot, 0)
  window.setInterval(function () {
    if (screenshotStarted) return
    var overlay = disconnectedOverlay()
    if (overlay) boot()
  }, 1000)
})()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
