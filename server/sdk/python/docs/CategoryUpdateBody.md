# CategoryUpdateBody


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**agent_id** | **str** |  | [optional] 
**group** | **int** |  | [optional] 
**type** | **str** |  | [optional] 
**type_child** | **str** |  | [optional] 
**limit_free** | **str** |  | [optional] 
**account** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.category_update_body import CategoryUpdateBody

# TODO update the JSON string below
json = "{}"
# create an instance of CategoryUpdateBody from a JSON string
category_update_body_instance = CategoryUpdateBody.from_json(json)
# print the JSON string representation of the object
print(CategoryUpdateBody.to_json())

# convert the object into a dict
category_update_body_dict = category_update_body_instance.to_dict()
# create an instance of CategoryUpdateBody from a dict
category_update_body_from_dict = CategoryUpdateBody.from_dict(category_update_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


