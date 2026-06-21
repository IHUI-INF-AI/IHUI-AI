# CanaryResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ok** | **bool** |  | [optional] [default to True]
**data** | **Dict[str, object]** |  | [optional] 

## Example

```python
from zhs_api.models.canary_response import CanaryResponse

# TODO update the JSON string below
json = "{}"
# create an instance of CanaryResponse from a JSON string
canary_response_instance = CanaryResponse.from_json(json)
# print the JSON string representation of the object
print(CanaryResponse.to_json())

# convert the object into a dict
canary_response_dict = canary_response_instance.to_dict()
# create an instance of CanaryResponse from a dict
canary_response_from_dict = CanaryResponse.from_dict(canary_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


