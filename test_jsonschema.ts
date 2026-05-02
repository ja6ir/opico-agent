import { tool, jsonSchema } from "ai";
import { ReadFileTool } from "./src/tools/ReadFileTool";

async function main() {
  const t = new ReadFileTool();
  
  // What happens if we use jsonSchema?
  const schemaObj = (t.schema as any).toJSONSchema();
  // remove $schema to make it standard
  delete schemaObj.$schema;

  const aiTool = tool({
    description: t.description,
    parameters: jsonSchema(schemaObj),
    execute: async () => "ok"
  });

  console.log("parameters object:", aiTool.parameters);
}
main().catch(console.error);
