# NoticePushReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**topic** | **str** |  | [optional] [default to 'announcement']
**title** | **str** |  | [optional] [default to '']
**content** | **str** |  | [optional] [default to '']
**user_id** | **str** |  | [optional] 
**level** | **str** |  | [optional] [default to 'info']
**extra** | **Dict[str, object]** |  | [optional] 

## Example

```python
from zhs_api.models.notice_push_req import NoticePushReq

# TODO update the JSON string below
json = "{}"
# create an instance of NoticePushReq from a JSON string
notice_push_req_instance = NoticePushReq.from_json(json)
# print the JSON string representation of the object
print(NoticePushReq.to_json())

# convert the object into a dict
notice_push_req_dict = notice_push_req_instance.to_dict()
# create an instance of NoticePushReq from a dict
notice_push_req_from_dict = NoticePushReq.from_dict(notice_push_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


