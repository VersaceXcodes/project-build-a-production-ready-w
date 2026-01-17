import React, { useState, useEffect } from "react";
import App from "./App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GV_InkSplashOverlay, { SPLASH_SHOWN_KEY } from "@/components/views/GV_InkSplashOverlay";

// Removed imports from _cofounder/dev
// import FirstLaunch from "@/_cofounder/dev/firstlaunch.tsx";
// import Cmdl from "@/_cofounder/dev/cmdl.tsx";

const queryClient = new QueryClient();

const AppWrapper: React.FC = () => {
	const [showSplash, setShowSplash] = useState(() => {
		// Check if splash was already shown in this session
		return sessionStorage.getItem(SPLASH_SHOWN_KEY) !== 'true';
	});

	const handleSplashComplete = () => {
		setShowSplash(false);
	};

	return (
		<QueryClientProvider client={queryClient}>
			{/* Ink Splash Overlay - shown on first visit */}
			{showSplash && (
				<GV_InkSplashOverlay onComplete={handleSplashComplete} />
			)}
			{/* Removed FirstLaunch and Cmdl components */}
			<App />
		</QueryClientProvider>
	);
};

export default AppWrapper;
