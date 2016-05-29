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

function section(title, payload) {
  const titleBytes = utf8Encoder.encode(title);
  return new Uint8Array([...encodeUInt32(titleBytes.length),
                         ...titleBytes,
                         ...encodeUInt32(payload.length),
                         ...payload]);
}

function codeSection(...functionBodies) {
  return section('code', [...encodeUInt32(functionBodies.length),
                          ...concatenate(Uint8Array, ...functionBodies)]);
}

function functionBody(localEntries, bodyAst) {
  const localCount = encodeUInt32(localEntries.length);
  const locals = concatenate(Uint8Array, ...localEntries);
  const functionLength = localCount.length + locals.length + bodyAst.length;
  return new Uint8Array([...encodeUInt32(functionLength),
                         ...localCount,
                         ...locals,
                         ...bodyAst]);
}

function returnNode(numVals, valAst) {
  return new Uint8Array([...valAst, 0x09, ...encodeUInt32(numVals)]);
}

function i32Const(num) {
  return new Uint8Array([0x10, ...encodeInt32(num)]);
}

const DECIMAL_LITERAL = /^\d+$/;

export default function compile(source) {
  let code;

  if (DECIMAL_LITERAL.test(source)) {
    const retValue = parseInt(source, 10);
    code = codeSection(functionBody([], returnNode(1, i32Const(retValue))));
  } else {
    throw new Error('Unable to parse source');
  }

  return new Uint8Array([
    /* Magic number, version (11) */
    0x00, 0x61, 0x73, 0x6d, 0x0b, 0x00, 0x00, 0x00,

    /* section title length (4), section title "type", payload length (5) */
    0x04, 0x74, 0x79, 0x70, 0x65, 0x85, 0x80, 0x80, 0x80, 0x00,
    /* Entry count (1), Function, param count (0), return count (1), return type i32 */
    0x01, 0x40, 0x00, 0x01, 0x01,

    /* section title length (8), section title "function" */
    0x08, 0x66, 0x75, 0x6e, 0x63, 0x74, 0x69, 0x6f, 0x6e,
    /* payload length (2), */
    0x82, 0x80, 0x80, 0x80, 0x00,
    /* function count 1, index 0 */
    0x01, 0x00,

    /* section title length (6), section title "memory" */
    0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79,
    /* payload length (5) */
    0x85, 0x80, 0x80, 0x80, 0x00,
    /* initial memory (2 x 64Kib pages), maximum memory (2 x 64Kib pages), not exported */
    0x80, 0x02, 0x80, 0x02, 0x00,

    /* section title length (6), section title "export", */
    0x06, 0x65, 0x78, 0x70, 0x6f, 0x72, 0x74,
    /* payload length (8) */
    0x88, 0x80, 0x80, 0x80, 0x00,
    /* count (1), export entry: index 0, function string length (5), "entry" */
    0x01, 0x00, 0x05, 0x65, 0x6e, 0x74, 0x72, 0x79,

    ...code,

    /* section title length (4), section title "name" */
    0x04, 0x6e, 0x61, 0x6d, 0x65,
    /* payload length (8) */
    0x88, 0x80, 0x80, 0x80, 0x00,
    /* entry count (1), function name length (5) "entry", local count (0) */
    0x01, 0x05, 0x65, 0x6e, 0x74, 0x72, 0x79, 0x00,
  ]);
}
