# ProductIdentityCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **str** |  | 
**name** | **str** |  | [optional] 
**description** | **str** |  | [optional] 
**price** | **int** |  | [optional] 
**token_amount** | **int** |  | [optional] 
**identity_type** | **str** |  | [optional] 
**duration_days** | **int** |  | [optional] 
**status** | **int** |  | [optional] 
**sort** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.product_identity_create import ProductIdentityCreate

# TODO update the JSON string below
json = "{}"
# create an instance of ProductIdentityCreate from a JSON string
product_identity_create_instance = ProductIdentityCreate.from_json(json)
# print the JSON string representation of the object
print(ProductIdentityCreate.to_json())

# convert the object into a dict
product_identity_create_dict = product_identity_create_instance.to_dict()
# create an instance of ProductIdentityCreate from a dict
product_identity_create_from_dict = ProductIdentityCreate.from_dict(product_identity_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


