import { streamText, tool, CoreMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

async function main() {
  const messages: CoreMessage[] = [{ role: "user", content: "What is 2+2? Use the calc tool." }];
  const result = streamText({
    model: createOpenAI({ apiKey: "dummy" }).chat("gpt-4o"),
    messages,
    tools: {
      calc: tool({
        description: "calculate",
        parameters: z.object({ expression: z.string() }),
        execute: async () => "4",
      }),
    },
    maxSteps: 5,
  });

  console.log("Keys on result:", Object.keys(result));
  
  // Try to access the response messages
  if ('response' in result) {
    // @ts-ignore
    console.log("Keys on result.response:", Object.keys(await result.response));
  }
}
main().catch(console.error);
