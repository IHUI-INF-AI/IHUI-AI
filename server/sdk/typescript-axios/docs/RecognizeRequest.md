# RecognizeRequest

ASR request body — accepts a URL or base64-encoded audio.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**audio_url** | **string** | 音频文件URL | [optional] [default to undefined]
**audio_base64** | **string** | 音频文件Base64编码 (mp3/wav/pcm) | [optional] [default to undefined]
**model** | **string** | ASR模型: paraformer-v2 / qwen3-asr-flash | [optional] [default to 'paraformer-v2']
**language** | **string** | 语言代码: zh / en 等，留空自动检测 | [optional] [default to undefined]
**sample_rate** | **number** | 采样率 (仅PCM格式需要) | [optional] [default to undefined]

## Example

```typescript
import { RecognizeRequest } from './api';

const instance: RecognizeRequest = {
    audio_url,
    audio_base64,
    model,
    language,
    sample_rate,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
