

# Jimeng4ImageRequest

JiMeng 4.0 text-to-image request (mirrors official API fields).

## Properties

| Name | Type | Description | Notes |
|------------ | ------------- | ------------- | -------------|
|**prompt** | **String** | Generation prompt |  |
|**imageUrls** | **List&lt;String&gt;** | Reference images (0-10) |  [optional] |
|**size** | **Integer** | Total pixel area [1024*1024, 4096*4096] |  [optional] |
|**width** | **Integer** | Image width (use with height) |  [optional] |
|**height** | **Integer** | Image height (use with width) |  [optional] |
|**seed** | **Integer** | Random seed, default -1 |  [optional] |
|**scale** | **BigDecimal** | Text influence [0,1], default 0.5 |  [optional] |
|**forceSingle** | **Boolean** | Force single image |  [optional] |
|**minRatio** | **BigDecimal** | Min width/height ratio |  [optional] |
|**maxRatio** | **BigDecimal** | Max width/height ratio |  [optional] |
|**returnUrl** | **Boolean** | Return image URLs (24h validity) |  [optional] |



