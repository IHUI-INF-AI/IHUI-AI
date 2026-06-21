

# VideoSynthesisRequest

Video synthesis request body (async task).

## Properties

| Name | Type | Description | Notes |
|------------ | ------------- | ------------- | -------------|
|**prompt** | **String** | 视频生成文本提示 |  |
|**imageUrl** | **String** | 图生视频的图片URL；留空则文生视频 |  [optional] |
|**audioUrl** | **String** | 音频URL，用于音频驱动视频 |  [optional] |
|**model** | **String** | 视频合成模型 |  [optional] |
|**duration** | **Integer** | 视频时长（秒） |  [optional] |
|**resolution** | **String** | 视频分辨率，如 1280*720 |  [optional] |
|**zidingyican** | **List&lt;Map&lt;String, Object&gt;&gt;** | Extra custom parameters as name/value pairs |  [optional] |



