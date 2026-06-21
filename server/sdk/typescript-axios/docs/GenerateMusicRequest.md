# GenerateMusicRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **string** | 音乐描述 / 歌词提示 | [default to undefined]
**mv** | **string** | 模型版本, e.g. v3.5, v4 | [optional] [default to undefined]
**style** | **string** | 音乐风格, e.g. pop, rock, jazz | [optional] [default to undefined]
**title** | **string** | 歌曲标题 | [optional] [default to undefined]
**duration** | **number** | 时长(秒) | [optional] [default to undefined]
**instrumental** | **boolean** | 是否纯音乐(无人声) | [optional] [default to undefined]

## Example

```typescript
import { GenerateMusicRequest } from './api';

const instance: GenerateMusicRequest = {
    prompt,
    mv,
    style,
    title,
    duration,
    instrumental,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
