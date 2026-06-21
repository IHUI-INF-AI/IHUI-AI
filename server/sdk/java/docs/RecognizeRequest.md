

# RecognizeRequest

ASR request body — accepts a URL or base64-encoded audio.

## Properties

| Name | Type | Description | Notes |
|------------ | ------------- | ------------- | -------------|
|**audioUrl** | **String** | 音频文件URL |  [optional] |
|**audioBase64** | **String** | 音频文件Base64编码 (mp3/wav/pcm) |  [optional] |
|**model** | **String** | ASR模型: paraformer-v2 / qwen3-asr-flash |  [optional] |
|**language** | **String** | 语言代码: zh / en 等，留空自动检测 |  [optional] |
|**sampleRate** | **Integer** | 采样率 (仅PCM格式需要) |  [optional] |



