# SpeechRequest

TTS request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**text** | **string** | 要合成的文字内容 | [default to undefined]
**voice_id** | **string** | 音色ID | [optional] [default to 'longxiaochun']
**response_format** | **string** | 输出格式: mp3 / wav / pcm | [optional] [default to 'mp3']
**rate** | **string** | 语速，范围 0.5~2.0，1.0为正常 | [optional] [default to undefined]
**volume** | **string** | 音量，范围 0.5~2.0，1.0为正常 | [optional] [default to undefined]
**pitch** | **string** | 音调，范围 0.5~2.0，1.0为正常 | [optional] [default to undefined]

## Example

```typescript
import { SpeechRequest } from './api';

const instance: SpeechRequest = {
    text,
    voice_id,
    response_format,
    rate,
    volume,
    pitch,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
