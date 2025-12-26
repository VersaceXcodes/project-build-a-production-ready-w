import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

import UV_Login from '../components/views/UV_Login';
import { useAppStore } from '@/store/main';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Auth E2E Flow (Register -> Logout -> Login)', () => {
  const uniqueEmail = `user${Date.now()}@example.com`;
  const password = 'Password123!';
  const name = 'Test User';

  beforeEach(() => {
    localStorage.clear();
    // Reset store to unauthenticated state
    useAppStore.setState((state) => ({
      authentication_state: {
        ...state.authentication_state,
        current_user: null,
        user_profile: null,
        auth_token: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: false,
        },
        error_message: null,
      },
    }));
  });

  it('completes the full auth lifecycle with real API', async () => {
    const user = userEvent.setup();
    render(<UV_Login />, { wrapper: Wrapper });

    // 1. REGISTER FLOW
    
    // Switch to register mode
    const toggleButton = screen.getByRole('button', { name: /don't have an account\? sign up/i });
    await user.click(toggleButton);

    // Verify register fields appear
    const nameInput = await screen.findByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Fill form
    await user.type(nameInput, name);
    await user.type(emailInput, uniqueEmail);
    await user.type(passwordInput, password);

    // Submit
    await user.click(submitButton);

    // Wait for authentication
    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
      expect(state.authentication_state.auth_token).toBeTruthy();
      expect(state.authentication_state.current_user?.email).toBe(uniqueEmail);
    }, { timeout: 10000 });

    // 2. LOGOUT FLOW
    const logoutAction = useAppStore.getState().logout_user;
    logoutAction();

    // Verify logout
    await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(false);
        expect(state.authentication_state.auth_token).toBeNull();
    });

    // 3. LOGIN FLOW
    
    // Ensure we render fresh or inputs are cleared/available. 
    // Since we didn't unmount, the component might still be in register mode or cleared.
    // UV_Login resets fields on toggle, but we just logged out via store.
    // The component might reflect the logged out state but we need to check if it's in login mode.
    // UV_Login local state `isRegisterMode` might still be true.
    // We should probably toggle it back or re-render. 
    // Ideally, a logout redirects to login route which remounts.
    // For this test, we can just click "Sign in" toggle if we are in register mode.
    
    // Check if we are in register mode (Create account button visible?)
    if (screen.queryByRole('button', { name: /create account/i })) {
        const signInToggle = screen.getByRole('button', { name: /already have an account\? sign in/i });
        await user.click(signInToggle);
    }

    // Now we should be in login mode
    const loginEmailInput = await screen.findByLabelText(/email address/i);
    const loginPasswordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /sign in/i }); // Matches "Sign in" or "Sign in to your account"?
    // The button text is "Sign in" (ternary)
    
    // Fill form
    await user.clear(loginEmailInput);
    await user.type(loginEmailInput, uniqueEmail);
    await user.clear(loginPasswordInput);
    await user.type(loginPasswordInput, password);

    // Submit
    await user.click(loginButton);

    // Wait for authentication again
    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
      expect(state.authentication_state.auth_token).toBeTruthy();
      expect(state.authentication_state.current_user?.email).toBe(uniqueEmail);
    }, { timeout: 10000 });

  });
});
