# PlatformCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Code** | **string** |  | 
**Name** | **string** |  | 
**Domain** | Pointer to **NullableString** |  | [optional] 
**Remark** | Pointer to **NullableString** |  | [optional] 
**Binding** | Pointer to **NullableString** |  | [optional] 
**FilePath** | Pointer to **NullableString** |  | [optional] 
**Type** | Pointer to **NullableInt32** |  | [optional] 
**Status** | Pointer to **int32** |  | [optional] [default to 1]
**Sort** | Pointer to **int32** |  | [optional] [default to 0]

## Methods

### NewPlatformCreate

`func NewPlatformCreate(code string, name string, ) *PlatformCreate`

NewPlatformCreate instantiates a new PlatformCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPlatformCreateWithDefaults

`func NewPlatformCreateWithDefaults() *PlatformCreate`

NewPlatformCreateWithDefaults instantiates a new PlatformCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCode

`func (o *PlatformCreate) GetCode() string`

GetCode returns the Code field if non-nil, zero value otherwise.

### GetCodeOk

`func (o *PlatformCreate) GetCodeOk() (*string, bool)`

GetCodeOk returns a tuple with the Code field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCode

`func (o *PlatformCreate) SetCode(v string)`

SetCode sets Code field to given value.


### GetName

`func (o *PlatformCreate) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *PlatformCreate) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *PlatformCreate) SetName(v string)`

SetName sets Name field to given value.


### GetDomain

`func (o *PlatformCreate) GetDomain() string`

GetDomain returns the Domain field if non-nil, zero value otherwise.

### GetDomainOk

`func (o *PlatformCreate) GetDomainOk() (*string, bool)`

GetDomainOk returns a tuple with the Domain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDomain

`func (o *PlatformCreate) SetDomain(v string)`

SetDomain sets Domain field to given value.

### HasDomain

`func (o *PlatformCreate) HasDomain() bool`

HasDomain returns a boolean if a field has been set.

### SetDomainNil

`func (o *PlatformCreate) SetDomainNil(b bool)`

 SetDomainNil sets the value for Domain to be an explicit nil

### UnsetDomain
`func (o *PlatformCreate) UnsetDomain()`

UnsetDomain ensures that no value is present for Domain, not even an explicit nil
### GetRemark

`func (o *PlatformCreate) GetRemark() string`

GetRemark returns the Remark field if non-nil, zero value otherwise.

### GetRemarkOk

`func (o *PlatformCreate) GetRemarkOk() (*string, bool)`

GetRemarkOk returns a tuple with the Remark field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRemark

`func (o *PlatformCreate) SetRemark(v string)`

SetRemark sets Remark field to given value.

### HasRemark

`func (o *PlatformCreate) HasRemark() bool`

HasRemark returns a boolean if a field has been set.

### SetRemarkNil

`func (o *PlatformCreate) SetRemarkNil(b bool)`

 SetRemarkNil sets the value for Remark to be an explicit nil

### UnsetRemark
`func (o *PlatformCreate) UnsetRemark()`

UnsetRemark ensures that no value is present for Remark, not even an explicit nil
### GetBinding

`func (o *PlatformCreate) GetBinding() string`

GetBinding returns the Binding field if non-nil, zero value otherwise.

### GetBindingOk

`func (o *PlatformCreate) GetBindingOk() (*string, bool)`

GetBindingOk returns a tuple with the Binding field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBinding

`func (o *PlatformCreate) SetBinding(v string)`

SetBinding sets Binding field to given value.

### HasBinding

`func (o *PlatformCreate) HasBinding() bool`

HasBinding returns a boolean if a field has been set.

### SetBindingNil

`func (o *PlatformCreate) SetBindingNil(b bool)`

 SetBindingNil sets the value for Binding to be an explicit nil

### UnsetBinding
`func (o *PlatformCreate) UnsetBinding()`

UnsetBinding ensures that no value is present for Binding, not even an explicit nil
### GetFilePath

`func (o *PlatformCreate) GetFilePath() string`

GetFilePath returns the FilePath field if non-nil, zero value otherwise.

### GetFilePathOk

`func (o *PlatformCreate) GetFilePathOk() (*string, bool)`

GetFilePathOk returns a tuple with the FilePath field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFilePath

`func (o *PlatformCreate) SetFilePath(v string)`

SetFilePath sets FilePath field to given value.

### HasFilePath

`func (o *PlatformCreate) HasFilePath() bool`

HasFilePath returns a boolean if a field has been set.

### SetFilePathNil

`func (o *PlatformCreate) SetFilePathNil(b bool)`

 SetFilePathNil sets the value for FilePath to be an explicit nil

### UnsetFilePath
`func (o *PlatformCreate) UnsetFilePath()`

UnsetFilePath ensures that no value is present for FilePath, not even an explicit nil
### GetType

`func (o *PlatformCreate) GetType() int32`

GetType returns the Type field if non-nil, zero value otherwise.

### GetTypeOk

`func (o *PlatformCreate) GetTypeOk() (*int32, bool)`

GetTypeOk returns a tuple with the Type field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetType

`func (o *PlatformCreate) SetType(v int32)`

SetType sets Type field to given value.

### HasType

`func (o *PlatformCreate) HasType() bool`

HasType returns a boolean if a field has been set.

### SetTypeNil

`func (o *PlatformCreate) SetTypeNil(b bool)`

 SetTypeNil sets the value for Type to be an explicit nil

### UnsetType
`func (o *PlatformCreate) UnsetType()`

UnsetType ensures that no value is present for Type, not even an explicit nil
### GetStatus

`func (o *PlatformCreate) GetStatus() int32`

GetStatus returns the Status field if non-nil, zero value otherwise.

### GetStatusOk

`func (o *PlatformCreate) GetStatusOk() (*int32, bool)`

GetStatusOk returns a tuple with the Status field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStatus

`func (o *PlatformCreate) SetStatus(v int32)`

SetStatus sets Status field to given value.

### HasStatus

`func (o *PlatformCreate) HasStatus() bool`

HasStatus returns a boolean if a field has been set.

### GetSort

`func (o *PlatformCreate) GetSort() int32`

GetSort returns the Sort field if non-nil, zero value otherwise.

### GetSortOk

`func (o *PlatformCreate) GetSortOk() (*int32, bool)`

GetSortOk returns a tuple with the Sort field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSort

`func (o *PlatformCreate) SetSort(v int32)`

SetSort sets Sort field to given value.

### HasSort

`func (o *PlatformCreate) HasSort() bool`

HasSort returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


