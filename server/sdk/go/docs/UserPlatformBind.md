# UserPlatformBind

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**PlatformId** | **int32** |  | 
**Account** | Pointer to **NullableString** |  | [optional] 
**Remark** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewUserPlatformBind

`func NewUserPlatformBind(platformId int32, ) *UserPlatformBind`

NewUserPlatformBind instantiates a new UserPlatformBind object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewUserPlatformBindWithDefaults

`func NewUserPlatformBindWithDefaults() *UserPlatformBind`

NewUserPlatformBindWithDefaults instantiates a new UserPlatformBind object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPlatformId

`func (o *UserPlatformBind) GetPlatformId() int32`

GetPlatformId returns the PlatformId field if non-nil, zero value otherwise.

### GetPlatformIdOk

`func (o *UserPlatformBind) GetPlatformIdOk() (*int32, bool)`

GetPlatformIdOk returns a tuple with the PlatformId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPlatformId

`func (o *UserPlatformBind) SetPlatformId(v int32)`

SetPlatformId sets PlatformId field to given value.


### GetAccount

`func (o *UserPlatformBind) GetAccount() string`

GetAccount returns the Account field if non-nil, zero value otherwise.

### GetAccountOk

`func (o *UserPlatformBind) GetAccountOk() (*string, bool)`

GetAccountOk returns a tuple with the Account field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAccount

`func (o *UserPlatformBind) SetAccount(v string)`

SetAccount sets Account field to given value.

### HasAccount

`func (o *UserPlatformBind) HasAccount() bool`

HasAccount returns a boolean if a field has been set.

### SetAccountNil

`func (o *UserPlatformBind) SetAccountNil(b bool)`

 SetAccountNil sets the value for Account to be an explicit nil

### UnsetAccount
`func (o *UserPlatformBind) UnsetAccount()`

UnsetAccount ensures that no value is present for Account, not even an explicit nil
### GetRemark

`func (o *UserPlatformBind) GetRemark() string`

GetRemark returns the Remark field if non-nil, zero value otherwise.

### GetRemarkOk

`func (o *UserPlatformBind) GetRemarkOk() (*string, bool)`

GetRemarkOk returns a tuple with the Remark field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRemark

`func (o *UserPlatformBind) SetRemark(v string)`

SetRemark sets Remark field to given value.

### HasRemark

`func (o *UserPlatformBind) HasRemark() bool`

HasRemark returns a boolean if a field has been set.

### SetRemarkNil

`func (o *UserPlatformBind) SetRemarkNil(b bool)`

 SetRemarkNil sets the value for Remark to be an explicit nil

### UnsetRemark
`func (o *UserPlatformBind) UnsetRemark()`

UnsetRemark ensures that no value is present for Remark, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


