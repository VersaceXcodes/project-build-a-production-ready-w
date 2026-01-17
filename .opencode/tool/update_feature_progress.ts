import { tool } from "@opencode-ai/plugin"

export default tool({
  name: "update_feature_progress",
  description: "After completing a feature implementation and updating feature_list.json with passes: true, call this to update the UI in real-time. The user will see immediate progress instead of waiting until the entire build is complete.",
  parameters: {
    featureId: tool.schema.string().describe("The feature ID that was completed (from feature_list.json)"),
    message: tool.schema.string().optional().describe("Optional status message to display to the user")
  },
  execute: async ({ featureId, message }) => {
    const response = await fetch("https://launchpulse.ai/api/project/project-build-a-production-ready-w/features/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-build-a-production-ready-w",
        token: "lp_projectb_b36f58290b11437d",
        featureId: featureId,
        passes: true,
        message: message || "Feature completed"
      })
    });
    const result = await response.json();
    if (result.success) {
      return JSON.stringify({
        success: true,
        completedCount: result.completedCount,
        totalCount: result.totalCount,
        message: "Progress update sent to UI"
      }, null, 2);
    } else {
      return JSON.stringify({
        success: false,
        error: result.error || "Failed to update progress"
      }, null, 2);
    }
  }
});

