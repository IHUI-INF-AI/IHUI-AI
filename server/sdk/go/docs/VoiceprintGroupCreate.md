# VoiceprintGroupCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | **string** | 声纹组名称 | 
**Desc** | Pointer to **NullableString** | 声纹组描述 | [optional] 

## Methods

### NewVoiceprintGroupCreate

`func NewVoiceprintGroupCreate(name string, ) *VoiceprintGroupCreate`

NewVoiceprintGroupCreate instantiates a new VoiceprintGroupCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVoiceprintGroupCreateWithDefaults

`func NewVoiceprintGroupCreateWithDefaults() *VoiceprintGroupCreate`

NewVoiceprintGroupCreateWithDefaults instantiates a new VoiceprintGroupCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *VoiceprintGroupCreate) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *VoiceprintGroupCreate) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *VoiceprintGroupCreate) SetName(v string)`

SetName sets Name field to given value.


### GetDesc

`func (o *VoiceprintGroupCreate) GetDesc() string`

GetDesc returns the Desc field if non-nil, zero value otherwise.

### GetDescOk

`func (o *VoiceprintGroupCreate) GetDescOk() (*string, bool)`

GetDescOk returns a tuple with the Desc field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDesc

`func (o *VoiceprintGroupCreate) SetDesc(v string)`

SetDesc sets Desc field to given value.

### HasDesc

`func (o *VoiceprintGroupCreate) HasDesc() bool`

HasDesc returns a boolean if a field has been set.

### SetDescNil

`func (o *VoiceprintGroupCreate) SetDescNil(b bool)`

 SetDescNil sets the value for Desc to be an explicit nil

### UnsetDesc
`func (o *VoiceprintGroupCreate) UnsetDesc()`

UnsetDesc ensures that no value is present for Desc, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


