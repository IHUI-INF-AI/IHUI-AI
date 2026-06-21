# BodyTextToImageApiV1TongyiImageEditTextToImagePost

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Model** | Pointer to **string** |  | [optional] [default to "qwen-image"]
**Prompt** | **string** |  | 
**NegativePrompt** | Pointer to **NullableString** |  | [optional] 
**Size** | Pointer to **string** |  | [optional] [default to "1024*1024"]
**N** | Pointer to **int32** |  | [optional] [default to 1]
**Style** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewBodyTextToImageApiV1TongyiImageEditTextToImagePost

`func NewBodyTextToImageApiV1TongyiImageEditTextToImagePost(prompt string, ) *BodyTextToImageApiV1TongyiImageEditTextToImagePost`

NewBodyTextToImageApiV1TongyiImageEditTextToImagePost instantiates a new BodyTextToImageApiV1TongyiImageEditTextToImagePost object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBodyTextToImageApiV1TongyiImageEditTextToImagePostWithDefaults

`func NewBodyTextToImageApiV1TongyiImageEditTextToImagePostWithDefaults() *BodyTextToImageApiV1TongyiImageEditTextToImagePost`

NewBodyTextToImageApiV1TongyiImageEditTextToImagePostWithDefaults instantiates a new BodyTextToImageApiV1TongyiImageEditTextToImagePost object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetModel

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetPrompt

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetNegativePrompt

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetNegativePrompt() string`

GetNegativePrompt returns the NegativePrompt field if non-nil, zero value otherwise.

### GetNegativePromptOk

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetNegativePromptOk() (*string, bool)`

GetNegativePromptOk returns a tuple with the NegativePrompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNegativePrompt

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) SetNegativePrompt(v string)`

SetNegativePrompt sets NegativePrompt field to given value.

### HasNegativePrompt

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) HasNegativePrompt() bool`

HasNegativePrompt returns a boolean if a field has been set.

### SetNegativePromptNil

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) SetNegativePromptNil(b bool)`

 SetNegativePromptNil sets the value for NegativePrompt to be an explicit nil

### UnsetNegativePrompt
`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) UnsetNegativePrompt()`

UnsetNegativePrompt ensures that no value is present for NegativePrompt, not even an explicit nil
### GetSize

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetSize() string`

GetSize returns the Size field if non-nil, zero value otherwise.

### GetSizeOk

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetSizeOk() (*string, bool)`

GetSizeOk returns a tuple with the Size field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSize

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) SetSize(v string)`

SetSize sets Size field to given value.

### HasSize

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) HasSize() bool`

HasSize returns a boolean if a field has been set.

### GetN

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetN() int32`

GetN returns the N field if non-nil, zero value otherwise.

### GetNOk

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetNOk() (*int32, bool)`

GetNOk returns a tuple with the N field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetN

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) SetN(v int32)`

SetN sets N field to given value.

### HasN

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) HasN() bool`

HasN returns a boolean if a field has been set.

### GetStyle

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetStyle() string`

GetStyle returns the Style field if non-nil, zero value otherwise.

### GetStyleOk

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) GetStyleOk() (*string, bool)`

GetStyleOk returns a tuple with the Style field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStyle

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) SetStyle(v string)`

SetStyle sets Style field to given value.

### HasStyle

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) HasStyle() bool`

HasStyle returns a boolean if a field has been set.

### SetStyleNil

`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) SetStyleNil(b bool)`

 SetStyleNil sets the value for Style to be an explicit nil

### UnsetStyle
`func (o *BodyTextToImageApiV1TongyiImageEditTextToImagePost) UnsetStyle()`

UnsetStyle ensures that no value is present for Style, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


