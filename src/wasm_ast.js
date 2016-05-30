import { encodeInt32, encodeUInt32 } from 'leb';

const utf8Encoder = new TextEncoder('utf-8');

/*
 * http://www.2ality.com/2015/10/concatenating-typed-arrays.html
 */
function concatenate(ResultConstructor, ...arrays) {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new ResultConstructor(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export function section(title, payload) {
  const titleBytes = utf8Encoder.encode(title);
  return new Uint8Array([...encodeUInt32(titleBytes.length),
                         ...titleBytes,
                         ...encodeUInt32(payload.length),
                         ...payload]);
}

export function codeSection(...functionBodies) {
  return section('code', [...encodeUInt32(functionBodies.length),
                          ...concatenate(Uint8Array, ...functionBodies)]);
}

export function functionBody(localEntries, bodyAst) {
  const localCount = encodeUInt32(localEntries.length);
  const locals = concatenate(Uint8Array, ...localEntries);
  const functionLength = localCount.length + locals.length + bodyAst.length;
  return new Uint8Array([...encodeUInt32(functionLength),
                         ...localCount,
                         ...locals,
                         ...bodyAst]);
}

export function returnNode(numVals, valAst) {
  return new Uint8Array([...valAst, 0x09, ...encodeUInt32(numVals)]);
}

export function i32Const(num) {
  return new Uint8Array([0x10, ...encodeInt32(num)]);
}

export function i32Sub(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x41]);
}

export function i32Xor(lhs, rhs) {
  return new Uint8Array([...lhs, ...rhs, 0x49]);
}
