

# AudioRecognizeRequest

Audio recognition request body.

## Properties

| Name | Type | Description | Notes |
|------------ | ------------- | ------------- | -------------|
|**audioUrl** | **String** | 音频文件URL |  |
|**model** | **String** | 语音识别模型名称 |  [optional] |
|**language** | **String** | 音频语言代码，如 zh / en；留空自动检测 |  [optional] |
|**enableLid** | **Boolean** | 启用语言检测 |  [optional] |
|**enableItn** | **Boolean** | 启用逆文本标准化 |  [optional] |
|**systemPrompt** | **String** | 系统提示词 |  [optional] |
|**userUuid** | **String** | 用户UUID（兼容字段） |  [optional] |
|**userId** | **String** | 用户ID（兼容字段） |  [optional] |
|**chatId** | **String** | 对话ID |  [optional] |
|**conversationId** | **String** | 对话ID（兼容字段） |  [optional] |
|**asrOptions** | **Map&lt;String, Object&gt;** | ASR选项（兼容字段，优先于 enable_lid/enable_itn/language） |  [optional] |



