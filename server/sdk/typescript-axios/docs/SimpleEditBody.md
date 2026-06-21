# SimpleEditBody

Simple image editing (background removal, etc.).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**images** | **string** | Image URL | [default to undefined]
**prompt** | **string** | Editing instruction / operation | [default to undefined]
**model** | **string** | Model name | [optional] [default to 'qwen-image-edit']
**negative_prompt** | **string** | Negative prompt | [optional] [default to '']
**prompt_extend** | **boolean** | Whether to extend the prompt | [optional] [default to true]
**watermark** | **boolean** | Whether to add watermark | [optional] [default to false]
**sync** | **boolean** | If true, wait for completion and return image URL | [optional] [default to false]

## Example

```typescript
import { SimpleEditBody } from './api';

const instance: SimpleEditBody = {
    images,
    prompt,
    model,
    negative_prompt,
    prompt_extend,
    watermark,
    sync,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
