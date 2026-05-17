import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Modal } from '../components/ui';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmContextType {
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ message: '' });
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((input: ConfirmOptions | string): Promise<boolean> => {
    const normalized: ConfirmOptions = typeof input === 'string' ? { message: input } : input;
    setOpts(normalized);
    setIsOpen(true);
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    setIsOpen(false);
    resolveRef.current?.(value);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        isOpen={isOpen}
        onClose={() => settle(false)}
        title={opts.title ?? 'Confirm'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>Cancel</Button>
            <Button variant={opts.danger !== false ? 'danger' : 'primary'} onClick={() => settle(true)}>
              {opts.confirmLabel ?? 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-foreground-muted">{opts.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
