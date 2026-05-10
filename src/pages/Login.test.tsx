import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { ThemeProvider } from '../lib/theme';
import { useAuth } from '../lib/auth';

// Mock useAuth so tests don't need a real Supabase connection.
// Login.tsx calls useAuth().login(email, password) on submit.
vi.mock('../lib/auth', () => ({
  useAuth: vi.fn(),
}));

const baseAuth = {
  login: vi.fn(),
  signInWithGoogle: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: false,
  isLoading: false,
  currentUser: null,
  isDemoActive: false,
};

const renderLogin = () =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <Login />
      </ThemeProvider>
    </MemoryRouter>
  );

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ ...baseAuth });
  });

  it('shows friendly error when login fails', async () => {
    vi.mocked(useAuth).mockReturnValue({
      ...baseAuth,
      login: vi.fn().mockRejectedValue(new Error('Invalid login credentials')),
    });

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email', { selector: 'input' }), 'staff@dmp.com');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/incorrect email or password/i)
    ).toBeInTheDocument();
  });

  it('calls login with submitted credentials', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({ ...baseAuth, login: mockLogin });

    renderLogin();
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText('Email', { selector: 'input' }),
      'staff@detroitmemorialpark.org'
    );
    await user.type(
      screen.getByLabelText('Password', { selector: 'input' }),
      'correct-password'
    );
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockLogin).toHaveBeenCalledWith(
      'staff@detroitmemorialpark.org',
      'correct-password'
    );
  });
});
