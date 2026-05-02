import { z } from "zod";
import { tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const testSchema = z.object({
  path: z.string().describe("test string"),
  age: z.number().describe("test number")
});

const t = tool({
  description: "test",
  parameters: testSchema,
  execute: async () => "ok"
});

const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  console.log("MOCK FETCH PAYLOAD:");
  console.log(init?.body);
  return new Response(JSON.stringify({
    id: "chatcmpl-123",
    object: "chat.completion",
    created: 1677652288,
    model: "gpt-4o",
    choices: [{
      index: 0,
      message: { role: "assistant", content: "Hello there" },
      finish_reason: "stop"
    }]
  }));
};

const provider = createOpenAI({ apiKey: "test", fetch: mockFetch });
const chatModel = provider.chat("gpt-4o");

async function test() {
  try {
    await (chatModel as any).doGenerate({
      inputFormat: "messages",
      mode: {
        type: "regular",
        tools: [{
          type: "function",
          name: "test_tool",
          description: "test",
          parameters: t.parameters
        }],
        toolChoice: { type: "auto" }
      },
      prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }]
    });
  } catch (err) {
    console.error("doGenerate error:", err);
  }
}
test();
