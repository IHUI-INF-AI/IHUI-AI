# SmsVerifyRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**phone** | **str** |  | 
**temp_id** | **int** |  | [optional] 
**temp_code** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.sms_verify_request import SmsVerifyRequest

# TODO update the JSON string below
json = "{}"
# create an instance of SmsVerifyRequest from a JSON string
sms_verify_request_instance = SmsVerifyRequest.from_json(json)
# print the JSON string representation of the object
print(SmsVerifyRequest.to_json())

# convert the object into a dict
sms_verify_request_dict = sms_verify_request_instance.to_dict()
# create an instance of SmsVerifyRequest from a dict
sms_verify_request_from_dict = SmsVerifyRequest.from_dict(sms_verify_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


