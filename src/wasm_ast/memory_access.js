import { encodeUInt32 } from 'leb';

export function i32Load(addressAst, offset = 0, alignment = 2) {
  // Alignment is interpreted to be an exponent of 2
  // So alignment = 2 means 4-byte aligned
  // So alignment = 3 means 8-byte aligned
  const flags = 1 << alignment;
  return new Uint8Array([
    ...addressAst,
    0x2a,
    ...encodeUInt32(flags),
    ...encodeUInt32(offset),
  ]);
}

export function i32Store(addressAst, valueAst, offset = 0, alignment = 2) {
  const flags = 1 << alignment;
  return new Uint8Array([
    ...addressAst,
    ...valueAst,
    0x33,
    ...encodeUInt32(flags),
    ...encodeUInt32(offset),
  ]);
}
