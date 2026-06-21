# PlaygroundRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**alerts** | [**List[AlertIn]**](AlertIn.md) | 待测告警列表 | 
**rules** | [**List[RuleSpec]**](RuleSpec.md) | 自定义规则 (可选) | [optional] 
**use_default_presets** | **bool** | 叠加 ZHS 平台预设规则 | [optional] [default to False]

## Example

```python
from zhs_api.models.playground_request import PlaygroundRequest

# TODO update the JSON string below
json = "{}"
# create an instance of PlaygroundRequest from a JSON string
playground_request_instance = PlaygroundRequest.from_json(json)
# print the JSON string representation of the object
print(PlaygroundRequest.to_json())

# convert the object into a dict
playground_request_dict = playground_request_instance.to_dict()
# create an instance of PlaygroundRequest from a dict
playground_request_from_dict = PlaygroundRequest.from_dict(playground_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


