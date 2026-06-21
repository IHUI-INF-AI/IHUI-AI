# PlatformUpdate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | Pointer to **NullableString** |  | [optional] 
**Domain** | Pointer to **NullableString** |  | [optional] 
**Remark** | Pointer to **NullableString** |  | [optional] 
**Binding** | Pointer to **NullableString** |  | [optional] 
**FilePath** | Pointer to **NullableString** |  | [optional] 
**Type** | Pointer to **NullableInt32** |  | [optional] 
**Status** | Pointer to **NullableInt32** |  | [optional] 
**Sort** | Pointer to **NullableInt32** |  | [optional] 

## Methods

### NewPlatformUpdate

`func NewPlatformUpdate() *PlatformUpdate`

NewPlatformUpdate instantiates a new PlatformUpdate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPlatformUpdateWithDefaults

`func NewPlatformUpdateWithDefaults() *PlatformUpdate`

NewPlatformUpdateWithDefaults instantiates a new PlatformUpdate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *PlatformUpdate) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *PlatformUpdate) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *PlatformUpdate) SetName(v string)`

SetName sets Name field to given value.

### HasName

`func (o *PlatformUpdate) HasName() bool`

HasName returns a boolean if a field has been set.

### SetNameNil

`func (o *PlatformUpdate) SetNameNil(b bool)`

 SetNameNil sets the value for Name to be an explicit nil

### UnsetName
`func (o *PlatformUpdate) UnsetName()`

UnsetName ensures that no value is present for Name, not even an explicit nil
### GetDomain

`func (o *PlatformUpdate) GetDomain() string`

GetDomain returns the Domain field if non-nil, zero value otherwise.

### GetDomainOk

`func (o *PlatformUpdate) GetDomainOk() (*string, bool)`

GetDomainOk returns a tuple with the Domain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDomain

`func (o *PlatformUpdate) SetDomain(v string)`

SetDomain sets Domain field to given value.

### HasDomain

`func (o *PlatformUpdate) HasDomain() bool`

HasDomain returns a boolean if a field has been set.

### SetDomainNil

`func (o *PlatformUpdate) SetDomainNil(b bool)`

 SetDomainNil sets the value for Domain to be an explicit nil

### UnsetDomain
`func (o *PlatformUpdate) UnsetDomain()`

UnsetDomain ensures that no value is present for Domain, not even an explicit nil
### GetRemark

`func (o *PlatformUpdate) GetRemark() string`

GetRemark returns the Remark field if non-nil, zero value otherwise.

### GetRemarkOk

`func (o *PlatformUpdate) GetRemarkOk() (*string, bool)`

GetRemarkOk returns a tuple with the Remark field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRemark

`func (o *PlatformUpdate) SetRemark(v string)`

SetRemark sets Remark field to given value.

### HasRemark

`func (o *PlatformUpdate) HasRemark() bool`

HasRemark returns a boolean if a field has been set.

### SetRemarkNil

`func (o *PlatformUpdate) SetRemarkNil(b bool)`

 SetRemarkNil sets the value for Remark to be an explicit nil

### UnsetRemark
`func (o *PlatformUpdate) UnsetRemark()`

UnsetRemark ensures that no value is present for Remark, not even an explicit nil
### GetBinding

`func (o *PlatformUpdate) GetBinding() string`

GetBinding returns the Binding field if non-nil, zero value otherwise.

### GetBindingOk

`func (o *PlatformUpdate) GetBindingOk() (*string, bool)`

GetBindingOk returns a tuple with the Binding field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBinding

`func (o *PlatformUpdate) SetBinding(v string)`

SetBinding sets Binding field to given value.

### HasBinding

`func (o *PlatformUpdate) HasBinding() bool`

HasBinding returns a boolean if a field has been set.

### SetBindingNil

`func (o *PlatformUpdate) SetBindingNil(b bool)`

 SetBindingNil sets the value for Binding to be an explicit nil

### UnsetBinding
`func (o *PlatformUpdate) UnsetBinding()`

UnsetBinding ensures that no value is present for Binding, not even an explicit nil
### GetFilePath

`func (o *PlatformUpdate) GetFilePath() string`

GetFilePath returns the FilePath field if non-nil, zero value otherwise.

### GetFilePathOk

`func (o *PlatformUpdate) GetFilePathOk() (*string, bool)`

GetFilePathOk returns a tuple with the FilePath field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFilePath

`func (o *PlatformUpdate) SetFilePath(v string)`

SetFilePath sets FilePath field to given value.

### HasFilePath

`func (o *PlatformUpdate) HasFilePath() bool`

HasFilePath returns a boolean if a field has been set.

### SetFilePathNil

`func (o *PlatformUpdate) SetFilePathNil(b bool)`

 SetFilePathNil sets the value for FilePath to be an explicit nil

### UnsetFilePath
`func (o *PlatformUpdate) UnsetFilePath()`

UnsetFilePath ensures that no value is present for FilePath, not even an explicit nil
### GetType

`func (o *PlatformUpdate) GetType() int32`

GetType returns the Type field if non-nil, zero value otherwise.

### GetTypeOk

`func (o *PlatformUpdate) GetTypeOk() (*int32, bool)`

GetTypeOk returns a tuple with the Type field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetType

`func (o *PlatformUpdate) SetType(v int32)`

SetType sets Type field to given value.

### HasType

`func (o *PlatformUpdate) HasType() bool`

HasType returns a boolean if a field has been set.

### SetTypeNil

`func (o *PlatformUpdate) SetTypeNil(b bool)`

 SetTypeNil sets the value for Type to be an explicit nil

### UnsetType
`func (o *PlatformUpdate) UnsetType()`

UnsetType ensures that no value is present for Type, not even an explicit nil
### GetStatus

`func (o *PlatformUpdate) GetStatus() int32`

GetStatus returns the Status field if non-nil, zero value otherwise.

### GetStatusOk

`func (o *PlatformUpdate) GetStatusOk() (*int32, bool)`

GetStatusOk returns a tuple with the Status field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStatus

`func (o *PlatformUpdate) SetStatus(v int32)`

SetStatus sets Status field to given value.

### HasStatus

`func (o *PlatformUpdate) HasStatus() bool`

HasStatus returns a boolean if a field has been set.

### SetStatusNil

`func (o *PlatformUpdate) SetStatusNil(b bool)`

 SetStatusNil sets the value for Status to be an explicit nil

### UnsetStatus
`func (o *PlatformUpdate) UnsetStatus()`

UnsetStatus ensures that no value is present for Status, not even an explicit nil
### GetSort

`func (o *PlatformUpdate) GetSort() int32`

GetSort returns the Sort field if non-nil, zero value otherwise.

### GetSortOk

`func (o *PlatformUpdate) GetSortOk() (*int32, bool)`

GetSortOk returns a tuple with the Sort field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSort

`func (o *PlatformUpdate) SetSort(v int32)`

SetSort sets Sort field to given value.

### HasSort

`func (o *PlatformUpdate) HasSort() bool`

HasSort returns a boolean if a field has been set.

### SetSortNil

`func (o *PlatformUpdate) SetSortNil(b bool)`

 SetSortNil sets the value for Sort to be an explicit nil

### UnsetSort
`func (o *PlatformUpdate) UnsetSort()`

UnsetSort ensures that no value is present for Sort, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


