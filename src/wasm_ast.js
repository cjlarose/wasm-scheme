import { encodeInt32, encodeUInt32 } from 'leb';
import { concatenate } from './util';

const utf8Encoder = new TextEncoder('utf-8');
const typeRepr = {
  i32: 0x01,
  i64: 0x02,
  f32: 0x03,
  f64: 0x04,
};

function section(title, payload) {
  const titleBytes = utf8Encoder.encode(title);
  return new Uint8Array([...encodeUInt32(titleBytes.length),
                         ...titleBytes,
                         ...encodeUInt32(payload.length),
                         ...payload]);
}

export function typeEntry(params, returnCount, returnType) {
  const paramTypes = params.map(p => typeRepr[p.type]);
  return new Uint8Array([0x40,
                         ...encodeUInt32(params.length),
                         ...paramTypes,
                         ...encodeUInt32(returnCount),
                         typeRepr[returnType]]);
}

export function typeSection(...typeEntries) {
  return section('type', new Uint8Array([...encodeUInt32(typeEntries.length),
                                         ...concatenate(Uint8Array, ...typeEntries)]));
}

export function codeSection(...functionBodies) {
  return section('code', new Uint8Array([...encodeUInt32(functionBodies.length),
                                         ...concatenate(Uint8Array, ...functionBodies)]));
}

function localEntry(count, type) {
  return new Uint8Array([...encodeUInt32(count),
                         typeRepr[type]]);
}

export function functionBody(locals, bodyAst) {
  // locals is an array of entries { name, type }
  // TODO: Actually look at local types
  const localEntries = locals.length === 0 ? [] : [localEntry(locals.length, 'i32')];
  const localEntryCount = encodeUInt32(localEntries.length);
  const encodedLocalEntries = concatenate(Uint8Array, ...localEntries);
  const functionLength = localEntryCount.length + encodedLocalEntries.length + bodyAst.length;
  return new Uint8Array([...encodeUInt32(functionLength),
                         ...localEntryCount,
                         ...encodedLocalEntries,
                         ...bodyAst]);
}

export function block(body) {
  return new Uint8Array([0x01, ...body, 0x0f]);
}

export function ifElse(thenAst, elseAst) {
  return new Uint8Array([0x03, ...thenAst, 0x04, ...elseAst, 0x0f]);
}

export function returnNode(numVals, valAst) {
  return new Uint8Array([...valAst, 0x09, ...encodeUInt32(numVals)]);
}

export function i32Const(num) {
  return new Uint8Array([0x10, ...encodeInt32(num)]);
}

export function getLocal(idx) {
  return new Uint8Array([0x14, ...encodeUInt32(idx)]);
}

export function setLocal(idx, valAst) {
  return new Uint8Array([...valAst, 0x15, ...encodeUInt32(idx)]);
}
