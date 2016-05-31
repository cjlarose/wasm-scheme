import { tokenize, parse } from './parse';
import { TOKEN_TYPES } from './tokens';
import {
  codeSection,
  functionBody,
  returnNode,
  i32Const,
  i32Add,
  i32Sub,
  i32Shl,
  i32ShrU,
  i32ShrS,
  i32Eqz,
} from './wasm_ast';

function isImmediateValue(tokens) {
  if (tokens.length !== 1) return false;
  const token = tokens[0];
  return token.type === TOKEN_TYPES.INTEGER ||
         token.type === TOKEN_TYPES.BOOLEAN;
}

function immediateRepr(token) {
  switch (token.type) {
    case TOKEN_TYPES.INTEGER:
      // integer tag is 01
      return token.value << 2 | 1;
    case TOKEN_TYPES.BOOLEAN:
      // false is 0 followed by tag 10
      // true is 1 followed by tag 10
      return token.value === false ? 2 : 6;
    default:
      throw new Error(`Unexpected token type ${token.type}`);
  }
}

export default function compile(source) {
  let expr;
  const tokens = tokenize(source);

  if (isImmediateValue(tokens)) {
    const token = tokens[0];
    const retValue = immediateRepr(token);
    expr = returnNode(1, i32Const(retValue));
  } else {
    const ast = parse(tokens);
    const [op, immediate] = ast;
    if (op.value === 'negate' && immediate.type === TOKEN_TYPES.INTEGER) {
      expr = i32Add(i32Shl(i32Sub(i32Const(0),
                                  i32ShrS(i32Const(immediateRepr(immediate)), i32Const(2))),
                           i32Const(2)),
                    i32Const(1));
    } else if (op.value === 'not' && immediate.type === TOKEN_TYPES.BOOLEAN) {
      expr = i32Add(i32Shl(i32Eqz(i32ShrU(i32Const(immediateRepr(immediate)),
                                          i32Const(2))),
                           i32Const(2)),
                    i32Const(2));
    } else {
      throw new Error('Not yet implemented');
    }
  }
  const code = codeSection(functionBody([], returnNode(1, expr)));

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
