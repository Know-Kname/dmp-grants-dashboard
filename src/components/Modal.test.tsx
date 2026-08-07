import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Input, Modal } from './ui';
import { MotionProvider } from '../lib/motion';

/**
 * Behavioural cover for `ModalPanel`'s focus-trap effect in `ui.tsx`.
 *
 * The regression these guard: the effect was keyed on `[onClose]`. No page in
 * `src/pages/` memoises that prop — there is not a single `useCallback` in the
 * directory — so every parent render minted a fresh `onClose` identity. A
 * controlled input inside the modal re-renders its parent on every keystroke,
 * which re-ran the effect, and the cleanup's `previous?.focus()` pulled focus
 * off the input. One character landed per field, app-wide.
 *
 * `userEvent.type` is load-bearing here. `fireEvent.change` sets the value in a
 * single event and never exercises per-keystroke focus, so it passes against
 * the bug — which is exactly why the pre-existing page tests did not catch it.
 *
 * The remaining cases pin the rest of that one effect (Escape, Tab cycling,
 * scroll lock, focus restore), all of which the fix had to preserve.
 */

/**
 * A faithful miniature of every CRUD page in this app: parent-held state, a
 * controlled `Input`, and an **inline arrow** `onClose`. The inline arrow is
 * the point — do not hoist or memoise it.
 */
function ModalHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <MotionProvider>
      <button onClick={() => setIsOpen(true)}>Open modal</button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="New Customer"
        footer={<button onClick={() => setIsOpen(false)}>Save</button>}
      >
        <Input
          label="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Modal>
    </MotionProvider>
  );
}

const openModal = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Open modal' }));
  return screen.getByRole('dialog');
};

describe('Modal focus trap', () => {
  it('keeps focus in a controlled input across every keystroke', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await openModal(user);

    const firstName = screen.getByLabelText('First Name');
    await user.click(firstName);
    await user.type(firstName, 'Alexandra');

    expect(firstName).toHaveValue('Alexandra');
    expect(firstName).toHaveFocus();
  });

  it('keeps each field independent when several are typed into', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await openModal(user);

    const firstName = screen.getByLabelText('First Name');
    const notes = screen.getByLabelText('Notes');

    await user.click(firstName);
    await user.type(firstName, 'Bartholomew');
    await user.click(notes);
    await user.type(notes, 'Prefers afternoon appointments');

    expect(firstName).toHaveValue('Bartholomew');
    expect(notes).toHaveValue('Prefers afternoon appointments');
  });

  it('still closes on Escape, including after the parent has re-rendered', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await openModal(user);

    // Type first: the fix reads `onClose` through a ref, so this asserts the
    // ref tracks the latest closure rather than the one captured at mount.
    await user.type(screen.getByLabelText('First Name'), 'Cordelia');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('still cycles Tab within the dialog', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const dialog = await openModal(user);

    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>('button, input')
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Forward off the last focusable wraps to the first.
    last.focus();
    await user.tab();
    expect(first).toHaveFocus();

    // Backward off the first wraps to the last.
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it('still locks body scroll while open and restores it on close', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await openModal(user);

    expect(document.body.style.overflow).toBe('hidden');

    // A re-render must not release the lock either.
    await user.type(screen.getByLabelText('First Name'), 'Delphine');
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'));
  });

  it('still returns focus to the opener when it closes', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const opener = screen.getByRole('button', { name: 'Open modal' });
    await openModal(user);

    await user.type(screen.getByLabelText('First Name'), 'Evangeline');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('runs the latest onClose, not the one captured when it mounted', async () => {
    const user = userEvent.setup();
    const closedWith = vi.fn();

    /**
     * Guards the fix's own hazard rather than the original bug. Reading
     * `onClose` through a ref means a ref that stops being refreshed would
     * silently invoke a stale closure — over state the caller has since
     * changed. `draft` stands in for that state.
     */
    function StaleClosureHarness() {
      const [draft, setDraft] = useState('initial');
      return (
        <MotionProvider>
          <Modal isOpen onClose={() => closedWith(draft)} title="Draft">
            <button onClick={() => setDraft('edited')}>Edit draft</button>
          </Modal>
        </MotionProvider>
      );
    }

    render(<StaleClosureHarness />);
    await user.click(screen.getByRole('button', { name: 'Edit draft' }));
    await user.keyboard('{Escape}');

    expect(closedWith).toHaveBeenCalledWith('edited');
  });
});
