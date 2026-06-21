
# FeedbackReq


## Properties

Name | Type
------------ | -------------
`messageId` | string
`conversationId` | string
`feedbackType` | string
`content` | string

## Example

```typescript
import type { FeedbackReq } from ''

// TODO: Update the object below with actual values
const example = {
  "messageId": null,
  "conversationId": null,
  "feedbackType": null,
  "content": null,
} satisfies FeedbackReq

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FeedbackReq
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


