"""AudioContext 指纹防护 — 拦截音频 API,注入确定性微量噪声。

检测原理:站点通过 AudioContext/OfflineAudioContext 生成音频信号,再读取
AnalyserNode.getFloatFrequencyData / AudioBuffer.getChannelData 的浮点数据计算
哈希,作为设备指纹。同浏览器音频指纹稳定(取决于音频硬件+DSP)。

对抗策略:拦截音频数据读取 API,在返回的 Float32Array 上加 ±1e-7 的确定性噪声。
- ±1e-7 噪声:人耳不可感知(float32 精度远高于此),但破坏哈希
- 基于 account_seed 确定性生成(同账号跨会话一致,不同账号差异)

拦截点(4 类):
1. AudioContext.prototype.createOscillator — 拦截振荡器创建
2. AudioBuffer.prototype.getChannelData — 在 float32 数组上加噪声
3. AnalyserNode.prototype.getFloatFrequencyData — 频域数据加噪声
4. OfflineAudioContext — 离线音频上下文(常用于指纹采集)
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.async_api import BrowserContext

from app.core.logging import get_logger

logger = get_logger(__name__)


def _build_audio_fingerprint_script(account_seed: int) -> str:
    """构建 AudioContext 指纹防护 JS 脚本。

    account_seed: 账号种子(同账号固定),用于确定性噪声生成。
    """
    return f"""
(function() {{
  'use strict';

  // ---- 账号专属确定性 PRNG(mulberry32)----
  var _seed = {account_seed} >>> 0;
  function _rand() {{
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    var t = _seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }}
  // 噪声范围:±1e-7(float32 精度内,人耳不可感知,但破坏哈希)
  function _audioNoise() {{
    return (_rand() - 0.5) * 2e-7;
  }}

  // ---- 1. AudioBuffer.prototype.getChannelData ----
  // 在返回的 Float32Array 上加 ±1e-7 噪声
  try {{
    var _origGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function(channel) {{
      var data = _origGetChannelData.call(this, channel);
      try {{
        for (var i = 0; i < data.length; i++) {{
          data[i] = data[i] + _audioNoise();
        }}
      }} catch (e) {{}}
      return data;
    }};
  }} catch (e) {{}}

  // ---- 2. AnalyserNode.prototype.getFloatFrequencyData ----
  // 频域数据加噪声
  try {{
    var _origGetFloatFreq = AnalyserNode.prototype.getFloatFrequencyData;
    AnalyserNode.prototype.getFloatFrequencyData = function(array) {{
      _origGetFloatFreq.call(this, array);
      try {{
        for (var i = 0; i < array.length; i++) {{
          array[i] = array[i] + _audioNoise();
        }}
      }} catch (e) {{}}
    }};
  }} catch (e) {{}}

  // ---- 3. AnalyserNode.prototype.getByteFrequencyData ----
  // 字节频域数据也加噪声(部分指纹采集用 byte 版本)
  try {{
    var _origGetByteFreq = AnalyserNode.prototype.getByteFrequencyData;
    AnalyserNode.prototype.getByteFrequencyData = function(array) {{
      _origGetByteFreq.call(this, array);
      try {{
        for (var i = 0; i < array.length; i++) {{
          // byte 范围 0-255,加 ±1 噪声
          array[i] = Math.max(0, Math.min(255, array[i] + Math.floor(_rand() * 3) - 1));
        }}
      }} catch (e) {{}}
    }};
  }} catch (e) {{}}

  // ---- 4. AudioContext.prototype.createOscillator ----
  // 拦截振荡器创建,在输出节点上注入微量噪声
  try {{
    var _origCreateOsc = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function() {{
      var osc = _origCreateOsc.call(this);
      try {{
        // 包装 connect 方法,在连接链路上注入噪声 GainNode
        var _origConnect = osc.connect.bind(osc);
        osc.connect = function(destination) {{
          try {{
            // 创建微量增益节点(1.0 + ±1e-7 噪声)
            var noiseGain = osc.context.createGain();
            noiseGain.gain.value = 1.0 + _audioNoise();
            _origConnect(noiseGain);
            return noiseGain.connect(destination);
          }} catch (e) {{
            return _origConnect(destination);
          }}
        }};
      }} catch (e) {{}}
      return osc;
    }};
  }} catch (e) {{}}

  // ---- 5. OfflineAudioContext 完整防护 ----
  // OfflineAudioContext 是音频指纹采集的主要载体(确定性输出)
  try {{
    if (window.OfflineAudioContext) {{
      var _origOAC = window.OfflineAudioContext;
      // OfflineAudioContext 的 startRendering promise resolve 后,
      // getChannelData 已被全局拦截,无需额外处理
      // 但确保 OfflineAudioContext 的 sampleRate 锁定为标准值
      window.OfflineAudioContext = function(numberOfChannels, length, sampleRate) {{
        var ctx = _origOAC ? new (Function.prototype.bind.apply(_origOAC, arguments))() : {{}};
        try {{
          var _lockedSR = (_seed % 2 === 0) ? 44100 : 48000;
          Object.defineProperty(ctx, 'sampleRate', {{
            get: function() {{ return _lockedSR; }},
            configurable: true,
          }});
        }} catch (e) {{}}
        return ctx;
      }};
      window.OfflineAudioContext.prototype = _origOAC ? _origOAC.prototype : {{}};
    }}
  }} catch (e) {{}}

}})();
"""


async def inject_audio_fingerprint_guard(
    context: BrowserContext, account_seed: int,
) -> None:
    """对 BrowserContext 注入 AudioContext 指纹防护脚本。

    拦截 getChannelData/getFloatFrequencyData/createOscillator/OfflineAudioContext,
    在音频数据上加 ±1e-7 确定性噪声(人耳不可感知,但破坏指纹哈希)。

    Args:
        context: Playwright BrowserContext(async)
        account_seed: 账号种子(同账号固定),用于确定性噪声生成
    """
    script = _build_audio_fingerprint_script(account_seed)
    await context.add_init_script(script)
    logger.debug(
        "[audio_fingerprint] AudioContext 防护已注入(seed=%d,5 类拦截点)",
        account_seed,
    )


__all__ = ["inject_audio_fingerprint_guard", "_build_audio_fingerprint_script"]
