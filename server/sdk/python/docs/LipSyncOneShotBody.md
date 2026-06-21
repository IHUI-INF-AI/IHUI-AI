# LipSyncOneShotBody

One-shot lip-sync: auto identify + create + poll.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_uuid** | **str** |  | 
**video_id** | **str** |  | [optional] 
**video_url** | **str** |  | [optional] 
**face_id** | **str** |  | [optional] 
**audio_id** | **str** |  | [optional] 
**sound_file** | **str** |  | [optional] 
**sound_start_time** | **int** |  | 
**sound_end_time** | **int** |  | 
**sound_insert_time** | **int** |  | 
**sound_volume** | **float** |  | [optional] [default to 1.0]
**original_audio_volume** | **float** |  | [optional] [default to 1.0]
**external_task_id** | **str** |  | [optional] 
**callback_url** | **str** |  | [optional] 
**chat_id** | **str** |  | [optional] [default to '']

## Example

```python
from zhs_api.models.lip_sync_one_shot_body import LipSyncOneShotBody

# TODO update the JSON string below
json = "{}"
# create an instance of LipSyncOneShotBody from a JSON string
lip_sync_one_shot_body_instance = LipSyncOneShotBody.from_json(json)
# print the JSON string representation of the object
print(LipSyncOneShotBody.to_json())

# convert the object into a dict
lip_sync_one_shot_body_dict = lip_sync_one_shot_body_instance.to_dict()
# create an instance of LipSyncOneShotBody from a dict
lip_sync_one_shot_body_from_dict = LipSyncOneShotBody.from_dict(lip_sync_one_shot_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


