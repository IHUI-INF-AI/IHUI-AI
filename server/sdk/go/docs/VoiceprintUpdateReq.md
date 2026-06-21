# VoiceprintUpdateReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**VoiceprintId** | **string** |  | 
**Name** | Pointer to **NullableString** |  | [optional] 
**Description** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewVoiceprintUpdateReq

`func NewVoiceprintUpdateReq(voiceprintId string, ) *VoiceprintUpdateReq`

NewVoiceprintUpdateReq instantiates a new VoiceprintUpdateReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVoiceprintUpdateReqWithDefaults

`func NewVoiceprintUpdateReqWithDefaults() *VoiceprintUpdateReq`

NewVoiceprintUpdateReqWithDefaults instantiates a new VoiceprintUpdateReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetVoiceprintId

`func (o *VoiceprintUpdateReq) GetVoiceprintId() string`

GetVoiceprintId returns the VoiceprintId field if non-nil, zero value otherwise.

### GetVoiceprintIdOk

`func (o *VoiceprintUpdateReq) GetVoiceprintIdOk() (*string, bool)`

GetVoiceprintIdOk returns a tuple with the VoiceprintId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVoiceprintId

`func (o *VoiceprintUpdateReq) SetVoiceprintId(v string)`

SetVoiceprintId sets VoiceprintId field to given value.


### GetName

`func (o *VoiceprintUpdateReq) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *VoiceprintUpdateReq) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *VoiceprintUpdateReq) SetName(v string)`

SetName sets Name field to given value.

### HasName

`func (o *VoiceprintUpdateReq) HasName() bool`

HasName returns a boolean if a field has been set.

### SetNameNil

`func (o *VoiceprintUpdateReq) SetNameNil(b bool)`

 SetNameNil sets the value for Name to be an explicit nil

### UnsetName
`func (o *VoiceprintUpdateReq) UnsetName()`

UnsetName ensures that no value is present for Name, not even an explicit nil
### GetDescription

`func (o *VoiceprintUpdateReq) GetDescription() string`

GetDescription returns the Description field if non-nil, zero value otherwise.

### GetDescriptionOk

`func (o *VoiceprintUpdateReq) GetDescriptionOk() (*string, bool)`

GetDescriptionOk returns a tuple with the Description field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDescription

`func (o *VoiceprintUpdateReq) SetDescription(v string)`

SetDescription sets Description field to given value.

### HasDescription

`func (o *VoiceprintUpdateReq) HasDescription() bool`

HasDescription returns a boolean if a field has been set.

### SetDescriptionNil

`func (o *VoiceprintUpdateReq) SetDescriptionNil(b bool)`

 SetDescriptionNil sets the value for Description to be an explicit nil

### UnsetDescription
`func (o *VoiceprintUpdateReq) UnsetDescription()`

UnsetDescription ensures that no value is present for Description, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


