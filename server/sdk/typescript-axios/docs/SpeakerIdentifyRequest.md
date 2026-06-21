# SpeakerIdentifyRequest

Speaker identification request.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**group_id** | **string** | 声纹组ID | [default to undefined]
**audio_url** | **string** | 待识别音频URL | [optional] [default to undefined]
**audio_base64** | **string** | 待识别音频Base64编码 | [optional] [default to undefined]

## Example

```typescript
import { SpeakerIdentifyRequest } from './api';

const instance: SpeakerIdentifyRequest = {
    group_id,
    audio_url,
    audio_base64,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
