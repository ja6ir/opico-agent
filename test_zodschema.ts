import { zodSchema, tool } from 'ai';
import { z } from 'zod';
import { ReadFileTool } from './src/tools/ReadFileTool';

async function main() {
  const t = new ReadFileTool();
  
  // Test 1: Vercel AI SDK's zodSchema
  try {
    const aiSchema = zodSchema(t.schema);
    console.log("zodSchema output:", JSON.stringify(aiSchema, null, 2));
  } catch(e) {
    console.log("zodSchema error:", e);
  }

  // Test 2: The tool parameters
  const aiTool = tool({
    description: t.description,
    parameters: zodSchema(t.schema),
    execute: async () => "ok"
  });

  console.log("\nparameters object keys:", Object.keys(aiTool.parameters));
  if (typeof aiTool.parameters.toJSONSchema === 'function') {
    console.log("toJSONSchema result:", JSON.stringify(aiTool.parameters.toJSONSchema(), null, 2));
  } else if (aiTool.parameters.jsonSchema) {
    console.log("jsonSchema result:", JSON.stringify(aiTool.parameters.jsonSchema, null, 2));
  }
}
main().catch(console.error);
