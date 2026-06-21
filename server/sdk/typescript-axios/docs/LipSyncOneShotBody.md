# LipSyncOneShotBody

One-shot lip-sync: auto identify + create + poll.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_uuid** | **string** |  | [default to undefined]
**video_id** | **string** |  | [optional] [default to undefined]
**video_url** | **string** |  | [optional] [default to undefined]
**face_id** | **string** |  | [optional] [default to undefined]
**audio_id** | **string** |  | [optional] [default to undefined]
**sound_file** | **string** |  | [optional] [default to undefined]
**sound_start_time** | **number** |  | [default to undefined]
**sound_end_time** | **number** |  | [default to undefined]
**sound_insert_time** | **number** |  | [default to undefined]
**sound_volume** | **number** |  | [optional] [default to 1.0]
**original_audio_volume** | **number** |  | [optional] [default to 1.0]
**external_task_id** | **string** |  | [optional] [default to undefined]
**callback_url** | **string** |  | [optional] [default to undefined]
**chat_id** | **string** |  | [optional] [default to '']

## Example

```typescript
import { LipSyncOneShotBody } from './api';

const instance: LipSyncOneShotBody = {
    user_uuid,
    video_id,
    video_url,
    face_id,
    audio_id,
    sound_file,
    sound_start_time,
    sound_end_time,
    sound_insert_time,
    sound_volume,
    original_audio_volume,
    external_task_id,
    callback_url,
    chat_id,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
