import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Contracts from './Contracts';
import { MotionProvider } from '../lib/motion';
import {
  useContracts, useCreateContract, useUpdateContract,
  useDeleteContract, useCustomers, usePaymentSchedule,
} from '../hooks/useData';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { Contract } from '../types';

/**
 * Integration cover for the two ways a contract can be priced.
 *
 * The regression these guard: line items live in `useState` inside this page,
 * invisible to `contractFormSchema`. When the schema required a numeric
 * `totalAmount`, a contract priced purely by line items could never get past
 * `useForm.handleSubmit`'s parse gate — and because the Total Amount input is
 * unmounted as soon as a line item exists, the rejection had nowhere to render.
 * The button did nothing at all, with no error and no network call.
 */

vi.mock('../hooks/useData', () => ({
  useContracts: vi.fn(),
  useCreateContract: vi.fn(),
  useUpdateContract: vi.fn(),
  useDeleteContract: vi.fn(),
  useCustomers: vi.fn(),
  usePaymentSchedule: vi.fn(),
}));
vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/toast', () => ({ useToast: vi.fn() }));

const CUSTOMER_ID = '3f9a1c72-58a1-4f3e-9b2c-0d1e2f3a4b5c';

const createMutate = vi.fn();
const updateMutate = vi.fn();

const existingContract: Contract = {
  id: 'ctr-1',
  contractNumber: 'C-2025-042',
  type: 'at_need',
  customerId: CUSTOMER_ID,
  totalAmount: 4200,
  amountPaid: 1000,
  status: 'active',
  signedDate: '2025-06-01',
  items: [],
  createdAt: '2025-06-01T00:00:00Z',
  updatedAt: '2025-06-01T00:00:00Z',
};

const idleMutation = (mutate: ReturnType<typeof vi.fn>) => ({
  mutate, isPending: false, error: null,
});

const renderContracts = () =>
  render(
    <MemoryRouter>
      <MotionProvider>
        <Contracts />
      </MotionProvider>
    </MemoryRouter>
  );

/**
 * Set a controlled field's value in one event.
 *
 * Deliberately not `userEvent.type`: `Modal`'s focus-trap effect depends on the
 * `onClose` identity, and every page here passes an unmemoised handler, so the
 * effect re-runs on each render and pulls focus back to the dialog between
 * keystrokes. That is a separate pre-existing wart in `ui.tsx`; these tests are
 * about the submit path, so they set values without depending on focus.
 */
const setField = (matcher: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(matcher), { target: { value } });

/** Fill the three always-required header fields, leaving pricing to the caller. */
const fillHeader = () => {
  setField(/contract number/i, 'C-2026-001');
  setField(/customer/i, CUSTOMER_ID);
  setField(/signed date/i, '2026-01-15');
};

const addLineItem = async (
  user: ReturnType<typeof userEvent.setup>,
  description: string,
  amount: string
) => {
  await user.click(screen.getByRole('button', { name: /add item/i }));
  const descriptions = screen.getAllByPlaceholderText('Description');
  const amounts = screen.getAllByPlaceholderText('Amount');
  fireEvent.change(descriptions[descriptions.length - 1], { target: { value: description } });
  fireEvent.change(amounts[amounts.length - 1], { target: { value: amount } });
};

const openNewContractModal = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getAllByRole('button', { name: /new contract/i })[0]);
  await screen.findByRole('button', { name: /create contract/i });
};

const submit = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /create contract/i }));

const mockContracts = (data: Contract[]) =>
  vi.mocked(useContracts).mockReturnValue({
    data, isLoading: false, error: null, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useContracts>);

describe('Contracts page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContracts([]);
    vi.mocked(useCustomers).mockReturnValue({
      data: [{ id: CUSTOMER_ID, firstName: 'Ada', lastName: 'Wright' }],
    } as unknown as ReturnType<typeof useCustomers>);
    vi.mocked(usePaymentSchedule).mockReturnValue({
      data: [], isLoading: false,
    } as unknown as ReturnType<typeof usePaymentSchedule>);
    vi.mocked(useCreateContract).mockReturnValue(
      idleMutation(createMutate) as unknown as ReturnType<typeof useCreateContract>
    );
    vi.mocked(useUpdateContract).mockReturnValue(
      idleMutation(updateMutate) as unknown as ReturnType<typeof useUpdateContract>
    );
    vi.mocked(useDeleteContract).mockReturnValue(
      idleMutation(vi.fn()) as unknown as ReturnType<typeof useDeleteContract>
    );
    vi.mocked(useAuth).mockReturnValue({
      can: () => true,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useToast).mockReturnValue({
      success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
    } as unknown as ReturnType<typeof useToast>);
  });

  it('creates a contract priced entirely by line items, with Total Amount left blank', async () => {
    renderContracts();
    const user = userEvent.setup();

    await openNewContractModal(user);
    fillHeader();
    // Deliberately never touch Total Amount — adding an item unmounts the field.
    await addLineItem(user, 'Opening and closing', '1200');
    await addLineItem(user, 'Vault', '800');
    await submit(user);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        contractNumber: 'C-2026-001',
        customerId: CUSTOMER_ID,
        totalAmount: 2000,
        items: [
          { description: 'Opening and closing', amount: 1200 },
          { description: 'Vault', amount: 800 },
        ],
      })
    );
  });

  it('still creates a contract from a typed total with no line items', async () => {
    renderContracts();
    const user = userEvent.setup();

    await openNewContractModal(user);
    fillHeader();
    setField(/total amount/i, '3500');
    await submit(user);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 3500, items: [] })
    );
  });

  it('prefers the line-item sum when a total was also typed first', async () => {
    renderContracts();
    const user = userEvent.setup();

    await openNewContractModal(user);
    fillHeader();
    setField(/total amount/i, '999');
    await addLineItem(user, 'Marker', '450');
    await submit(user);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 450 })
    );
  });

  it('refuses to submit with neither a total nor line items, and says why', async () => {
    renderContracts();
    const user = userEvent.setup();

    await openNewContractModal(user);
    fillHeader();
    await submit(user);

    expect(
      await screen.findByText(/enter a total amount or add at least one line item/i)
    ).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('still saves an edited contract whose total was seeded from the record', async () => {
    mockContracts([existingContract]);
    renderContracts();
    const user = userEvent.setup();

    // `handleEdit` seeds the form with `String(c.totalAmount)`, so the round
    // trip is number -> string -> number and must land back on 4200.
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await screen.findByRole('button', { name: /save changes/i });
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ctr-1',
        totalAmount: 4200,
        amountPaid: 1000,
      })
    );
    expect(createMutate).not.toHaveBeenCalled();
  });
});
