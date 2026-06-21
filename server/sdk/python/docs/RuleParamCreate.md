# RuleParamCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**rule_id** | **int** |  | 
**param_name** | **str** |  | 
**param_value** | **str** |  | [optional] 
**param_type** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.rule_param_create import RuleParamCreate

# TODO update the JSON string below
json = "{}"
# create an instance of RuleParamCreate from a JSON string
rule_param_create_instance = RuleParamCreate.from_json(json)
# print the JSON string representation of the object
print(RuleParamCreate.to_json())

# convert the object into a dict
rule_param_create_dict = rule_param_create_instance.to_dict()
# create an instance of RuleParamCreate from a dict
rule_param_create_from_dict = RuleParamCreate.from_dict(rule_param_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


