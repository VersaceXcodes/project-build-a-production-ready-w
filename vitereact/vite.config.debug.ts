import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [
		{
			name: "debug-plugin",
			transform(code, id) {
				if (id.includes('node_modules')) return null;
				console.log(`Transforming: ${id.substring(id.lastIndexOf('/') + 1)}`);
				return null;
			}
		},
		react(),
	],
	server: {
		host: true,
		allowedHosts: true,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@schema": path.resolve(__dirname, "../backend/schema.ts"),
		},
	},
	build: {
		outDir: "dist",
	},
});
