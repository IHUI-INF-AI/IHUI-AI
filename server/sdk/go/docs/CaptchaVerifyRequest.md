# CaptchaVerifyRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**CaptchaKey** | **string** |  | 
**Code** | **string** |  | 

## Methods

### NewCaptchaVerifyRequest

`func NewCaptchaVerifyRequest(captchaKey string, code string, ) *CaptchaVerifyRequest`

NewCaptchaVerifyRequest instantiates a new CaptchaVerifyRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCaptchaVerifyRequestWithDefaults

`func NewCaptchaVerifyRequestWithDefaults() *CaptchaVerifyRequest`

NewCaptchaVerifyRequestWithDefaults instantiates a new CaptchaVerifyRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCaptchaKey

`func (o *CaptchaVerifyRequest) GetCaptchaKey() string`

GetCaptchaKey returns the CaptchaKey field if non-nil, zero value otherwise.

### GetCaptchaKeyOk

`func (o *CaptchaVerifyRequest) GetCaptchaKeyOk() (*string, bool)`

GetCaptchaKeyOk returns a tuple with the CaptchaKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCaptchaKey

`func (o *CaptchaVerifyRequest) SetCaptchaKey(v string)`

SetCaptchaKey sets CaptchaKey field to given value.


### GetCode

`func (o *CaptchaVerifyRequest) GetCode() string`

GetCode returns the Code field if non-nil, zero value otherwise.

### GetCodeOk

`func (o *CaptchaVerifyRequest) GetCodeOk() (*string, bool)`

GetCodeOk returns a tuple with the Code field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCode

`func (o *CaptchaVerifyRequest) SetCode(v string)`

SetCode sets Code field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


