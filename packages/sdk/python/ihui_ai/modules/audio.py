"""音频模块 — TTS / ASR / 语音对话 / 声纹 / 音乐生成。

端点(8 个):
- GET  /v1/audio/voices
- POST /v1/audio/speech(TTS)
- POST /v1/audio/transcriptions(ASR)
- POST /v1/audio/chat(语音对话)
- GET  /v1/audio/speakers(声纹列表)
- POST /v1/audio/speakers(声纹注册)
- POST /v1/audio/speakers/compare(声纹比对)
- POST /v1/audio/music(音乐生成)
"""

from __future__ import annotations

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import (
    V1AudioChatRequest,
    V1AudioChatResponse,
    V1AudioSpeechRequest,
    V1AudioSpeechResponse,
    V1AudioTranscriptionsRequest,
    V1AudioTranscriptionsResponse,
    V1AudioVoicesResponse,
    V1CompareSpeakersRequest,
    V1CompareSpeakersResponse,
    V1MusicGenerationsRequest,
    V1MusicGenerationsResponse,
    V1RegisterSpeakerRequest,
    V1RegisterSpeakerResponse,
    V1SpeakersListResponse,
)


class AudioApi:
    """音频模块(同步)— TTS / ASR / 语音对话 / 声纹 / 音乐。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def list_voices(self) -> V1AudioVoicesResponse:
        """GET /v1/audio/voices(音色列表)。"""
        return self._client.request("GET", "/audio/voices")

    def speech(self, req: V1AudioSpeechRequest) -> V1AudioSpeechResponse:
        """POST /v1/audio/speech(文字转语音)。"""
        return self._client.request("POST", "/audio/speech", req)

    def transcriptions(self, req: V1AudioTranscriptionsRequest) -> V1AudioTranscriptionsResponse:
        """POST /v1/audio/transcriptions(语音转文字)。"""
        return self._client.request("POST", "/audio/transcriptions", req)

    def chat(self, req: V1AudioChatRequest) -> V1AudioChatResponse:
        """POST /v1/audio/chat(语音对话)。"""
        return self._client.request("POST", "/audio/chat", req)

    def list_speakers(self) -> V1SpeakersListResponse:
        """GET /v1/audio/speakers(声纹列表)。"""
        return self._client.request("GET", "/audio/speakers")

    def register_speaker(self, req: V1RegisterSpeakerRequest) -> V1RegisterSpeakerResponse:
        """POST /v1/audio/speakers(声纹注册)。"""
        return self._client.request("POST", "/audio/speakers", req)

    def compare_speakers(self, req: V1CompareSpeakersRequest) -> V1CompareSpeakersResponse:
        """POST /v1/audio/speakers/compare(声纹比对)。"""
        return self._client.request("POST", "/audio/speakers/compare", req)

    def music(self, req: V1MusicGenerationsRequest) -> V1MusicGenerationsResponse:
        """POST /v1/audio/music(音乐生成)。"""
        return self._client.request("POST", "/audio/music", req)


class AsyncAudioApi:
    """音频模块(asyncio)— TTS / ASR / 语音对话 / 声纹 / 音乐。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def list_voices(self) -> V1AudioVoicesResponse:
        """GET /v1/audio/voices(音色列表)。"""
        return await self._client.request("GET", "/audio/voices")

    async def speech(self, req: V1AudioSpeechRequest) -> V1AudioSpeechResponse:
        """POST /v1/audio/speech(文字转语音)。"""
        return await self._client.request("POST", "/audio/speech", req)

    async def transcriptions(self, req: V1AudioTranscriptionsRequest) -> V1AudioTranscriptionsResponse:
        """POST /v1/audio/transcriptions(语音转文字)。"""
        return await self._client.request("POST", "/audio/transcriptions", req)

    async def chat(self, req: V1AudioChatRequest) -> V1AudioChatResponse:
        """POST /v1/audio/chat(语音对话)。"""
        return await self._client.request("POST", "/audio/chat", req)

    async def list_speakers(self) -> V1SpeakersListResponse:
        """GET /v1/audio/speakers(声纹列表)。"""
        return await self._client.request("GET", "/audio/speakers")

    async def register_speaker(self, req: V1RegisterSpeakerRequest) -> V1RegisterSpeakerResponse:
        """POST /v1/audio/speakers(声纹注册)。"""
        return await self._client.request("POST", "/audio/speakers", req)

    async def compare_speakers(self, req: V1CompareSpeakersRequest) -> V1CompareSpeakersResponse:
        """POST /v1/audio/speakers/compare(声纹比对)。"""
        return await self._client.request("POST", "/audio/speakers/compare", req)

    async def music(self, req: V1MusicGenerationsRequest) -> V1MusicGenerationsResponse:
        """POST /v1/audio/music(音乐生成)。"""
        return await self._client.request("POST", "/audio/music", req)


__all__ = ["AudioApi", "AsyncAudioApi"]
