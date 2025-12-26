// CORRECT
const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
const isLoading = useAppStore(state => state.authentication_state.authentication_status.is_loading);
const currentUser = useAppStore(state => state.authentication_state.current_user);

// WRONG - causes infinite loops
const { is_authenticated, is_loading } = useAppStore(state => state.authentication_state.authentication_status);