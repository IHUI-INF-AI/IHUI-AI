# AiGcCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_uuid** | **str** |  | 
**agent_id** | **str** |  | [optional] 
**gc_type** | **str** |  | [optional] 
**content** | **str** |  | [optional] 
**status** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.ai_gc_create import AiGcCreate

# TODO update the JSON string below
json = "{}"
# create an instance of AiGcCreate from a JSON string
ai_gc_create_instance = AiGcCreate.from_json(json)
# print the JSON string representation of the object
print(AiGcCreate.to_json())

# convert the object into a dict
ai_gc_create_dict = ai_gc_create_instance.to_dict()
# create an instance of AiGcCreate from a dict
ai_gc_create_from_dict = AiGcCreate.from_dict(ai_gc_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


