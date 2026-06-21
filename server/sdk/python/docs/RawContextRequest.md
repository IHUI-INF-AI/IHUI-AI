# RawContextRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model_name** | **str** | Model name | 
**chat_id** | **str** | Chat ID | 
**limit** | **int** | Max rows to return | [optional] [default to 10]

## Example

```python
from zhs_api.models.raw_context_request import RawContextRequest

# TODO update the JSON string below
json = "{}"
# create an instance of RawContextRequest from a JSON string
raw_context_request_instance = RawContextRequest.from_json(json)
# print the JSON string representation of the object
print(RawContextRequest.to_json())

# convert the object into a dict
raw_context_request_dict = raw_context_request_instance.to_dict()
# create an instance of RawContextRequest from a dict
raw_context_request_from_dict = RawContextRequest.from_dict(raw_context_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


