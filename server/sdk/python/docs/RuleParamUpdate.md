# RuleParamUpdate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **int** |  | 
**rule_id** | **int** |  | [optional] 
**param_name** | **str** |  | [optional] 
**param_value** | **str** |  | [optional] 
**param_type** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.rule_param_update import RuleParamUpdate

# TODO update the JSON string below
json = "{}"
# create an instance of RuleParamUpdate from a JSON string
rule_param_update_instance = RuleParamUpdate.from_json(json)
# print the JSON string representation of the object
print(RuleParamUpdate.to_json())

# convert the object into a dict
rule_param_update_dict = rule_param_update_instance.to_dict()
# create an instance of RuleParamUpdate from a dict
rule_param_update_from_dict = RuleParamUpdate.from_dict(rule_param_update_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


