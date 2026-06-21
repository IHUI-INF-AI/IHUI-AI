# ImageToVideoBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ModelName** | Pointer to **string** |  | [optional] [default to "kling-v1"]
**Image** | **string** | Image URL or base64 | 
**Prompt** | Pointer to **NullableString** |  | [optional] 
**NegativePrompt** | Pointer to **NullableString** |  | [optional] 
**Duration** | Pointer to **string** |  | [optional] [default to "5"]
**Mode** | Pointer to **string** |  | [optional] [default to "std"]
**CfgScale** | Pointer to **float32** |  | [optional] [default to 0.5]

## Methods

### NewImageToVideoBody

`func NewImageToVideoBody(image string, ) *ImageToVideoBody`

NewImageToVideoBody instantiates a new ImageToVideoBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewImageToVideoBodyWithDefaults

`func NewImageToVideoBodyWithDefaults() *ImageToVideoBody`

NewImageToVideoBodyWithDefaults instantiates a new ImageToVideoBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetModelName

`func (o *ImageToVideoBody) GetModelName() string`

GetModelName returns the ModelName field if non-nil, zero value otherwise.

### GetModelNameOk

`func (o *ImageToVideoBody) GetModelNameOk() (*string, bool)`

GetModelNameOk returns a tuple with the ModelName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModelName

`func (o *ImageToVideoBody) SetModelName(v string)`

SetModelName sets ModelName field to given value.

### HasModelName

`func (o *ImageToVideoBody) HasModelName() bool`

HasModelName returns a boolean if a field has been set.

### GetImage

`func (o *ImageToVideoBody) GetImage() string`

GetImage returns the Image field if non-nil, zero value otherwise.

### GetImageOk

`func (o *ImageToVideoBody) GetImageOk() (*string, bool)`

GetImageOk returns a tuple with the Image field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImage

`func (o *ImageToVideoBody) SetImage(v string)`

SetImage sets Image field to given value.


### GetPrompt

`func (o *ImageToVideoBody) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *ImageToVideoBody) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *ImageToVideoBody) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.

### HasPrompt

`func (o *ImageToVideoBody) HasPrompt() bool`

HasPrompt returns a boolean if a field has been set.

### SetPromptNil

`func (o *ImageToVideoBody) SetPromptNil(b bool)`

 SetPromptNil sets the value for Prompt to be an explicit nil

### UnsetPrompt
`func (o *ImageToVideoBody) UnsetPrompt()`

UnsetPrompt ensures that no value is present for Prompt, not even an explicit nil
### GetNegativePrompt

`func (o *ImageToVideoBody) GetNegativePrompt() string`

GetNegativePrompt returns the NegativePrompt field if non-nil, zero value otherwise.

### GetNegativePromptOk

`func (o *ImageToVideoBody) GetNegativePromptOk() (*string, bool)`

GetNegativePromptOk returns a tuple with the NegativePrompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNegativePrompt

`func (o *ImageToVideoBody) SetNegativePrompt(v string)`

SetNegativePrompt sets NegativePrompt field to given value.

### HasNegativePrompt

`func (o *ImageToVideoBody) HasNegativePrompt() bool`

HasNegativePrompt returns a boolean if a field has been set.

### SetNegativePromptNil

`func (o *ImageToVideoBody) SetNegativePromptNil(b bool)`

 SetNegativePromptNil sets the value for NegativePrompt to be an explicit nil

### UnsetNegativePrompt
`func (o *ImageToVideoBody) UnsetNegativePrompt()`

UnsetNegativePrompt ensures that no value is present for NegativePrompt, not even an explicit nil
### GetDuration

`func (o *ImageToVideoBody) GetDuration() string`

GetDuration returns the Duration field if non-nil, zero value otherwise.

### GetDurationOk

`func (o *ImageToVideoBody) GetDurationOk() (*string, bool)`

GetDurationOk returns a tuple with the Duration field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDuration

`func (o *ImageToVideoBody) SetDuration(v string)`

SetDuration sets Duration field to given value.

### HasDuration

`func (o *ImageToVideoBody) HasDuration() bool`

HasDuration returns a boolean if a field has been set.

### GetMode

`func (o *ImageToVideoBody) GetMode() string`

GetMode returns the Mode field if non-nil, zero value otherwise.

### GetModeOk

`func (o *ImageToVideoBody) GetModeOk() (*string, bool)`

GetModeOk returns a tuple with the Mode field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMode

`func (o *ImageToVideoBody) SetMode(v string)`

SetMode sets Mode field to given value.

### HasMode

`func (o *ImageToVideoBody) HasMode() bool`

HasMode returns a boolean if a field has been set.

### GetCfgScale

`func (o *ImageToVideoBody) GetCfgScale() float32`

GetCfgScale returns the CfgScale field if non-nil, zero value otherwise.

### GetCfgScaleOk

`func (o *ImageToVideoBody) GetCfgScaleOk() (*float32, bool)`

GetCfgScaleOk returns a tuple with the CfgScale field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCfgScale

`func (o *ImageToVideoBody) SetCfgScale(v float32)`

SetCfgScale sets CfgScale field to given value.

### HasCfgScale

`func (o *ImageToVideoBody) HasCfgScale() bool`

HasCfgScale returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


