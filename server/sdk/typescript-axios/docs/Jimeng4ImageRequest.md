# Jimeng4ImageRequest

JiMeng 4.0 text-to-image request (mirrors official API fields).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** | Generation prompt | [default to undefined]
**image_urls** | **Array&lt;string&gt;** | Reference images (0-10) | [optional] [default to undefined]
**size** | **number** | Total pixel area [1024*1024, 4096*4096] | [optional] [default to undefined]
**width** | **number** | Image width (use with height) | [optional] [default to undefined]
**height** | **number** | Image height (use with width) | [optional] [default to undefined]
**seed** | **number** | Random seed, default -1 | [optional] [default to undefined]
**scale** | **number** | Text influence [0,1], default 0.5 | [optional] [default to undefined]
**force_single** | **boolean** | Force single image | [optional] [default to undefined]
**min_ratio** | **number** | Min width/height ratio | [optional] [default to undefined]
**max_ratio** | **number** | Max width/height ratio | [optional] [default to undefined]
**return_url** | **boolean** | Return image URLs (24h validity) | [optional] [default to undefined]

## Example

```typescript
import { Jimeng4ImageRequest } from './api';

const instance: Jimeng4ImageRequest = {
    prompt,
    image_urls,
    size,
    width,
    height,
    seed,
    scale,
    force_single,
    min_ratio,
    max_ratio,
    return_url,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
