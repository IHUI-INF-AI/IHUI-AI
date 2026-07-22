package com.ihui.ai.sdk.module;

import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.BaseClient;
import com.ihui.ai.sdk.model.AudioSpeechRequest;

import java.util.Map;

/**
 * 音频模块 — TTS / ASR / 语音对话 / 声纹 / 音乐生成。
 *
 * <p>端点(8 个):
 * <ul>
 *   <li>GET  /v1/audio/voices</li>
 *   <li>POST /v1/audio/speech(TTS)</li>
 *   <li>POST /v1/audio/transcriptions(ASR)</li>
 *   <li>POST /v1/audio/chat(语音对话)</li>
 *   <li>GET  /v1/audio/speakers(声纹列表)</li>
 *   <li>POST /v1/audio/speakers(声纹注册)</li>
 *   <li>POST /v1/audio/speakers/compare(声纹比对)</li>
 *   <li>POST /v1/audio/music(音乐生成)</li>
 * </ul>
 */
public final class AudioApi {

    private final BaseClient client;

    /**
     * 构造 AudioApi。
     *
     * @param client 底层 BaseClient
     */
    public AudioApi(BaseClient client) {
        this.client = client;
    }

    /**
     * GET /v1/audio/voices(音色列表)。
     *
     * @return 音色列表(JsonNode)
     */
    public JsonNode listVoices() {
        return client.request("GET", "/audio/voices", null, JsonNode.class);
    }

    /**
     * POST /v1/audio/speech(文字转语音)。
     *
     * <p>响应通常为 JSON(含音频 URL),如需下载音频二进制,请用响应中的 url 调用
     * {@link BaseClient#requestBytes(String)} 或自行 HTTP GET。
     *
     * @param req TTS 请求
     * @return 响应(JsonNode,含音频 URL 或 base64)
     */
    public JsonNode speech(AudioSpeechRequest req) {
        return client.request("POST", "/audio/speech", req, JsonNode.class);
    }

    /**
     * POST /v1/audio/transcriptions(语音转文字)。
     *
     * @param req 请求体(audio base64 / model 等)
     * @return 转写结果(JsonNode)
     */
    public JsonNode transcriptions(Map<String, Object> req) {
        return client.request("POST", "/audio/transcriptions", req, JsonNode.class);
    }

    /**
     * POST /v1/audio/chat(语音对话)。
     *
     * @param req 请求体
     * @return 对话结果(JsonNode)
     */
    public JsonNode chat(Map<String, Object> req) {
        return client.request("POST", "/audio/chat", req, JsonNode.class);
    }

    /**
     * GET /v1/audio/speakers(声纹列表)。
     *
     * @return 声纹列表(JsonNode)
     */
    public JsonNode listSpeakers() {
        return client.request("GET", "/audio/speakers", null, JsonNode.class);
    }

    /**
     * POST /v1/audio/speakers(声纹注册)。
     *
     * @param req 请求体(name / audio 等)
     * @return 注册结果(JsonNode)
     */
    public JsonNode registerSpeaker(Map<String, Object> req) {
        return client.request("POST", "/audio/speakers", req, JsonNode.class);
    }

    /**
     * POST /v1/audio/speakers/compare(声纹比对)。
     *
     * @param req 请求体(audio1 / audio2 等)
     * @return 比对结果(JsonNode)
     */
    public JsonNode compareSpeakers(Map<String, Object> req) {
        return client.request("POST", "/audio/speakers/compare", req, JsonNode.class);
    }

    /**
     * POST /v1/audio/music(音乐生成)。
     *
     * @param req 请求体(prompt / duration 等)
     * @return 音乐生成结果(JsonNode)
     */
    public JsonNode music(Map<String, Object> req) {
        return client.request("POST", "/audio/music", req, JsonNode.class);
    }
}
