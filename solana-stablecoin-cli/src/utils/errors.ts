import {
  SssError,
  PausedError,
  UnauthorizedError,
  SupplyCapExceededError,
  SenderBlacklistedError,
  ReceiverBlacklistedError,
  InvalidRoleError,
  ArithmeticOverflowError,
} from '@stbr/sss-token';

/**
 * Formats an unknown error (likely from the SSS SDK) into a user-friendly string.
 */
export function formatSssError(err: unknown): string {
  if (err instanceof PausedError) {
    return 'Operation blocked: The stablecoin is currently PAUSED.';
  }
  if (err instanceof UnauthorizedError) {
    return 'Permission denied: Your wallet does not have the required role for this operation.';
  }
  if (err instanceof SupplyCapExceededError) {
    return 'Invalid operation: This mint would exceed the configured supply cap.';
  }
  if (err instanceof SenderBlacklistedError) {
    return 'Compliance block: The sender address is blacklisted.';
  }
  if (err instanceof ReceiverBlacklistedError) {
    return 'Compliance block: The recipient address is blacklisted.';
  }
  if (err instanceof InvalidRoleError) {
    return 'Invalid role specified for this operation.';
  }
  if (err instanceof ArithmeticOverflowError) {
    return 'Math error: Numerical overflow occurred.';
  }
  if (err instanceof SssError) {
    return `Protocol error (${err.code}): ${err.message}`;
  }

  return err instanceof Error ? err.message : String(err);
}
