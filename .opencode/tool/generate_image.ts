import { tool } from "@opencode-ai/plugin"

export default tool({
  name: "generate_image",
  description: "Generate an AI image for use in the app. Use this instead of placeholder URLs from sites like picsum.photos, unsplash, or via.placeholder.com. This will create a real AI-generated image stored in project storage. IMPORTANT RESTRICTIONS: It is FORBIDDEN and PROHIBITED to generate human faces, people, or anything haram (alcohol, pork, gambling, inappropriate content, nudity, violence). For apps needing user avatars or people, use abstract icons, silhouettes, or geometric shapes instead.",
  args: {
    prompt: tool.schema.string().describe("Detailed description of the image to generate. Be specific about style, colors, subject, and composition. NEVER include human faces or people - use abstract shapes, icons, objects, landscapes, or silhouettes instead."),
    style: tool.schema.enum(["realistic", "illustration", "3d", "cartoon"]).optional().describe("Optional style preset: realistic (photo-like), illustration (digital art), 3d (rendered), cartoon (fun style)"),
    size: tool.schema.enum(["512x512", "1024x1024", "1024x1792", "1792x1024"]).default("1024x1024").describe("Image dimensions. Use 1024x1792 for portrait, 1792x1024 for landscape.")
  },
  async execute(args) {
    const response = await fetch("https://launchpulse.ai/api/project/project-build-a-production-ready-w/ai/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: args.prompt,
        style: args.style,
        size: args.size,
        token: "lp_projectb_b36f58290b11437d"
      })
    });
    const result = await response.json();
    if (result.success) {
      return JSON.stringify({
        success: true,
        imageUrl: result.imageUrl,
        message: "Image generated successfully. Use this URL in your code: " + result.imageUrl
      }, null, 2);
    } else {
      return JSON.stringify({
        success: false,
        error: result.error || "Image generation failed"
      }, null, 2);
    }
  }
});

