# SmsCodeVerifyRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**phone** | **str** |  | 
**code** | **str** |  | 

## Example

```python
from zhs_api.models.sms_code_verify_request import SmsCodeVerifyRequest

# TODO update the JSON string below
json = "{}"
# create an instance of SmsCodeVerifyRequest from a JSON string
sms_code_verify_request_instance = SmsCodeVerifyRequest.from_json(json)
# print the JSON string representation of the object
print(SmsCodeVerifyRequest.to_json())

# convert the object into a dict
sms_code_verify_request_dict = sms_code_verify_request_instance.to_dict()
# create an instance of SmsCodeVerifyRequest from a dict
sms_code_verify_request_from_dict = SmsCodeVerifyRequest.from_dict(sms_code_verify_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


