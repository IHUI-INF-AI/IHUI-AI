# OverridePauseRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**actor** | **str** | 操作者 (审计必填) | [optional] [default to 'api']
**reason** | **str** | 暂停原因 (审计必填) | 
**until_ts** | **float** | 自动恢复时间戳, 0 &#x3D; 永久 | [optional] [default to 0.0]

## Example

```python
from zhs_api.models.override_pause_request import OverridePauseRequest

# TODO update the JSON string below
json = "{}"
# create an instance of OverridePauseRequest from a JSON string
override_pause_request_instance = OverridePauseRequest.from_json(json)
# print the JSON string representation of the object
print(OverridePauseRequest.to_json())

# convert the object into a dict
override_pause_request_dict = override_pause_request_instance.to_dict()
# create an instance of OverridePauseRequest from a dict
override_pause_request_from_dict = OverridePauseRequest.from_dict(override_pause_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


