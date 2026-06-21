
# GeminiChatRequest

Direct Gemini API request model.

## Properties

Name | Type
------------ | -------------
`contents` | [Array&lt;ChatMessage&gt;](ChatMessage.md)
`model` | string
`temperature` | number
`maxTokens` | number
`systemInstruction` | string

## Example

```typescript
import type { GeminiChatRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "contents": null,
  "model": null,
  "temperature": null,
  "maxTokens": null,
  "systemInstruction": null,
} satisfies GeminiChatRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GeminiChatRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


