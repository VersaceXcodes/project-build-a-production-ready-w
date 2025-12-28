import React from "react";
import App from "./App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Removed imports from _cofounder/dev
// import FirstLaunch from "@/_cofounder/dev/firstlaunch.tsx";
// import Cmdl from "@/_cofounder/dev/cmdl.tsx";

const queryClient = new QueryClient();

const AppWrapper: React.FC = () => {
	return (
		<QueryClientProvider client={queryClient}>
			{/* Removed FirstLaunch and Cmdl components */}
			<App />
		</QueryClientProvider>
	);
};

export default AppWrapper;
