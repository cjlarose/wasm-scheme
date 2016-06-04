function i32Add(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x40]);
}

function i32Sub(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x41]);
}

function i32And(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x47]);
}

function i32Shl(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x4a]);
}

function i32ShrU(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x4b]);
}

function i32ShrS(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x4c]);
}

function i32Eq(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x4d]);
}

function i32Ne(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x4e]);
}

function i32Or(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x48]);
}

function i32Xor(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x49]);
}

function i32Eqz(operand) {
  return new Uint8Array([...operand, 0x5a]);
}

export const i32 = {
  add: i32Add,
  sub: i32Sub,
  and: i32And,
  shl: i32Shl,
  shrU: i32ShrU,
  shrS: i32ShrS,
  eq: i32Eq,
  ne: i32Ne,
  or: i32Or,
  xor: i32Xor,
  eqz: i32Eqz,
};
