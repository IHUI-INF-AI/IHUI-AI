# PromoteRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**actor** | **str** | 操作者 | [optional] [default to 'api']
**reason** | **str** | 原因 | [optional] [default to '']

## Example

```python
from zhs_api.models.promote_request import PromoteRequest

# TODO update the JSON string below
json = "{}"
# create an instance of PromoteRequest from a JSON string
promote_request_instance = PromoteRequest.from_json(json)
# print the JSON string representation of the object
print(PromoteRequest.to_json())

# convert the object into a dict
promote_request_dict = promote_request_instance.to_dict()
# create an instance of PromoteRequest from a dict
promote_request_from_dict = PromoteRequest.from_dict(promote_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


