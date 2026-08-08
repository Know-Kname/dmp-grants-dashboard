import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import WorkOrders from './WorkOrders';
import { MotionProvider } from '../lib/motion';
import {
  useWorkOrders, useCreateWorkOrder, useUpdateWorkOrder, useDeleteWorkOrder,
} from '../hooks/useData';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { WorkOrder } from '../types';

/**
 * The reachable states of a work order — runbook 04.
 *
 * The runbook claimed a work order "can never leave pending". That is no longer
 * true: the board view's Start/Complete buttons call `moveTo`, which does write
 * `status`. Two narrower gaps survive, and these cover them.
 *
 * 1. `cancelled` is unreachable. The CHECK constraint permits it, the board
 *    renders a Cancelled column and the filter offers it, but no code path
 *    writes it — the column can never fill.
 * 2. `completedDate` is never set. `moveTo` writes only `status`, and the edit
 *    payload is hand-enumerated without it, so completing a work order leaves
 *    `completed_date` null forever.
 *
 * Both trace to the same shape: a hand-enumerated payload silently drops any
 * field nobody remembered to add.
 */

vi.mock('../hooks/useData', () => ({
  useWorkOrders: vi.fn(),
  useCreateWorkOrder: vi.fn(),
  useUpdateWorkOrder: vi.fn(),
  useDeleteWorkOrder: vi.fn(),
}));
vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/toast', () => ({ useToast: vi.fn() }));

const updateMutate = vi.fn();

const order: WorkOrder = {
  id: 'wo-1',
  title: 'Repair section fence',
  description: 'North boundary',
  type: 'maintenance',
  priority: 'medium',
  status: 'in_progress',
  assignedTo: 'A. Wright',
  dueDate: '2026-09-01',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <MotionProvider>
        <WorkOrders />
      </MotionProvider>
    </MemoryRouter>
  );

const dialog = () => screen.getByRole('dialog');

const openEditModal = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Edit' }));
  await screen.findByRole('dialog');
};

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(within(dialog()).getByRole('button', { name: /save changes/i }));

describe('WorkOrders — every documented status is reachable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkOrders).mockReturnValue({
      data: [order], isLoading: false, error: null, refetch: vi.fn(),
    } as never);
    vi.mocked(useCreateWorkOrder).mockReturnValue({
      mutate: vi.fn(), isPending: false, error: null,
    } as never);
    vi.mocked(useUpdateWorkOrder).mockReturnValue({
      mutate: updateMutate, isPending: false, error: null,
    } as never);
    vi.mocked(useDeleteWorkOrder).mockReturnValue({
      mutate: vi.fn(), isPending: false, error: null,
    } as never);
    vi.mocked(useAuth).mockReturnValue({ can: () => true } as never);
    vi.mocked(useToast).mockReturnValue({
      success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
    } as never);
  });

  it('offers a status control when editing an existing work order', async () => {
    renderPage();
    const user = userEvent.setup();

    await openEditModal(user);

    expect(within(dialog()).getByLabelText(/status/i)).toBeInTheDocument();
  });

  it('carries status in the update payload', async () => {
    renderPage();
    const user = userEvent.setup();

    await openEditModal(user);
    await user.selectOptions(within(dialog()).getByLabelText(/status/i), 'cancelled');
    await save(user);

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wo-1', status: 'cancelled' })
    );
  });

  it('stamps a completion date when a work order is completed', async () => {
    renderPage();
    const user = userEvent.setup();

    await openEditModal(user);
    await user.selectOptions(within(dialog()).getByLabelText(/status/i), 'completed');
    await save(user);

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    const payload = updateMutate.mock.calls[0][0];
    expect(payload.status).toBe('completed');
    // Otherwise `completed_date` stays null forever and "when was this done?"
    // has no answer.
    expect(payload.completedDate).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('stamps a completion date from the board Complete button too', async () => {
    renderPage();
    const user = userEvent.setup();

    // The board is the path staff actually use; it must not be a second
    // implementation with different behaviour.
    await user.click(screen.getByRole('tab', { name: /board/i }));
    await user.click(await screen.findByRole('button', { name: /complete/i }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    const payload = updateMutate.mock.calls[0][0];
    expect(payload.status).toBe('completed');
    expect(payload.completedDate).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('clears the completion date when a completed order is reopened', async () => {
    vi.mocked(useWorkOrders).mockReturnValue({
      data: [{ ...order, status: 'completed', completedDate: '2026-08-02' }],
      isLoading: false, error: null, refetch: vi.fn(),
    } as never);
    renderPage();
    const user = userEvent.setup();

    await openEditModal(user);
    await user.selectOptions(within(dialog()).getByLabelText(/status/i), 'in_progress');
    await save(user);

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    const payload = updateMutate.mock.calls[0][0];
    expect(payload.status).toBe('in_progress');
    // A stale completion date on an open order is worse than none.
    expect(payload.completedDate).toBeUndefined();
  });
});
