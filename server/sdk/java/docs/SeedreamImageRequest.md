

# SeedreamImageRequest

Request body for Seedream image generation (via Doubao Bearer token API).

## Properties

| Name | Type | Description | Notes |
|------------ | ------------- | ------------- | -------------|
|**prompt** | **String** | Generation prompt, supports Chinese/English |  |
|**userUuid** | **String** | User UUID |  |
|**chatId** | **String** | Chat context ID |  [optional] |
|**images** | **String** | Image URL or Base64 for image-to-image |  [optional] |
|**zidingyican** | [**List&lt;AppApiV1AiDoubaoRouteCustomParameter&gt;**](AppApiV1AiDoubaoRouteCustomParameter.md) | Custom parameters |  [optional] |



