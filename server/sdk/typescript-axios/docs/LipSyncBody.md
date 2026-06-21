# LipSyncBody

Lip-sync creation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_uuid** | **string** |  | [default to undefined]
**session_id** | **string** | From /video/identify; if absent, video_id/video_url required | [optional] [default to undefined]
**video_id** | **string** |  | [optional] [default to undefined]
**video_url** | **string** |  | [optional] [default to undefined]
**face_choose** | **any** |  | [default to undefined]
**external_task_id** | **string** |  | [optional] [default to undefined]
**callback_url** | **string** |  | [optional] [default to undefined]
**chat_id** | **string** |  | [optional] [default to '']

## Example

```typescript
import { LipSyncBody } from './api';

const instance: LipSyncBody = {
    user_uuid,
    session_id,
    video_id,
    video_url,
    face_choose,
    external_task_id,
    callback_url,
    chat_id,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
