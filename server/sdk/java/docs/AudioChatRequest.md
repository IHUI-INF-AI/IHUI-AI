

# AudioChatRequest

Audio chat request — voice or text input, returns text + audio.

## Properties

| Name | Type | Description | Notes |
|------------ | ------------- | ------------- | -------------|
|**text** | **String** | 文本输入（可选，与audio_base64二选一） |  [optional] |
|**audioBase64** | **String** | 音频Base64编码（可选，与text二选一） |  [optional] |
|**audioUrl** | **String** | 音频URL（可选） |  [optional] |
|**botId** | **String** | Coze机器人ID（可选，不提供则使用默认AI） |  [optional] |
|**voiceId** | **String** | 回复音色ID |  [optional] |
|**model** | **String** | 对话模型名称 |  [optional] |
|**language** | **String** | 语言 |  [optional] |
|**systemPrompt** | **String** | 系统提示词 |  [optional] |



