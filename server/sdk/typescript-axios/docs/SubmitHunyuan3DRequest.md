# SubmitHunyuan3DRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | 文生3D描述，最多1024字符 | [optional] [default to undefined]
**ImageBase64** | **string** | 输入图Base64 (&lt;&#x3D;8MB) | [optional] [default to undefined]
**ImageUrl** | **string** | 输入图URL (&lt;&#x3D;8MB) | [optional] [default to undefined]
**MultiViewImages** | [**Array&lt;ViewImage&gt;**](ViewImage.md) |  | [optional] [default to undefined]
**ResultFormat** | **string** | OBJ/GLB/STL/USDZ/FBX/MP4 | [optional] [default to undefined]
**EnablePBR** | **boolean** |  | [optional] [default to undefined]

## Example

```typescript
import { SubmitHunyuan3DRequest } from './api';

const instance: SubmitHunyuan3DRequest = {
    Prompt,
    ImageBase64,
    ImageUrl,
    MultiViewImages,
    ResultFormat,
    EnablePBR,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
