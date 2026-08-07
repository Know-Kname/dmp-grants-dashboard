import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../../lib/motion';
import { mountScene } from '../../lib/gl';
import Grove from './Grove';
import Aurora from './Aurora';

/**
 * The whole contract of the visual layer is that it is optional.
 *
 * These scenes sit behind the dashboard hero and the login page — the first
 * screen every staff member sees. jsdom has no WebGL, and neither do plenty of
 * locked-down office machines and older hardware. A background animation must
 * never be the reason a page fails to render, so "no WebGL" has to be an
 * ordinary outcome rather than an error path.
 *
 * jsdom is a genuine test of this, not a simulation of one: `getContext` really
 * does return null here, which is the same thing the unsupported-hardware case
 * produces.
 */

const setup = (ui: React.ReactElement) => render(<MotionProvider>{ui}</MotionProvider>);

describe('visual layer degradation', () => {
  it('mountScene reports null when WebGL2 is unavailable', () => {
    const canvas = document.createElement('canvas');
    const setupFn = vi.fn();

    expect(mountScene(canvas, { setup: setupFn })).toBeNull();
    // The scene builder must not run at all — it would touch a null context.
    expect(setupFn).not.toHaveBeenCalled();
  });

  it('mountScene reports null when the scene declines to build', () => {
    const canvas = document.createElement('canvas');
    // Stand in for a context that exists but whose shaders fail to compile.
    vi.spyOn(canvas, 'getContext').mockReturnValue({} as unknown as RenderingContext);

    expect(mountScene(canvas, { setup: () => null })).toBeNull();
  });

  it('Grove renders a canvas and no visible content without WebGL', () => {
    const { container } = setup(<Grove />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    // Decorative throughout: it must never reach the accessibility tree.
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
  });

  it('Aurora renders a canvas and no visible content without WebGL', () => {
    const { container } = setup(<Aurora />);
    expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  it('unmounts cleanly when the scene never started', () => {
    // The teardown path has to cope with `mountScene` having returned null —
    // this is the unmount that would throw if the effect assumed a handle.
    const { unmount } = setup(<Grove />);
    expect(() => unmount()).not.toThrow();
  });
});
