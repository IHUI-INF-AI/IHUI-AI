# FailureRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**reason** | **str** | 失败原因 | [optional] [default to '']
**actor** | **str** | 报告者 | [optional] [default to 'api']

## Example

```python
from zhs_api.models.failure_request import FailureRequest

# TODO update the JSON string below
json = "{}"
# create an instance of FailureRequest from a JSON string
failure_request_instance = FailureRequest.from_json(json)
# print the JSON string representation of the object
print(FailureRequest.to_json())

# convert the object into a dict
failure_request_dict = failure_request_instance.to_dict()
# create an instance of FailureRequest from a dict
failure_request_from_dict = FailureRequest.from_dict(failure_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


