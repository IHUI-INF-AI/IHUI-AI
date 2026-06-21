# BusinessCardReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **str** |  | 
**card** | **str** |  | 
**file_name** | **str** |  | [optional] [default to 'card.png']

## Example

```python
from zhs_api.models.business_card_req import BusinessCardReq

# TODO update the JSON string below
json = "{}"
# create an instance of BusinessCardReq from a JSON string
business_card_req_instance = BusinessCardReq.from_json(json)
# print the JSON string representation of the object
print(BusinessCardReq.to_json())

# convert the object into a dict
business_card_req_dict = business_card_req_instance.to_dict()
# create an instance of BusinessCardReq from a dict
business_card_req_from_dict = BusinessCardReq.from_dict(business_card_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


