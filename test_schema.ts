import { ReadFileTool } from "./src/tools/ReadFileTool";
import { z } from "zod";
import { tool } from "ai";

async function main() {
  const t = new ReadFileTool();
  
  const aiTool = tool({
    description: t.description,
    parameters: t.schema,
    execute: async () => "ok"
  });

  // the ai tool has a parameters property, let's see if we can get the json schema
  console.log("parameters object keys:", Object.keys(aiTool.parameters));
  
  if (typeof aiTool.parameters.toJSONSchema === "function") {
    console.log("toJSONSchema result:", JSON.stringify(aiTool.parameters.toJSONSchema(), null, 2));
  }
}
main().catch(console.error);
