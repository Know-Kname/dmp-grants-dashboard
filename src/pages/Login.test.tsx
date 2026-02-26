import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { ThemeProvider } from '../lib/theme';
import { AuthProvider } from '../lib/auth';
import { ApiRequestError, authApi } from '../lib/api';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      login: vi.fn(),
      logout: vi.fn(),
    },
  };
});

const renderLogin = () => {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
};

describe('Login page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows error details when login fails', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiRequestError({
        message: 'Invalid credentials',
        code: 'UNAUTHORIZED',
        statusCode: 401,
        requestId: 'req-1',
      })
    );

    renderLogin();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email address/i), 'admin@dmp.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByText('Request ID: req-1')).toBeInTheDocument();
  });

  it('stores token on successful login', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      token: 'token-123',
      user: {
        id: 'user-1',
        email: 'admin@dmp.com',
        name: 'Admin',
        role: 'admin',
        createdAt: new Date(0).toISOString(),
      },
    });

    renderLogin();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email address/i), 'admin@dmp.com');
    await user.type(screen.getByLabelText(/password/i), 'admin123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(localStorage.getItem('token')).toBe('token-123');
  });
});
