# VoiceprintFeatureCreate

Add voiceprint feature request.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** | 用户/声纹名称 | [default to undefined]
**desc** | **string** | 描述 | [optional] [default to undefined]
**audio_url** | **string** | 声纹音频URL | [optional] [default to undefined]
**audio_base64** | **string** | 声纹音频Base64编码 | [optional] [default to undefined]

## Example

```typescript
import { VoiceprintFeatureCreate } from './api';

const instance: VoiceprintFeatureCreate = {
    name,
    desc,
    audio_url,
    audio_base64,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
