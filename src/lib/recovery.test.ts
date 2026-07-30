/**
 * These tests pin the classification that `/reset-password` uses to decide
 * whether to render a password form at all — the security boundary that a
 * previous `if (session)` check got wrong, allowing account takeover from a
 * shared workstation.
 *
 * `initialRecoveryLink` is a module-scope snapshot (deliberately — auth-js
 * scrubs the URL before React can read it), so each case sets the URL and then
 * re-imports the module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/** Load `./recovery` fresh against a given URL. */
async function loadWithUrl(url: string, hasVerifier = false) {
  vi.resetModules();
  vi.doMock('./authStorage', () => ({
    hasCodeVerifier: () => hasVerifier,
  }));
  window.history.replaceState({}, '', url);
  return import('./recovery');
}

describe('initialRecoveryLink', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.doUnmock('./authStorage');
    vi.resetModules();
  });

  it('classifies a bare /reset-password as carrying no recovery link', async () => {
    // The takeover case: a colleague's session is in localStorage and someone
    // types the URL. There is no recovery evidence, so the page must refuse.
    const { initialRecoveryLink } = await loadWithUrl('/reset-password');
    expect(initialRecoveryLink.kind).toBe('none');
  });

  it('recognises a token_hash recovery link', async () => {
    const { initialRecoveryLink } = await loadWithUrl(
      '/reset-password?token_hash=abc123&type=recovery',
    );
    expect(initialRecoveryLink.kind).toBe('token_hash');
    expect(initialRecoveryLink.tokenHash).toBe('abc123');
  });

  it('ignores a token_hash whose type is not recovery', async () => {
    const { initialRecoveryLink } = await loadWithUrl(
      '/reset-password?token_hash=abc123&type=signup',
    );
    expect(initialRecoveryLink.kind).not.toBe('token_hash');
  });

  it('flags a PKCE link opened without this browser’s verifier', async () => {
    // Request the reset on the desktop, open the email on a phone. The link is
    // valid; auth-js just will not attempt the exchange. This must be
    // distinguishable from "the server rejected it".
    const { initialRecoveryLink } = await loadWithUrl('/reset-password?code=xyz', false);
    expect(initialRecoveryLink.kind).toBe('pkce');
    expect(initialRecoveryLink.hadCodeVerifier).toBe(false);
  });

  it('marks a PKCE link as completable when the verifier is present', async () => {
    const { initialRecoveryLink } = await loadWithUrl('/reset-password?code=xyz', true);
    expect(initialRecoveryLink.kind).toBe('pkce');
    expect(initialRecoveryLink.hadCodeVerifier).toBe(true);
  });

  it('recognises an implicit-grant recovery fragment', async () => {
    const { initialRecoveryLink } = await loadWithUrl(
      '/reset-password#access_token=tok&type=recovery',
    );
    expect(initialRecoveryLink.kind).toBe('implicit');
  });

  it('surfaces a link that reports its own failure', async () => {
    const { initialRecoveryLink } = await loadWithUrl(
      '/reset-password?error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(initialRecoveryLink.kind).toBe('error');
    expect(initialRecoveryLink.errorDescription).toBe('Email link is invalid or has expired');
  });

  it('prefers the reported error over any credentials in the same URL', async () => {
    const { initialRecoveryLink } = await loadWithUrl(
      '/reset-password?code=xyz&error=access_denied',
      true,
    );
    expect(initialRecoveryLink.kind).toBe('error');
  });
});

describe('password recovery latch', () => {
  afterEach(() => {
    vi.doUnmock('./authStorage');
    vi.resetModules();
  });

  it('reports an event that fired before anyone subscribed', async () => {
    // auth-js emits PASSWORD_RECOVERY on a setTimeout(0) to whoever is listening
    // at that instant, so a component subscribing in useEffect can miss it.
    const mod = await loadWithUrl('/reset-password?code=xyz', true);
    expect(mod.hasPasswordRecoveryFired()).toBe(false);
    mod.markPasswordRecovery();
    expect(mod.hasPasswordRecoveryFired()).toBe(true);
  });

  it('notifies subscribers exactly once', async () => {
    const mod = await loadWithUrl('/reset-password?code=xyz', true);
    const listener = vi.fn();
    mod.onPasswordRecovery(listener);

    mod.markPasswordRecovery();
    mod.markPasswordRecovery();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', async () => {
    const mod = await loadWithUrl('/reset-password?code=xyz', true);
    const listener = vi.fn();
    mod.onPasswordRecovery(listener)();

    mod.markPasswordRecovery();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('recovery pending gate', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.doUnmock('./authStorage');
    vi.resetModules();
  });

  it('starts closed', async () => {
    window.sessionStorage.clear();
    const mod = await loadWithUrl('/reset-password');
    expect(mod.isRecoveryPending()).toBe(false);
  });

  it('opens and closes around the password update', async () => {
    window.sessionStorage.clear();
    const mod = await loadWithUrl('/reset-password');

    mod.beginRecoverySession();
    expect(mod.isRecoveryPending()).toBe(true);

    mod.endRecoverySession();
    expect(mod.isRecoveryPending()).toBe(false);
  });

  it('survives a reload, so refreshing cannot lift the restriction', async () => {
    window.sessionStorage.clear();
    const first = await loadWithUrl('/reset-password');
    first.beginRecoverySession();

    // Fresh module evaluation = a new page load in the same tab.
    const second = await loadWithUrl('/reset-password');
    expect(second.isRecoveryPending()).toBe(true);
  });

  it('notifies subscribers when it changes', async () => {
    window.sessionStorage.clear();
    const mod = await loadWithUrl('/reset-password');
    const listener = vi.fn();
    mod.subscribeRecoveryPending(listener);

    mod.beginRecoverySession();
    expect(listener).toHaveBeenCalledTimes(1);

    // Idempotent: setting the same value must not churn subscribers.
    mod.beginRecoverySession();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
