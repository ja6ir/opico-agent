import { ToolRegistry } from "./src/tools/ToolRegistry";
import { ReadFileTool } from "./src/tools/ReadFileTool";

function main() {
  const tool = new ReadFileTool();
  console.log("Tool schema:", tool.schema);
  console.log("Is undefined?", tool.schema === undefined);
  
  const registry = new ToolRegistry([tool]);
  const tools = registry.getTools();
  console.log("ToolRegistry tools:", Object.keys(tools));
}
main();
