
import { v4 as uuidv4 } from 'uuid';

// Configuration for project storage
const PROJECT_ID = "project-build-a-production-ready-w";
const USER_ID = "8833a50a-5293-4e99-9814-e2c654d742a5";
const TOKEN = "lp_projectb_b36f58290b11437d";
const API_URL = "https://launchpulse.ai";
const STORAGE_CDN_URL = "https://pub-3b7303b412294731aa17afb2c3dff192.r2.dev";

interface StorageResponse {
  url?: string;
  file_url?: string;
  key?: string;
  file_key?: string;
  error?: any;
  message?: string;
}

export const storageProxy = {
  async upload(file: Express.Multer.File): Promise<{ url: string; key: string }> {
    const fileContent = file.buffer.toString('base64');
    // Sanitize filename - replace spaces and special characters
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${uuidv4()}-${sanitizedFilename}`;
    
    console.log('Uploading to storage proxy:', { filename: sanitizedFilename, key, mimetype: file.mimetype });
    
    const response = await fetch(`${API_URL}/api/storage/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        token: TOKEN,
        path: "upload", 
        params: {
          key: key,
          name: sanitizedFilename,
          type: file.mimetype,
          content: fileContent
        }
      })
    });

    const data = await response.json() as StorageResponse;
    
    console.log('Storage proxy response:', { ok: response.ok, status: response.status, data });
    
    if (!response.ok || data.error) {
       console.error("Storage proxy upload error:", data.error || data);
       throw new Error(data.error?.message || data.message || "Storage upload failed");
    }

    // Construct the public URL using the CDN format
    const publicUrl = data.url || data.file_url || `${STORAGE_CDN_URL}/${USER_ID}/${PROJECT_ID}/${key}`;
    
    return {
      url: publicUrl,
      key: data.file_key || key
    };
  },

  async delete(fileKey: string): Promise<void> {
    console.log('Deleting from storage:', fileKey);
    
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
    
    console.log('Storage delete response:', { ok: response.ok, status: response.status, data });
    
    if (!response.ok || data.error) {
       console.error("Storage proxy delete error:", data.error || data);
       throw new Error(data.error?.message || data.message || "Storage delete failed");
    }
  }
};
