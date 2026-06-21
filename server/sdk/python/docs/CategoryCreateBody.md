# CategoryCreateBody


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**agent_id** | **str** |  | 
**group** | **int** |  | [optional] [default to 2]
**type** | **str** |  | [optional] [default to '1']
**type_child** | **str** |  | [optional] [default to '1']
**limit_free** | **str** |  | [optional] 
**account** | **int** |  | [optional] [default to 0]

## Example

```python
from zhs_api.models.category_create_body import CategoryCreateBody

# TODO update the JSON string below
json = "{}"
# create an instance of CategoryCreateBody from a JSON string
category_create_body_instance = CategoryCreateBody.from_json(json)
# print the JSON string representation of the object
print(CategoryCreateBody.to_json())

# convert the object into a dict
category_create_body_dict = category_create_body_instance.to_dict()
# create an instance of CategoryCreateBody from a dict
category_create_body_from_dict = CategoryCreateBody.from_dict(category_create_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


