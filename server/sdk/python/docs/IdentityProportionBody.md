# IdentityProportionBody


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**begin_time** | **str** |  | [optional] 
**end_time** | **str** |  | [optional] 
**status** | **int** |  | [optional] 
**gift** | **int** |  | [optional] 
**token_proportion** | **int** |  | [optional] 
**vip_gift** | **int** |  | [optional] 
**routine_proportion** | **int** |  | [optional] 
**vip_proportion** | **int** |  | [optional] 
**trader_proportion** | **int** |  | [optional] 
**trader_gift** | **int** |  | [optional] 
**trader_routine_proportion** | **int** |  | [optional] 
**trader_vip_proportion** | **int** |  | [optional] 
**trader_trader_proportion** | **int** |  | [optional] 
**grand_routine_proportion** | **int** |  | [optional] 
**grand_vip_proportion** | **int** |  | [optional] 
**grand_trader_proportion** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.identity_proportion_body import IdentityProportionBody

# TODO update the JSON string below
json = "{}"
# create an instance of IdentityProportionBody from a JSON string
identity_proportion_body_instance = IdentityProportionBody.from_json(json)
# print the JSON string representation of the object
print(IdentityProportionBody.to_json())

# convert the object into a dict
identity_proportion_body_dict = identity_proportion_body_instance.to_dict()
# create an instance of IdentityProportionBody from a dict
identity_proportion_body_from_dict = IdentityProportionBody.from_dict(identity_proportion_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


