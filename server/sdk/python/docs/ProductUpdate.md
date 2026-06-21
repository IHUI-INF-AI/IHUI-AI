# ProductUpdate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **str** |  | 
**name** | **str** |  | [optional] 
**price** | **int** |  | [optional] 
**token_amount** | **int** |  | [optional] 
**type** | **str** |  | [optional] 
**status** | **int** |  | [optional] 
**sort** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.product_update import ProductUpdate

# TODO update the JSON string below
json = "{}"
# create an instance of ProductUpdate from a JSON string
product_update_instance = ProductUpdate.from_json(json)
# print the JSON string representation of the object
print(ProductUpdate.to_json())

# convert the object into a dict
product_update_dict = product_update_instance.to_dict()
# create an instance of ProductUpdate from a dict
product_update_from_dict = ProductUpdate.from_dict(product_update_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


