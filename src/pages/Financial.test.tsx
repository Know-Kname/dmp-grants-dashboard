import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Financial from './Financial';
import { MotionProvider } from '../lib/motion';
import {
  useDeposits, useCreateDeposit,
  useReceivables, useCreateReceivable, useUpdateReceivable,
  usePayables, useCreatePayable, useUpdatePayable,
  useVendors,
} from '../hooks/useData';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

/**
 * Financial is the worse shape of the same defect.
 *
 * Every other page's "New X" button at least called `form.reset`, so only the
 * Edit and empty-state paths leaked. Here `handleOpenCreate` reset nothing at
 * all, and one modal serves five forms — so an abandoned create came back with
 * its **values** intact, showing the user data they thought they had discarded.
 */

vi.mock('../hooks/useData', () => ({
  useDeposits: vi.fn(),
  useCreateDeposit: vi.fn(),
  useReceivables: vi.fn(),
  useCreateReceivable: vi.fn(),
  useUpdateReceivable: vi.fn(),
  usePayables: vi.fn(),
  useCreatePayable: vi.fn(),
  useUpdatePayable: vi.fn(),
  useVendors: vi.fn(),
}));
vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/toast', () => ({ useToast: vi.fn() }));

const idleMutation = () => ({ mutate: vi.fn(), isPending: false, error: null });
const emptyQuery = () => ({
  data: [], isLoading: false, error: null, refetch: vi.fn(),
});

const renderFinancial = () =>
  render(
    <MemoryRouter>
      <MotionProvider>
        <Financial />
      </MotionProvider>
    </MemoryRouter>
  );

const dialog = () => screen.getByRole('dialog');

/** The header button, which is the "Record Deposit" *outside* the dialog. */
const headerAddButton = () => {
  const match = screen
    .getAllByRole('button', { name: /record deposit/i })
    .find((b) => !b.closest('[role="dialog"]'));
  if (!match) throw new Error('no header Record Deposit button');
  return match;
};

const closeModal = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(within(dialog()).getByRole('button', { name: /cancel/i }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
};

describe('Financial page — modal state between sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const q of [useDeposits, useReceivables, usePayables, useVendors]) {
      vi.mocked(q).mockReturnValue(emptyQuery() as never);
    }
    for (const m of [
      useCreateDeposit, useCreateReceivable, useUpdateReceivable,
      useCreatePayable, useUpdatePayable,
    ]) {
      vi.mocked(m).mockReturnValue(idleMutation() as never);
    }
    vi.mocked(useAuth).mockReturnValue({
      can: () => true,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useToast).mockReturnValue({
      success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
    } as unknown as ReturnType<typeof useToast>);
  });

  it('discards an abandoned deposit rather than restoring it on reopen', async () => {
    renderFinancial();
    const user = userEvent.setup();

    await user.click(headerAddButton());
    await user.type(within(dialog()).getByLabelText(/amount/i), '500');
    await user.type(within(dialog()).getByLabelText(/reference/i), 'CHK-9001');
    expect(within(dialog()).getByLabelText(/amount/i)).toHaveValue(500);

    await closeModal(user);

    await user.click(headerAddButton());
    await screen.findByRole('dialog');
    expect(within(dialog()).getByLabelText(/amount/i)).toHaveValue(null);
    expect(within(dialog()).getByLabelText(/reference/i)).toHaveValue('');
  });

  it('opens clean after a failed deposit was cancelled', async () => {
    renderFinancial();
    const user = userEvent.setup();

    await user.click(headerAddButton());
    await user.click(within(dialog()).getByRole('button', { name: /^save$/i }));
    expect(await within(dialog()).findByText(/required|must be/i)).toBeInTheDocument();

    await closeModal(user);

    await user.click(headerAddButton());
    await screen.findByRole('dialog');
    expect(within(dialog()).queryByText(/required|must be/i)).not.toBeInTheDocument();
  });
});
