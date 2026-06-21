# VideoSynthesisRequest

Video synthesis request body (async task).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** | 视频生成文本提示 | [default to undefined]
**image_url** | **string** | 图生视频的图片URL；留空则文生视频 | [optional] [default to undefined]
**audio_url** | **string** | 音频URL，用于音频驱动视频 | [optional] [default to undefined]
**model** | **string** | 视频合成模型 | [optional] [default to 'wan2.1-t2v-turbo']
**duration** | **number** | 视频时长（秒） | [optional] [default to 5]
**resolution** | **string** | 视频分辨率，如 1280*720 | [optional] [default to '1280*720']
**zidingyican** | **Array&lt;{ [key: string]: any; }&gt;** | Extra custom parameters as name/value pairs | [optional] [default to undefined]

## Example

```typescript
import { VideoSynthesisRequest } from './api';

const instance: VideoSynthesisRequest = {
    prompt,
    image_url,
    audio_url,
    model,
    duration,
    resolution,
    zidingyican,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
