import { concatenate } from './util';
import { tokenize, parse } from './parse';
import { TOKEN_TYPES, reservedWords } from './tokens';
import {
  preamble,
  typeEntry,
  typeSection,
  functionSection,
  memorySection,
  exportEntry,
  exportSection,
  codeSection,
  nameEntry,
  nameSection,
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

function compilePrimitiveCall(formOrImmediate, locals, env) {
  const [op, ...operands] = formOrImmediate;

  if (op.value === 'not') {
    const [operandCode, newLocals] = compileExpression(operands[0], locals, env);
    return [markBoolean(i32.eqz(i32.shrU(operandCode, i32Const(2)))), newLocals];
  } else if (op.value === 'fixnum?') {
    const [operandCode, newLocals] = compileExpression(operands[0], locals, env);
    return [markBoolean(i32.eq(extractTag(operandCode), i32Const(FIXNUM_TAG))), newLocals];
  } else if (op.value === 'boolean?') {
    const [operandCode, newLocals] = compileExpression(operands[0], locals, env);
    return [markBoolean(i32.eq(extractTag(operandCode), i32Const(BOOLEAN_TAG))), newLocals];
  } else if (op.type === TOKEN_TYPES.PLUS) {
    const [ast, newLocals] = operands.reduce(([expr, currentLocals], operand) => {
      const [operandCode, modifiedLocals] = compileExpression(operand, currentLocals, env);
      const newExpr = i32.add(expr, extractFixnum(operandCode));
      return [newExpr, modifiedLocals];
    }, [i32Const(0), locals]);
    return [markFixnum(ast), newLocals];
  } else if (op.type === TOKEN_TYPES.MINUS) {
    if (operands.length === 1) {
      const [operandCode, newLocals] = compileExpression(operands[0], locals, env);
      const code = markFixnum(i32.sub(i32Const(0), extractFixnum(operandCode)));
      return [code, newLocals];
    }

    const [minuendAst, ...subtrahends] = operands;
    const [minuendCode, startingLocals] = compileExpression(minuendAst, locals, env);
    const minuend = extractFixnum(minuendCode);

    const [ast, newLocals] = subtrahends.reduce(([expr, currentLocals], operand) => {
      const [operandCode, modifiedLocals] = compileExpression(operand, currentLocals, env);
      const newExpr = i32.sub(expr, extractFixnum(operandCode));
      return [newExpr, modifiedLocals];
    }, [minuend, startingLocals]);
    return [markFixnum(ast), newLocals];
  } else if (op.value === 'cons') {
    const [carForm, cdrForm] = operands;
    const [carCode, localsAfterCar] = compileExpression(carForm, locals, env);
    const [cdrCode, localsAfterCdr] = compileExpression(cdrForm, localsAfterCar, env);

    const newLocals = localsAfterCdr.concat([{ type: 'i32' }, { type: 'i32' }]);
    const carLocal = newLocals.length - 1;
    const cdrLocal = newLocals.length;

    const code = block(concatenate(Uint8Array,
                                   setLocal(carLocal, carCode),
                                   setLocal(cdrLocal, cdrCode),
                                   i32Store(getLocal(0), getLocal(carLocal)),
                                   i32Store(getLocal(0), getLocal(cdrLocal), 4),
                                   markCons(alloc(newLocals, 8))));
    return [code, newLocals];
  } else if (op.value === 'car') {
    const [valForm] = operands;
    const [addressCode, localsAfterAddress] = compileExpression(valForm, locals, env);
    const newLocals = localsAfterAddress.concat([{ type: 'i32' }]);
    const idx = newLocals.length;
    const code = block(concatenate(Uint8Array,
                                   setLocal(idx, addressCode),
                                   ifExpression(getLocal(idx),
                                                i32Load(i32.sub(getLocal(idx),
                                                                i32Const(CONS_TAG))))));
    return [code, newLocals];
  } else if (op.value === 'cdr') {
    const [valForm] = operands;
    const [addressCode, localsAfterAddress] = compileExpression(valForm, locals, env);
    const newLocals = localsAfterAddress.concat([{ type: 'i32' }]);
    const idx = newLocals.length;
    const code = block(concatenate(Uint8Array,
                                   setLocal(idx, addressCode),
                                   ifExpression(getLocal(idx),
                                                i32Load(getLocal(idx), 1))));
    return [code, newLocals];
  }

  throw new Error('Not yet implemented');
}

// CL form -> WASM expression(s)
function compileExpression(formOrImmediate, locals, env) {
  if (Array.isArray(formOrImmediate)) {
    const [op, ...operands] = formOrImmediate;

    if (op.value === 'let') {
      const [bindings, ...exprs] = operands;

      const newBindings = {};
      const bindingLocals = [];
      for (const [nameToken] of bindings) {
        const name = nameToken.value;
        bindingLocals.push({ name, type: 'i32' });
        // localIndex starts at 1 because 0 is a parameter.
        // This is a straight-up hack
        const localIndex = locals.length + bindingLocals.length;
        newBindings[name] = localIndex;
      }

      const bindingCode = [];
      const localsAfterBindings = bindings.reduce((currentLocals, [name, expr]) => {
        const [code, modifiedLocals] = compileExpression(expr, currentLocals, env);
        bindingCode.push(setLocal(newBindings[name.value], code));
        return modifiedLocals;
      }, locals.concat(bindingLocals));

      const newEnv = Object.assign({}, env, newBindings);
      const bodyCode = [];
      const newLocals = exprs.reduce((currentLocals, expr) => {
        const [code, modifiedLocals] = compileExpression(expr, currentLocals, newEnv);
        bodyCode.push(code);
        return modifiedLocals;
      }, localsAfterBindings);

      return [block(concatenate(Uint8Array, ...bindingCode, ...bodyCode)), newLocals];
    } else if (op.value === 'if') {
      const [testForm, thenForm, elseForm] = operands;

      const [testCode, localsWithTest] = compileExpression(testForm, locals, env);
      const [thenCode, localsWithThen] = compileExpression(thenForm, localsWithTest, env);
      const [elseCode, localsWithElse] = elseForm ?
        compileExpression(elseForm, locals, env) : [undefined, localsWithThen];

      const code = ifExpression(testCode, thenCode, elseCode);
      return [code, localsWithElse];
    }

    return compilePrimitiveCall(formOrImmediate, locals, env);
  }

  if (formOrImmediate.type === TOKEN_TYPES.ID) {
    const name = formOrImmediate.value;
    if (!env.hasOwnProperty(name)) {
      throw new Error(`Undefined variable '${name}'`);
    }
    return [getLocal(env[name]), locals];
  }

  return [i32Const(immediateRepr(formOrImmediate)), locals];
}

function compileFunction(form) {
  const [code, locals] = compileExpression(form, [], {});
  const fb = functionBody(locals, returnNode(1, code));
  return fb;
}

const utf8Encoder = new TextEncoder('utf-8');

export default function compile(source) {
  const ast = parse(tokenize(source));
  const functions = [compileFunction(ast)];

  const sections = [
    preamble(11),
    typeSection(typeEntry(['i32'], 1, 'i32')),
    functionSection([0]),
    memorySection(2, 2),
    exportSection(exportEntry(0, utf8Encoder.encode('entry'))),
    codeSection(...functions),
    nameSection(nameEntry('entry', [])),
  ];

  return concatenate(Uint8Array, ...sections);
}
