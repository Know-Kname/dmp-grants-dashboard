import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Customers from './Customers';
import { MotionProvider } from '../lib/motion';
import {
  useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer,
} from '../hooks/useData';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { Customer } from '../types';

/**
 * Cover for validation state surviving a modal session.
 *
 * `useForm` lives in the page, which never unmounts; `Modal` returns `null` when
 * closed, so closing it resets nothing. `reset()` is the only thing that clears
 * `errors` and `touched` — nothing obliged a page to call it, so a failed create
 * left its complaints behind for whatever opened the modal next.
 *
 * These assert the guarantee at the *entry* points rather than the exits: a
 * modal is in a known state whenever it opens, however it was last closed.
 */

vi.mock('../hooks/useData', () => ({
  useCustomers: vi.fn(),
  useCreateCustomer: vi.fn(),
  useUpdateCustomer: vi.fn(),
  useDeleteCustomer: vi.fn(),
}));
vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/toast', () => ({ useToast: vi.fn() }));

const createMutate = vi.fn();
const updateMutate = vi.fn();

const ada: Customer = {
  id: 'cus-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '(313) 555-0101',
  address: '1 Analytical Way',
  city: 'Detroit',
  state: 'MI',
  zipCode: '48201',
  notes: '',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const idleMutation = (mutate: ReturnType<typeof vi.fn>) => ({
  mutate, isPending: false, error: null,
});

const mockCustomers = (data: Customer[]) =>
  vi.mocked(useCustomers).mockReturnValue({
    data, isLoading: false, error: null, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCustomers>);

const renderCustomers = () =>
  render(
    <MemoryRouter>
      <MotionProvider>
        <Customers />
      </MotionProvider>
    </MemoryRouter>
  );

const dialog = () => screen.getByRole('dialog');

/** The modal's own submit button — "Add Customer" and the empty state's collide. */
const submitButton = () =>
  within(dialog()).getByRole('button', { name: /add customer|save changes/i });

/** The empty state's button, which is the one *outside* the dialog. */
const emptyStateAddButton = () => {
  const match = screen
    .getAllByRole('button', { name: /add customer/i })
    .find((b) => !b.closest('[role="dialog"]'));
  if (!match) throw new Error('no empty-state Add Customer button');
  return match;
};

const firstNameInput = () => within(dialog()).getByLabelText(/first name/i);

describe('Customers page — modal state between sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCustomers([ada]);
    vi.mocked(useCreateCustomer).mockReturnValue(
      idleMutation(createMutate) as unknown as ReturnType<typeof useCreateCustomer>
    );
    vi.mocked(useUpdateCustomer).mockReturnValue(
      idleMutation(updateMutate) as unknown as ReturnType<typeof useUpdateCustomer>
    );
    vi.mocked(useDeleteCustomer).mockReturnValue(
      idleMutation(vi.fn()) as unknown as ReturnType<typeof useDeleteCustomer>
    );
    vi.mocked(useAuth).mockReturnValue({
      can: () => true,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useToast).mockReturnValue({
      success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
    } as unknown as ReturnType<typeof useToast>);
  });

  it('opens Edit clean after a failed create was cancelled', async () => {
    renderCustomers();
    const user = userEvent.setup();

    // Fail a create: blank required fields, submitted.
    await user.click(screen.getByRole('button', { name: /new customer/i }));
    await user.click(submitButton());
    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Now edit an existing record. It must arrive populated and uncomplaining.
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByRole('dialog');

    expect(firstNameInput()).toHaveValue('Ada');
    expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/last name is required/i)).not.toBeInTheDocument();
  });

  it('opens New clean after an edit was cancelled', async () => {
    renderCustomers();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByRole('dialog');
    expect(firstNameInput()).toHaveValue('Ada');

    await user.click(within(dialog()).getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /new customer/i }));
    await screen.findByRole('dialog');
    expect(firstNameInput()).toHaveValue('');
  });

  it('opens clean from the empty state, not only from the header button', async () => {
    // The empty state is a second entry point that drifted from the header one:
    // it set `showModal` and nothing else.
    mockCustomers([]);
    renderCustomers();
    const user = userEvent.setup();

    await user.click(emptyStateAddButton());
    await user.click(submitButton());
    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();

    await user.click(within(dialog()).getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(emptyStateAddButton());
    await screen.findByRole('dialog');
    expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument();
  });

  it('still saves an edit normally', async () => {
    renderCustomers();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByRole('dialog');
    await user.clear(firstNameInput());
    await user.type(firstNameInput(), 'Augusta');
    await user.click(submitButton());

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cus-1', firstName: 'Augusta', lastName: 'Lovelace' })
    );
    expect(createMutate).not.toHaveBeenCalled();
  });
});
