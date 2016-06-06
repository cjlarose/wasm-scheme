import { concatenate } from './util';
import { tokenize, parse } from './parse';
import { TOKEN_TYPES, reservedWords } from './tokens';
import {
  typeEntry,
  typeSection,
  codeSection,
  functionBody,
  block,
  ifElse,
  returnNode,
  i32Const,
  getLocal,
  setLocal,
} from './wasm_ast';

import { i32 } from './wasm_ast/simple_ops';
import { i32Load, i32Store } from './wasm_ast/memory_access';

const FIXNUM_TAG = 1;
const BOOLEAN_TAG = 2;
const CONS_TAG = 3;

function isImmediateValue(tokens) {
  if (tokens.length !== 1) return false;
  const token = tokens[0];
  return token.type === TOKEN_TYPES.INTEGER ||
         token.type === TOKEN_TYPES.BOOLEAN;
}

function immediateRepr(token) {
  switch (token.type) {
    case TOKEN_TYPES.INTEGER:
      return token.value << 2 | FIXNUM_TAG;
    case TOKEN_TYPES.BOOLEAN:
      return token.value << 2 | BOOLEAN_TAG;
    default:
      throw new Error(`Unexpected token type ${token.type}`);
  }
}

const NIL = i32Const(immediateRepr(reservedWords.nil));

function markFixnum(exprAst) {
  return i32.or(i32.shl(exprAst, i32Const(2)), i32Const(FIXNUM_TAG));
}

function markBoolean(exprAst) {
  return i32.or(i32.shl(exprAst, i32Const(2)), i32Const(BOOLEAN_TAG));
}

function markCons(pointerAst) {
  return i32.or(pointerAst, i32Const(CONS_TAG));
}

function extractTag(exprAst) {
  return i32.and(exprAst, i32Const(3));
}

function extractFixnum(exprAst) {
  return i32.shrS(exprAst, i32Const(2));
}

function alloc(locals, numBytes) {
  // produce code that increments the allocation pointer by numBytes and
  // returns the old allocation pointer
  locals.push({ name: 'allocationPointer', type: 'i32' });
  const idx = locals.length;
  return block([...setLocal(idx, getLocal(0)),
                ...setLocal(0, i32.add(getLocal(0), i32Const(numBytes))),
                ...getLocal(idx)]);
}

function ifExpression(test, thenCode, elseCode = NIL) {
  const testCode = i32.ne(test, NIL);
  return concatenate(Uint8Array, testCode, ifElse(thenCode, elseCode));
}

// CL form -> WASM expression(s)
function compileExpression(formOrImmediate, locals, env) {
  if (Array.isArray(formOrImmediate)) {
    const [op, ...operands] = formOrImmediate;

    if (op.value === 'not' && operands[0].type === TOKEN_TYPES.BOOLEAN) {
      return markBoolean(i32.eqz(i32.shrU(compileExpression(operands[0], locals, env),
                                          i32Const(2))));
    } else if (op.value === 'fixnum?') {
      return markBoolean(i32.eq(extractTag(compileExpression(operands[0], locals, env)),
                                i32Const(FIXNUM_TAG)));
    } else if (op.value === 'boolean?') {
      return markBoolean(i32.eq(extractTag(compileExpression(operands[0], locals, env)),
                                i32Const(BOOLEAN_TAG)));
    } else if (op.type === TOKEN_TYPES.PLUS) {
      const exprs = operands.map(operand => extractFixnum(compileExpression(operand, locals, env)));
      const sum = exprs.reduce((sumExpr, operand) => i32.add(sumExpr, operand));
      return markFixnum(sum);
    } else if (op.type === TOKEN_TYPES.MINUS) {
      if (operands.length === 1) {
        return markFixnum(i32.sub(i32Const(0),
                                  extractFixnum(compileExpression(operands[0], locals, env))));
      }

      const exprs = operands.map(operand => extractFixnum(compileExpression(operand, locals, env)));
      const sum = exprs.reduce((diffExpr, operand) => i32.sub(diffExpr, operand));
      return markFixnum(sum);
    } else if (op.value === 'let') {
      const [bindings, ...exprs] = operands;

      const newBindings = {};
      for (const [nameToken] of bindings) {
        const name = nameToken.value;
        locals.push({ name, type: 'i32' });
        // localIndex starts at 1 because 0 is a parameter.
        // This is a straight-up hack
        const localIndex = locals.length;
        newBindings[name] = localIndex;
      }

      const bindingExprs = bindings.map(
        ([name, expr]) => setLocal(newBindings[name.value], compileExpression(expr, locals, env))
      );

      const newEnv = Object.assign({}, env, newBindings);
      const bodyCode = exprs.map(expr => compileExpression(expr, locals, newEnv));
      return block([...concatenate(Uint8Array, ...bindingExprs),
                    ...concatenate(Uint8Array, ...bodyCode)]);
    } else if (op.value === 'if') {
      const [testForm, thenForm, elseForm] = operands;
      return ifExpression(compileExpression(testForm, locals, env),
                          compileExpression(thenForm, locals, env),
                          elseForm ? compileExpression(elseForm, locals, env) : undefined);
    } else if (op.value === 'cons') {
      const [carForm, cdrForm] = operands;
      const carCode = compileExpression(carForm, locals, env);
      const cdrCode = compileExpression(cdrForm, locals, env);
      const code = block([...i32Store(getLocal(0), carCode),
                          ...i32Store(getLocal(0), cdrCode, 4),
                          ...markCons(alloc(locals, 8))]);
      return code;
    } else if (op.value === 'car') {
      const [valAst] = operands;
      const address = compileExpression(valAst, locals, env);
      return ifExpression(address,
                          i32Load(i32.sub(address, i32Const(CONS_TAG))));
    }

    throw new Error('Not yet implemented');
  }

  if (formOrImmediate.type === TOKEN_TYPES.ID) {
    const name = formOrImmediate.value;
    if (!env.hasOwnProperty(name)) {
      throw new Error(`Undefined variable '${name}'`);
    }
    return getLocal(env[name]);
  }

  return i32Const(immediateRepr(formOrImmediate));
}

function compileFunction(tokens) {
  if (isImmediateValue(tokens)) {
    const expr = i32Const(immediateRepr(tokens[0]));
    return functionBody([], returnNode(1, expr));
  }

  const locals = [];
  const form = parse(tokens);
  const expr = compileExpression(form, locals, {});
  const fb = functionBody(locals, returnNode(1, expr));
  return fb;
}

export default function compile(source) {
  const tokens = tokenize(source);
  const code = codeSection(compileFunction(tokens));

  return new Uint8Array([
    /* Magic number, version (11) */
    0x00, 0x61, 0x73, 0x6d, 0x0b, 0x00, 0x00, 0x00,

    ...typeSection(typeEntry([{ type: 'i32' }], 1, 'i32')),

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
