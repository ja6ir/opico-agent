import { streamText, tool, CoreMessage } from "ai";
import { z } from "zod";

async function main() {
  const messages: CoreMessage[] = [{ role: "user", content: "Use calc." }];
  const mockModel = {
    specificationVersion: "v1",
    provider: "mock",
    modelId: "mock",
    defaultObjectGenerationMode: "json",
    async doStream(options) {
      // Return a mocked stream that just outputs some text
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'text-delta', textDelta: 'hello' });
          controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 10 } });
          controller.close();
        }
      });
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
    },
    async doGenerate(options) {
      return {
        text: 'hello',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 10 },
        rawCall: { rawPrompt: null, rawSettings: {} }
      };
    }
  };

  const result = streamText({
    // @ts-ignore
    model: mockModel,
    messages,
    maxSteps: 2,
  });

  const res = await result.response;
  console.log("Keys in res:", Object.keys(res));
  console.log("has messages array:", Array.isArray(res.messages));
}
main();
