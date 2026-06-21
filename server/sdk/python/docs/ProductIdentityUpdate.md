# ProductIdentityUpdate


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
from zhs_api.models.product_identity_update import ProductIdentityUpdate

# TODO update the JSON string below
json = "{}"
# create an instance of ProductIdentityUpdate from a JSON string
product_identity_update_instance = ProductIdentityUpdate.from_json(json)
# print the JSON string representation of the object
print(ProductIdentityUpdate.to_json())

# convert the object into a dict
product_identity_update_dict = product_identity_update_instance.to_dict()
# create an instance of ProductIdentityUpdate from a dict
product_identity_update_from_dict = ProductIdentityUpdate.from_dict(product_identity_update_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


