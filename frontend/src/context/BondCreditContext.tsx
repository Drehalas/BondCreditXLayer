import React, { createContext, useContext, useMemo, useState } from 'react';
import { BondCreditClient } from '../../../src/index';
import type { BondCreditClientConfig } from '../../../src/index';

interface BondCreditContextType {
  client: BondCreditClient;
  cfg: Omit<BondCreditClientConfig, never>;
  setCfg: React.Dispatch<React.SetStateAction<Omit<BondCreditClientConfig, never>>>;
  log: string;
  appendLog: (s: unknown) => void;
  showRegister: boolean;
  setShowRegister: React.Dispatch<React.SetStateAction<boolean>>;
}

const BondCreditContext = createContext<BondCreditContextType | null>(null);

export const useBondCredit = () => {
  const context = useContext(BondCreditContext);
  if (!context) throw new Error('useBondCredit must be used within BondCreditProvider');
  return context;
};

export const BondCreditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cfg, setCfg] = useState<Omit<BondCreditClientConfig, never>>({
    network: 'xlayer-testnet',
    agentId: 'agent-0x123...',
    privateKey: ''
  });

  const [log, setLog] = useState<string>('');
  const [showRegister, setShowRegister] = useState(false);

  const client = useMemo(() => {
    const config: BondCreditClientConfig = {
      network: cfg.network,
      agentId: cfg.agentId,
      privateKey: cfg.privateKey || undefined
    };
    return new BondCreditClient(config);
  }, [cfg.agentId, cfg.network, cfg.privateKey]);

  const appendLog = (s: unknown) => setLog(prev => (prev ? `${prev}\n${String(s)}` : String(s)));

  return (
    <BondCreditContext.Provider value={{ client, cfg, setCfg, log, appendLog, showRegister, setShowRegister }}>
      {children}
    </BondCreditContext.Provider>
  );
};
