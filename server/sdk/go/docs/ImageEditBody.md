# ImageEditBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**BaseImageUrl** | **string** | URL of the base image to edit | 
**MaskImageUrl** | Pointer to **NullableString** | URL of the mask image (white &#x3D; area to edit) | [optional] 
**Prompt** | **string** | Editing instruction | 
**Model** | Pointer to **string** | Model name, e.g. wanx-v1, wanx2.1-image-edit | [optional] [default to "wanx-v1"]

## Methods

### NewImageEditBody

`func NewImageEditBody(baseImageUrl string, prompt string, ) *ImageEditBody`

NewImageEditBody instantiates a new ImageEditBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewImageEditBodyWithDefaults

`func NewImageEditBodyWithDefaults() *ImageEditBody`

NewImageEditBodyWithDefaults instantiates a new ImageEditBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetBaseImageUrl

`func (o *ImageEditBody) GetBaseImageUrl() string`

GetBaseImageUrl returns the BaseImageUrl field if non-nil, zero value otherwise.

### GetBaseImageUrlOk

`func (o *ImageEditBody) GetBaseImageUrlOk() (*string, bool)`

GetBaseImageUrlOk returns a tuple with the BaseImageUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBaseImageUrl

`func (o *ImageEditBody) SetBaseImageUrl(v string)`

SetBaseImageUrl sets BaseImageUrl field to given value.


### GetMaskImageUrl

`func (o *ImageEditBody) GetMaskImageUrl() string`

GetMaskImageUrl returns the MaskImageUrl field if non-nil, zero value otherwise.

### GetMaskImageUrlOk

`func (o *ImageEditBody) GetMaskImageUrlOk() (*string, bool)`

GetMaskImageUrlOk returns a tuple with the MaskImageUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaskImageUrl

`func (o *ImageEditBody) SetMaskImageUrl(v string)`

SetMaskImageUrl sets MaskImageUrl field to given value.

### HasMaskImageUrl

`func (o *ImageEditBody) HasMaskImageUrl() bool`

HasMaskImageUrl returns a boolean if a field has been set.

### SetMaskImageUrlNil

`func (o *ImageEditBody) SetMaskImageUrlNil(b bool)`

 SetMaskImageUrlNil sets the value for MaskImageUrl to be an explicit nil

### UnsetMaskImageUrl
`func (o *ImageEditBody) UnsetMaskImageUrl()`

UnsetMaskImageUrl ensures that no value is present for MaskImageUrl, not even an explicit nil
### GetPrompt

`func (o *ImageEditBody) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *ImageEditBody) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *ImageEditBody) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetModel

`func (o *ImageEditBody) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *ImageEditBody) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *ImageEditBody) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *ImageEditBody) HasModel() bool`

HasModel returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


