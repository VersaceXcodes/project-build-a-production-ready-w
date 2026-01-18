
import { v4 as uuidv4 } from 'uuid';

// Hardcoded for now as found in tools, but should ideally come from env
const PROJECT_ID = "project-build-a-production-ready-w";
const TOKEN = "lp_projectb_b36f58290b11437d";
const API_URL = "https://launchpulse.ai";

interface StorageResponse {
  url?: string;
  file_url?: string;
  key?: string;
  error?: any;
}

export const storageProxy = {
  async upload(file: Express.Multer.File): Promise<{ url: string; key: string }> {
    const fileContent = file.buffer.toString('base64');
    const key = `${uuidv4()}-${file.originalname}`;
    
    // Attempting 'upload' path - if this is wrong, it needs to be updated to the correct proxy path
    const response = await fetch(`${API_URL}/api/storage/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        token: TOKEN,
        path: "upload", 
        params: {
          key: key,
          name: file.originalname,
          type: file.mimetype,
          content: fileContent
        }
      })
    });

    const data = await response.json() as StorageResponse;
    
    if (!response.ok || data.error) {
       console.error("Storage proxy upload error:", data.error || data);
       throw new Error(data.error?.message || "Storage upload failed");
    }

    // Assuming the proxy returns the public URL or we construct it
    // If the proxy returns 'url', use it. Otherwise construct it.
    // Based on 'list' usually returning public URLs.
    return {
      url: data.url || data.file_url || `${API_URL}/storage/${PROJECT_ID}/${key}`,
      key: key
    };
  },

  async delete(fileKey: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/storage/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        token: TOKEN,
        path: "delete",
        params: {
          fileKey: fileKey
        }
      })
    });

    const data = await response.json() as any;
    if (!response.ok || data.error) {
       console.error("Storage proxy delete error:", data.error || data);
       throw new Error(data.error?.message || "Storage delete failed");
    }
  }
};
