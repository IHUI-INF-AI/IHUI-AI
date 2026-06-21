# CaptchaVerifyRequest

Request model for captcha verification.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**captcha_key** | **str** |  | 
**code** | **str** |  | 

## Example

```python
from zhs_api.models.captcha_verify_request import CaptchaVerifyRequest

# TODO update the JSON string below
json = "{}"
# create an instance of CaptchaVerifyRequest from a JSON string
captcha_verify_request_instance = CaptchaVerifyRequest.from_json(json)
# print the JSON string representation of the object
print(CaptchaVerifyRequest.to_json())

# convert the object into a dict
captcha_verify_request_dict = captcha_verify_request_instance.to_dict()
# create an instance of CaptchaVerifyRequest from a dict
captcha_verify_request_from_dict = CaptchaVerifyRequest.from_dict(captcha_verify_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


