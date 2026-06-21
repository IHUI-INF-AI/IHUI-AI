# SmsCodeVerifyRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Phone** | **string** |  | 
**Code** | **string** |  | 

## Methods

### NewSmsCodeVerifyRequest

`func NewSmsCodeVerifyRequest(phone string, code string, ) *SmsCodeVerifyRequest`

NewSmsCodeVerifyRequest instantiates a new SmsCodeVerifyRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSmsCodeVerifyRequestWithDefaults

`func NewSmsCodeVerifyRequestWithDefaults() *SmsCodeVerifyRequest`

NewSmsCodeVerifyRequestWithDefaults instantiates a new SmsCodeVerifyRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPhone

`func (o *SmsCodeVerifyRequest) GetPhone() string`

GetPhone returns the Phone field if non-nil, zero value otherwise.

### GetPhoneOk

`func (o *SmsCodeVerifyRequest) GetPhoneOk() (*string, bool)`

GetPhoneOk returns a tuple with the Phone field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPhone

`func (o *SmsCodeVerifyRequest) SetPhone(v string)`

SetPhone sets Phone field to given value.


### GetCode

`func (o *SmsCodeVerifyRequest) GetCode() string`

GetCode returns the Code field if non-nil, zero value otherwise.

### GetCodeOk

`func (o *SmsCodeVerifyRequest) GetCodeOk() (*string, bool)`

GetCodeOk returns a tuple with the Code field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCode

`func (o *SmsCodeVerifyRequest) SetCode(v string)`

SetCode sets Code field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


