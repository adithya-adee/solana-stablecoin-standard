import { describe, it, expect } from 'vitest';
import { asTier, asRole, asRoleId, StablecoinTiers, ROLE_ID_MAP } from '../src/types';

describe('Branded types', () => {
  it('preset factory returns correct string', () => {
    const val = asTier('sss-1');
    expect(val).toBe('sss-1');
  });

  it('roleType factory returns correct string', () => {
    const val = asRole('admin');
    expect(val).toBe('admin');
  });

  it('roleId factory returns correct number', () => {
    const val = asRoleId(0);
    expect(val).toBe(0);
  });

  it('ROLE_ID_MAP keys work at compile and runtime', () => {
    const roleMapVal = (ROLE_ID_MAP as any)[asRole('admin')];
    expect(roleMapVal).toBe(0);
  });

  it('StablecoinTiers object retains properties', () => {
    expect(StablecoinTiers.SSS_1).toBe('sss-1');
    expect(StablecoinTiers.SSS_2).toBe('sss-2');
    expect(StablecoinTiers.SSS_3).toBe('sss-3');
  });
});
