

# AppApiV1AiDashscopeRouteImageGenerateBody

Image generation request body.

## Properties

| Name | Type | Description | Notes |
|------------ | ------------- | ------------- | -------------|
|**prompt** | **String** | Text prompt for image generation |  |
|**negativePrompt** | **String** | Negative prompt |  [optional] |
|**size** | **String** | Image size, e.g. 1024*1024 |  [optional] |
|**n** | **Integer** | Number of images to generate |  [optional] |
|**style** | **String** | Style preset |  [optional] |
|**sync** | **Boolean** | If true, poll until the task completes and return image URLs directly |  [optional] |
|**zidingyican** | **List&lt;Map&lt;String, Object&gt;&gt;** | Extra custom parameters as name/value pairs |  [optional] |



