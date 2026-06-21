# LipSyncBody

Lip-sync creation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_uuid** | **str** |  | 
**session_id** | **str** | From /video/identify; if absent, video_id/video_url required | [optional] 
**video_id** | **str** |  | [optional] 
**video_url** | **str** |  | [optional] 
**face_choose** | **object** |  | 
**external_task_id** | **str** |  | [optional] 
**callback_url** | **str** |  | [optional] 
**chat_id** | **str** |  | [optional] [default to '']

## Example

```python
from zhs_api.models.lip_sync_body import LipSyncBody

# TODO update the JSON string below
json = "{}"
# create an instance of LipSyncBody from a JSON string
lip_sync_body_instance = LipSyncBody.from_json(json)
# print the JSON string representation of the object
print(LipSyncBody.to_json())

# convert the object into a dict
lip_sync_body_dict = lip_sync_body_instance.to_dict()
# create an instance of LipSyncBody from a dict
lip_sync_body_from_dict = LipSyncBody.from_dict(lip_sync_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


