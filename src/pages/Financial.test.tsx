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

/**
 * Recording a payment must also advance the invoice's status — runbook 03.
 *
 * The edit modal offers one control, Amount Paid, and the mutation carried only
 * that. `status` therefore stayed `pending` forever: a fully-paid invoice
 * rendered Balance $0.00 beside a Pending badge, and the live `mark-overdue-ar`
 * cron (01:00 daily, confirmed active in `cron.job`) then flipped it to
 * `overdue` permanently, because nothing could move it back.
 *
 * The CHECK constraint permits `pending | partial | paid | overdue`; `paid` and
 * `partial` were simply never written by any code path in the repository.
 */
describe('Financial page — recording a payment advances invoice status', () => {
  const invoice = {
    id: 'ar-1',
    customerId: '3f9a1c72-58a1-4f3e-9b2c-0d1e2f3a4b5c',
    invoiceNumber: 'INV-001',
    amount: 1000,
    amountPaid: 0,
    status: 'pending' as const,
    dueDate: '2026-09-01',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };

  const updateMutate = vi.fn();

  const openPaymentModal = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('tab', { name: /receivables/i }));
    await user.click(await screen.findByRole('button', { name: /record payment/i }));
    await screen.findByRole('dialog');
  };

  const recordPayment = async (
    user: ReturnType<typeof userEvent.setup>,
    amount: string
  ) => {
    const field = within(dialog()).getByLabelText(/amount paid/i);
    await user.clear(field);
    await user.type(field, amount);
    await user.click(within(dialog()).getByRole('button', { name: /^save$/i }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const q of [useDeposits, usePayables, useVendors]) {
      vi.mocked(q).mockReturnValue(emptyQuery() as never);
    }
    vi.mocked(useReceivables).mockReturnValue({
      data: [invoice], isLoading: false, error: null, refetch: vi.fn(),
    } as never);
    for (const m of [useCreateDeposit, useCreateReceivable, useCreatePayable, useUpdatePayable]) {
      vi.mocked(m).mockReturnValue(idleMutation() as never);
    }
    vi.mocked(useUpdateReceivable).mockReturnValue({
      mutate: updateMutate, isPending: false, error: null,
    } as never);
    vi.mocked(useAuth).mockReturnValue({ can: () => true } as never);
    vi.mocked(useToast).mockReturnValue({
      success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
    } as never);
  });

  it('marks an invoice paid when the full amount is recorded', async () => {
    renderFinancial();
    const user = userEvent.setup();

    await openPaymentModal(user);
    await recordPayment(user, '1000');

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ar-1', amountPaid: 1000, status: 'paid' })
    );
  });

  it('marks an invoice partial when less than the full amount is recorded', async () => {
    renderFinancial();
    const user = userEvent.setup();

    await openPaymentModal(user);
    await recordPayment(user, '400');

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ar-1', amountPaid: 400, status: 'partial' })
    );
  });

  it('leaves an invoice pending when the recorded payment is zero', async () => {
    renderFinancial();
    const user = userEvent.setup();

    await openPaymentModal(user);
    await recordPayment(user, '0');

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ar-1', amountPaid: 0, status: 'pending' })
    );
  });

  it('treats an overpayment as paid rather than inventing a state', async () => {
    renderFinancial();
    const user = userEvent.setup();

    await openPaymentModal(user);
    // The column's CHECK constraint has no "overpaid"; refunds are handled
    // elsewhere. Anything at or beyond the invoice total is simply paid.
    await recordPayment(user, '1500');

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paid' })
    );
  });
});

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
