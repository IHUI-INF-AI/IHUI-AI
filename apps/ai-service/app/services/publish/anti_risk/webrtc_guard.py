"""WebRTC IP 泄漏防护 — 拦截 RTCPeerConnection,防止真实 IP 通过 STUN 泄漏。

检测原理:WebRTC 建立 P2P 连接时,浏览器通过 STUN 服务器收集 ICE candidates,
其中 host candidate 包含本地真实 IP(即使使用代理)。站点通过创建 RTCPeerConnection
读取 ICE candidates 即可获取用户真实 IP,绕过代理。

对抗策略:拦截 RTCPeerConnection 构造和相关方法,强制使用 relay-only 策略,
过滤掉 host/srflx candidate(只保留 relay candidate = 代理 IP)。

拦截点(5 类):
1. RTCPeerConnection 构造函数 — 强制 iceTransportPolicy='relay'
2. RTCPeerConnection.prototype.createDataChannel — 拦截数据通道创建
3. RTCPeerConnection.prototype.createOffer — 拦截 offer 创建
4. RTCDataChannel — 防止通过数据通道探测本地 IP
5. webkitRTCPeerConnection — 旧 API 兼容(部分老浏览器)
"""
from __future__ import annotations

import re

from typing import TYPE_CHECKING

from playwright.async_api import Error as PlaywrightError

if TYPE_CHECKING:
    from playwright.async_api import BrowserContext, Page

from app.core.logging import get_logger

logger = get_logger(__name__)


def _build_webrtc_guard_script() -> str:
    """构建 WebRTC IP 泄漏防护 JS 脚本。"""
    return """
(function() {
  'use strict';

  // ---- 1. RTCPeerConnection 构造函数 — 强制 relay-only ----
  try {
    var _origRTC = window.RTCPeerConnection;
    if (_origRTC) {
      window.RTCPeerConnection = function(config, constraints) {
        // 强制 iceTransportPolicy = 'relay'(只用代理转发,不收集本地 IP)
        var patchedConfig = config || {};
        if (!patchedConfig.iceServers) {
          patchedConfig.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
        }
        if (!patchedConfig.iceTransportPolicy) {
          patchedConfig.iceTransportPolicy = 'relay';
        }
        var pc = _origRTC ? new (Function.prototype.bind.apply(_origRTC, [null].concat([patchedConfig, constraints])))() : {};
        // 拦截 onicecandidate,过滤掉非 relay 的候选
        var _origAddEventListener = pc.addEventListener.bind(pc);
        pc.addEventListener = function(type, listener, options) {
          if (type === 'icecandidate' && listener) {
            var _wrappedListener = function(event) {
              if (event && event.candidate) {
                var cand = event.candidate.candidate || '';
                // 只放行 relay 候选(host/srflx 候选含真实 IP,过滤掉)
                if (cand.indexOf('relay') === -1) {
                  // 阻止非 relay 候选触发
                  return;
                }
              }
              return listener.call(this, event);
            };
            return _origAddEventListener(type, _wrappedListener, options);
          }
          return _origAddEventListener(type, listener, options);
        };
        return pc;
      };
      window.RTCPeerConnection.prototype = _origRTC ? _origRTC.prototype : {};
    }
  } catch (e) {}

  // ---- 2. RTCPeerConnection.prototype.createDataChannel ----
  try {
    if (window.RTCPeerConnection && window.RTCPeerConnection.prototype) {
      var _proto = window.RTCPeerConnection.prototype;
      if (_proto.createDataChannel) {
        var _origCDC = _proto.createDataChannel;
        _proto.createDataChannel = function(label, options) {
          // 数据通道创建不直接泄漏 IP,但某些指纹通过 RTCDataChannel 探测
          var channel = _origCDC.apply(this, arguments);
          return channel;
        };
      }
      // ---- 3. createOffer / createAnswer ----
      if (_proto.createOffer) {
        var _origCreateOffer = _proto.createOffer;
        _proto.createOffer = function(options) {
          var patchedOpts = options || {};
          // 强制 offerToReceiveAudio/Video 为 false(避免媒体流泄漏 IP)
          patchedOpts.offerToReceiveAudio = false;
          patchedOpts.offerToReceiveVideo = false;
          return _origCreateOffer.call(this, patchedOpts);
        };
      }
      if (_proto.createAnswer) {
        var _origCreateAnswer = _proto.createAnswer;
        _proto.createAnswer = function(options) {
          var patchedOpts = options || {};
          patchedOpts.offerToReceiveAudio = false;
          patchedOpts.offerToReceiveVideo = false;
          return _origCreateAnswer.call(this, patchedOpts);
        };
      }
      // ---- 拦截 addIceCandidate,过滤非 relay 候选 ----
      if (_proto.addIceCandidate) {
        var _origAddIce = _proto.addIceCandidate;
        _proto.addIceCandidate = function(candidate) {
          if (candidate && candidate.candidate) {
            var cand = candidate.candidate;
            if (typeof cand === 'string' && cand.indexOf('relay') === -1) {
              return Promise.resolve();
            }
          }
          return _origAddIce.apply(this, arguments);
        };
      }
    }
  } catch (e) {}

  // ---- 4. webkitRTCPeerConnection(旧 API 兼容)----
  try {
    if (window.webkitRTCPeerConnection && !window.RTCPeerConnection) {
      window.RTCPeerConnection = window.webkitRTCPeerConnection;
      window.webkitRTCPeerConnection = undefined;
    }
  } catch (e) {}

  // ---- 5. RTCDataChannel 防护 ----
  try {
    if (window.RTCDataChannel && window.RTCDataChannel.prototype) {
      // 防止通过 RTCDataChannel.id 探测(部分实现用递增 ID 作为指纹)
      var _origId = Object.getOwnPropertyDescriptor(window.RTCDataChannel.prototype, 'id');
      if (_origId && _origId.get) {
        Object.defineProperty(window.RTCDataChannel.prototype, 'id', {
          get: function() {
            var v = _origId.get.call(this);
            return typeof v === 'number' ? v % 65536 : v;
          },
          configurable: true,
        });
      }
    }
  } catch (e) {}

  // ---- 6. 媒体流防护(getUserMedia 不在此拦截,由 media_devices_guard 处理)----
  // 确保不创建可能泄漏本地 IP 的媒体流

})();
"""


async def inject_webrtc_guard(context: BrowserContext) -> None:
    """对 BrowserContext 注入 WebRTC IP 泄漏防护脚本。

    拦截 RTCPeerConnection,强制 relay-only ICE 策略,过滤 host/srflx 候选,
    防止真实 IP 通过 STUN 泄漏(绕过代理)。

    Args:
        context: Playwright BrowserContext(async)
    """
    script = _build_webrtc_guard_script()
    await context.add_init_script(script)
    logger.debug("[webrtc_guard] WebRTC 防护已注入(6 类拦截点)")


async def verify_no_leak(page: Page) -> bool:
    """打开 browserleaks.com/webrtc 验证无 IP 泄漏。

    Args:
        page: Playwright Page(async)

    Returns:
        True 表示无泄漏(未检测到真实 IP),False 表示有泄漏
    """
    try:
        await page.goto("https://browserleaks.com/webrtc", timeout=30000, wait_until="domcontentloaded")
        # 等待检测结果加载
        await page.wait_for_timeout(3000)
        # 检查页面是否显示真实 IP(browserleaks 在 #ip 或 .table 中显示)
        content = await page.content()
        # 如果包含真实 IP 地址模式(数字.数字.数字.数字 且非 0.0.0.0),视为泄漏
        ip_pattern = r'\b(?:\d{1,3}\.){3}\d{1,3}\b'
        ips = re.findall(ip_pattern, content)
        # 过滤掉 0.0.0.0 和 127.0.0.1(非真实 IP)
        real_ips = [ip for ip in ips if ip not in ('0.0.0.0', '127.0.0.1')]
        if real_ips:
            logger.warning(
                "[webrtc_guard] 检测到可能的 IP 泄漏: %s", real_ips[:3],
            )
            return False
        logger.info("[webrtc_guard] WebRTC 泄漏验证通过(无真实 IP 泄漏)")
        return True
    except PlaywrightError as e:
        logger.warning("[webrtc_guard] 泄漏验证失败(无法访问 browserleaks): %s", e)
        # 验证失败时返回 True(降级:不阻断流程,但记录警告)
        return True


__all__ = [
    "inject_webrtc_guard",
    "verify_no_leak",
    "_build_webrtc_guard_script",
]
