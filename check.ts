import { streamText } from 'ai';
// dummy to check TS errors
streamText({
  model: {} as any,
  messages: [],
  onStepFinish: (event) => {
    // we want to see what keys exist on event
    const keys: Array<keyof typeof event> = ['text', 'toolCalls', 'toolResults', 'finishReason', 'usage', 'request', 'response'];
  }
});
