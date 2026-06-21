# AppApiV1ChatKlingImageGenerateBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** |  | 
**ModelName** | Pointer to **string** |  | [optional] [default to "kling-v1"]
**N** | Pointer to **int32** |  | [optional] [default to 1]
**AspectRatio** | Pointer to **string** |  | [optional] [default to "1:1"]
**NegativePrompt** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewAppApiV1ChatKlingImageGenerateBody

`func NewAppApiV1ChatKlingImageGenerateBody(prompt string, ) *AppApiV1ChatKlingImageGenerateBody`

NewAppApiV1ChatKlingImageGenerateBody instantiates a new AppApiV1ChatKlingImageGenerateBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewAppApiV1ChatKlingImageGenerateBodyWithDefaults

`func NewAppApiV1ChatKlingImageGenerateBodyWithDefaults() *AppApiV1ChatKlingImageGenerateBody`

NewAppApiV1ChatKlingImageGenerateBodyWithDefaults instantiates a new AppApiV1ChatKlingImageGenerateBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *AppApiV1ChatKlingImageGenerateBody) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *AppApiV1ChatKlingImageGenerateBody) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *AppApiV1ChatKlingImageGenerateBody) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetModelName

`func (o *AppApiV1ChatKlingImageGenerateBody) GetModelName() string`

GetModelName returns the ModelName field if non-nil, zero value otherwise.

### GetModelNameOk

`func (o *AppApiV1ChatKlingImageGenerateBody) GetModelNameOk() (*string, bool)`

GetModelNameOk returns a tuple with the ModelName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModelName

`func (o *AppApiV1ChatKlingImageGenerateBody) SetModelName(v string)`

SetModelName sets ModelName field to given value.

### HasModelName

`func (o *AppApiV1ChatKlingImageGenerateBody) HasModelName() bool`

HasModelName returns a boolean if a field has been set.

### GetN

`func (o *AppApiV1ChatKlingImageGenerateBody) GetN() int32`

GetN returns the N field if non-nil, zero value otherwise.

### GetNOk

`func (o *AppApiV1ChatKlingImageGenerateBody) GetNOk() (*int32, bool)`

GetNOk returns a tuple with the N field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetN

`func (o *AppApiV1ChatKlingImageGenerateBody) SetN(v int32)`

SetN sets N field to given value.

### HasN

`func (o *AppApiV1ChatKlingImageGenerateBody) HasN() bool`

HasN returns a boolean if a field has been set.

### GetAspectRatio

`func (o *AppApiV1ChatKlingImageGenerateBody) GetAspectRatio() string`

GetAspectRatio returns the AspectRatio field if non-nil, zero value otherwise.

### GetAspectRatioOk

`func (o *AppApiV1ChatKlingImageGenerateBody) GetAspectRatioOk() (*string, bool)`

GetAspectRatioOk returns a tuple with the AspectRatio field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAspectRatio

`func (o *AppApiV1ChatKlingImageGenerateBody) SetAspectRatio(v string)`

SetAspectRatio sets AspectRatio field to given value.

### HasAspectRatio

`func (o *AppApiV1ChatKlingImageGenerateBody) HasAspectRatio() bool`

HasAspectRatio returns a boolean if a field has been set.

### GetNegativePrompt

`func (o *AppApiV1ChatKlingImageGenerateBody) GetNegativePrompt() string`

GetNegativePrompt returns the NegativePrompt field if non-nil, zero value otherwise.

### GetNegativePromptOk

`func (o *AppApiV1ChatKlingImageGenerateBody) GetNegativePromptOk() (*string, bool)`

GetNegativePromptOk returns a tuple with the NegativePrompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNegativePrompt

`func (o *AppApiV1ChatKlingImageGenerateBody) SetNegativePrompt(v string)`

SetNegativePrompt sets NegativePrompt field to given value.

### HasNegativePrompt

`func (o *AppApiV1ChatKlingImageGenerateBody) HasNegativePrompt() bool`

HasNegativePrompt returns a boolean if a field has been set.

### SetNegativePromptNil

`func (o *AppApiV1ChatKlingImageGenerateBody) SetNegativePromptNil(b bool)`

 SetNegativePromptNil sets the value for NegativePrompt to be an explicit nil

### UnsetNegativePrompt
`func (o *AppApiV1ChatKlingImageGenerateBody) UnsetNegativePrompt()`

UnsetNegativePrompt ensures that no value is present for NegativePrompt, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


