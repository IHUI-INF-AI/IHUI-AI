# SmsVerifyRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Phone** | **string** |  | 
**TempId** | Pointer to **NullableInt32** |  | [optional] 
**TempCode** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewSmsVerifyRequest

`func NewSmsVerifyRequest(phone string, ) *SmsVerifyRequest`

NewSmsVerifyRequest instantiates a new SmsVerifyRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSmsVerifyRequestWithDefaults

`func NewSmsVerifyRequestWithDefaults() *SmsVerifyRequest`

NewSmsVerifyRequestWithDefaults instantiates a new SmsVerifyRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPhone

`func (o *SmsVerifyRequest) GetPhone() string`

GetPhone returns the Phone field if non-nil, zero value otherwise.

### GetPhoneOk

`func (o *SmsVerifyRequest) GetPhoneOk() (*string, bool)`

GetPhoneOk returns a tuple with the Phone field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPhone

`func (o *SmsVerifyRequest) SetPhone(v string)`

SetPhone sets Phone field to given value.


### GetTempId

`func (o *SmsVerifyRequest) GetTempId() int32`

GetTempId returns the TempId field if non-nil, zero value otherwise.

### GetTempIdOk

`func (o *SmsVerifyRequest) GetTempIdOk() (*int32, bool)`

GetTempIdOk returns a tuple with the TempId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTempId

`func (o *SmsVerifyRequest) SetTempId(v int32)`

SetTempId sets TempId field to given value.

### HasTempId

`func (o *SmsVerifyRequest) HasTempId() bool`

HasTempId returns a boolean if a field has been set.

### SetTempIdNil

`func (o *SmsVerifyRequest) SetTempIdNil(b bool)`

 SetTempIdNil sets the value for TempId to be an explicit nil

### UnsetTempId
`func (o *SmsVerifyRequest) UnsetTempId()`

UnsetTempId ensures that no value is present for TempId, not even an explicit nil
### GetTempCode

`func (o *SmsVerifyRequest) GetTempCode() string`

GetTempCode returns the TempCode field if non-nil, zero value otherwise.

### GetTempCodeOk

`func (o *SmsVerifyRequest) GetTempCodeOk() (*string, bool)`

GetTempCodeOk returns a tuple with the TempCode field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTempCode

`func (o *SmsVerifyRequest) SetTempCode(v string)`

SetTempCode sets TempCode field to given value.

### HasTempCode

`func (o *SmsVerifyRequest) HasTempCode() bool`

HasTempCode returns a boolean if a field has been set.

### SetTempCodeNil

`func (o *SmsVerifyRequest) SetTempCodeNil(b bool)`

 SetTempCodeNil sets the value for TempCode to be an explicit nil

### UnsetTempCode
`func (o *SmsVerifyRequest) UnsetTempCode()`

UnsetTempCode ensures that no value is present for TempCode, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


