'use client';

import { useStablecoinContext } from '@/components/stablecoin-provider';

export function useActiveMint() {
  return useStablecoinContext();
}
