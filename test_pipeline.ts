import { createOpenAI } from "@ai-sdk/openai";
import { generateText, tool, zodSchema } from "ai";
import { z } from "zod";

async function main() {
  const customSchema = z.object({
    path: z.string().describe("path string"),
    line: z.number().describe("line num")
  });

  const schema = zodSchema(customSchema);
  console.log("zodSchema is:", JSON.stringify(schema, null, 2));

  const aiTool = tool({
    description: "test tool",
    parameters: schema, 
    execute: async () => "ok"
  });
  
  const tools = { read_file: aiTool };

  // Let's see if we can trigger the api call to see the exact payload sent
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

  const provider = createOpenAI({ apiKey: "test", fetch: mockFetch, compatibility: 'compatible' });
  
  await generateText({
    model: provider.chat("gpt-4o"),
    messages: [{ role: "user", content: "Hi" }],
    tools
  });
}
main().catch(console.error);
