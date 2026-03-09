'use client';

import { useMemo } from 'react';
import { Program } from '@coral-xyz/anchor';
import { SSS_CORE_PROGRAM_ID } from '@/lib/constants';
import { useAnchorProvider } from './use-anchor-provider';

// Import IDL JSON directly
import SssCoreIdl from '../idl/sss_core.json';

export function useLedgerProgram() {
  const provider = useAnchorProvider();

  return useMemo(() => {
    if (!provider) return null;

    return new Program(SssCoreIdl as any, provider);
  }, [provider]);
}

export function useProgramId() {
  return SSS_CORE_PROGRAM_ID;
}
