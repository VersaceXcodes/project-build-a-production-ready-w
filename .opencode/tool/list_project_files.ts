import { tool } from "@opencode-ai/plugin"

export default tool({
  name: "list_project_files",
  description: "List all files in project storage. Returns array of file metadata including filename, size, content_type, and public URL if applicable. Use this to see what files have been uploaded.",
  parameters: {},
  execute: async () => {
    const response = await fetch("https://launchpulse.ai/api/storage/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-build-a-production-ready-w",
        token: "lp_projectb_b36f58290b11437d",
        path: "list",
        params: {}
      })
    });
    const result = await response.json();
    return JSON.stringify(result, null, 2);
  }
});

