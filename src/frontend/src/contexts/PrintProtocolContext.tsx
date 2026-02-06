import React, { createContext, useContext, useState, useCallback } from 'react';

export type PrintProtocol = 'CPCL' | 'ZPL' | 'ESC/POS';

export interface PrintProtocolContextValue {
  protocol: PrintProtocol;
  setProtocol: (protocol: PrintProtocol) => void;
}

const PrintProtocolContext = createContext<PrintProtocolContextValue | null>(null);

export function PrintProtocolProvider({ children }: { children: React.ReactNode }) {
  const [protocol, setProtocolState] = useState<PrintProtocol>('CPCL');

  const setProtocol = useCallback((newProtocol: PrintProtocol) => {
    setProtocolState(newProtocol);
  }, []);

  const value: PrintProtocolContextValue = {
    protocol,
    setProtocol,
  };

  return <PrintProtocolContext.Provider value={value}>{children}</PrintProtocolContext.Provider>;
}

export function usePrintProtocol() {
  const context = useContext(PrintProtocolContext);
  if (!context) {
    throw new Error('usePrintProtocol must be used within PrintProtocolProvider');
  }
  return context;
}
