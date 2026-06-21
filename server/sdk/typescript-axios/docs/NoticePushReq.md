# NoticePushReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**topic** | **string** |  | [optional] [default to 'announcement']
**title** | **string** |  | [optional] [default to '']
**content** | **string** |  | [optional] [default to '']
**userId** | **string** |  | [optional] [default to undefined]
**level** | **string** |  | [optional] [default to 'info']
**extra** | **{ [key: string]: any; }** |  | [optional] [default to undefined]

## Example

```typescript
import { NoticePushReq } from './api';

const instance: NoticePushReq = {
    topic,
    title,
    content,
    userId,
    level,
    extra,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
