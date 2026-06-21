"""实时 PCM 音频处理器.

迁移自 ZHS_Server_java/mcp/websocket/audio/RealtimePcmPlayer.java.
提供 PCM 流分块推送、缓冲、写入 WAV 等工具.
"""

import asyncio
import io
import wave
from collections import deque


class RealtimePcmPlayer:
    """实时 PCM 播放器."""

    SAMPLE_RATE = 24000
    SAMPLE_WIDTH = 2
    CHANNELS = 1

    def __init__(self, sample_rate: int = 24000, sample_width: int = 2, channels: int = 1):
        self.sample_rate = sample_rate
        self.sample_width = sample_width
        self.channels = channels
        self._buffer: deque[bytes] = deque()
        self._closed = False
        self._total_bytes = 0
        self._start_time: float | None = None

    def feed(self, chunk: bytes) -> None:
        """喂入一帧 PCM 数据."""
        if self._closed or not chunk:
            return
        if self._start_time is None:
            import time
            self._start_time = time.time()
        self._buffer.append(chunk)
        self._total_bytes += len(chunk)

    async def stream(self, ws_send, chunk_size: int = 4096, chunk_delay: float = 0.02) -> int:
        """流式推送 PCM 数据到 WebSocket.

        Returns:
            推送的分块数
        """
        sent = 0
        if self._start_time is None:
            import time
            self._start_time = time.time()
        while self._buffer or not self._closed:
            if not self._buffer:
                await asyncio.sleep(0.01)
                continue
            data = b"".join(list(self._buffer)[:64])
            kept: deque[bytes] = deque()
            for c in list(self._buffer)[64:]:
                kept.append(c)
            self._buffer = kept
            for i in range(0, len(data), chunk_size):
                piece = data[i:i + chunk_size]
                import base64
                await ws_send({
                    "event": "pcm.chunk",
                    "data": base64.b64encode(piece).decode("ascii"),
                    "sample_rate": self.sample_rate,
                    "sample_width": self.sample_width,
                    "channels": self.channels,
                })
                sent += 1
                await asyncio.sleep(chunk_delay)
        return sent

    def close(self) -> None:
        self._closed = True

    def to_wav(self) -> bytes:
        """将缓冲区合并为完整 WAV."""
        pcm_data = b"".join(self._buffer)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(self.channels)
            wf.setsampwidth(self.sample_width)
            wf.setframerate(self.sample_rate)
            wf.writeframes(pcm_data)
        return buf.getvalue()

    def duration(self) -> float:
        """估算当前缓冲区音频时长(秒)."""
        bytes_per_sec = self.sample_rate * self.sample_width * self.channels
        if bytes_per_sec <= 0:
            return 0.0
        return self._total_bytes / bytes_per_sec


_player: RealtimePcmPlayer | None = None


def get_realtime_pcm_player() -> RealtimePcmPlayer:
    global _player
    if _player is None:
        _player = RealtimePcmPlayer()
    return _player
