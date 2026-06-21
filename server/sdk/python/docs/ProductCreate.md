# ProductCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **str** |  | 
**name** | **str** |  | 
**price** | **int** |  | [optional] 
**token_amount** | **int** |  | [optional] 
**type** | **str** |  | [optional] 
**status** | **int** |  | [optional] 
**sort** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.product_create import ProductCreate

# TODO update the JSON string below
json = "{}"
# create an instance of ProductCreate from a JSON string
product_create_instance = ProductCreate.from_json(json)
# print the JSON string representation of the object
print(ProductCreate.to_json())

# convert the object into a dict
product_create_dict = product_create_instance.to_dict()
# create an instance of ProductCreate from a dict
product_create_from_dict = ProductCreate.from_dict(product_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


