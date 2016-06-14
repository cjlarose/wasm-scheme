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

function compilePrimitiveCall(formOrImmediate, locals, env, functions) {
  const [op, ...operands] = formOrImmediate;

  if (op.value === 'not') {
    const [operandCode, newLocals] = compileExpression(operands[0], locals, env, functions);
    return [markBoolean(i32.eqz(i32.shrU(operandCode, i32Const(2)))), newLocals, functions];
  } else if (op.value === 'fixnum?') {
    const [operandCode, newLocals] = compileExpression(operands[0], locals, env, functions);
    const code = markBoolean(i32.eq(extractTag(operandCode), i32Const(FIXNUM_TAG)));
    return [code, newLocals, functions];
  } else if (op.value === 'boolean?') {
    const [operandCode, newLocals] = compileExpression(operands[0], locals, env, functions);
    const code = markBoolean(i32.eq(extractTag(operandCode), i32Const(BOOLEAN_TAG)));
    return [code, newLocals, functions];
  } else if (op.type === TOKEN_TYPES.PLUS) {
    const [ast, newLocals] = operands.reduce(([expr, currentLocals], operand) => {
      const [operandCode, modifiedLocals] =
        compileExpression(operand, currentLocals, env, functions);
      const newExpr = i32.add(expr, extractFixnum(operandCode));
      return [newExpr, modifiedLocals];
    }, [i32Const(0), locals]);
    return [markFixnum(ast), newLocals, functions];
  } else if (op.type === TOKEN_TYPES.MINUS) {
    if (operands.length === 1) {
      const [operandCode, newLocals] = compileExpression(operands[0], locals, env, functions);
      const code = markFixnum(i32.sub(i32Const(0), extractFixnum(operandCode)));
      return [code, newLocals, functions];
    }

    const [minuendAst, ...subtrahends] = operands;
    const [minuendCode, startingLocals] = compileExpression(minuendAst, locals, env, functions);
    const minuend = extractFixnum(minuendCode);

    const [ast, newLocals] = subtrahends.reduce(([expr, currentLocals], operand) => {
      const [operandCode, modifiedLocals] =
        compileExpression(operand, currentLocals, env, functions);
      const newExpr = i32.sub(expr, extractFixnum(operandCode));
      return [newExpr, modifiedLocals];
    }, [minuend, startingLocals]);
    return [markFixnum(ast), newLocals, functions];
  } else if (op.value === 'cons') {
    const [carForm, cdrForm] = operands;
    const [carCode, localsAfterCar] = compileExpression(carForm, locals, env, functions);
    const [cdrCode, localsAfterCdr] = compileExpression(cdrForm, localsAfterCar, env, functions);

    const newLocals = localsAfterCdr.concat([{ type: 'i32' }, { type: 'i32' }]);
    const carLocal = newLocals.length - 1;
    const cdrLocal = newLocals.length;

    const code = block(concatenate(Uint8Array,
                                   setLocal(carLocal, carCode),
                                   setLocal(cdrLocal, cdrCode),
                                   i32Store(getLocal(0), getLocal(carLocal)),
                                   i32Store(getLocal(0), getLocal(cdrLocal), 4),
                                   markCons(alloc(newLocals, 8))));
    return [code, newLocals, functions];
  } else if (op.value === 'car') {
    const [valForm] = operands;
    const [addressCode, localsAfterAddress] = compileExpression(valForm, locals, env, functions);
    const newLocals = localsAfterAddress.concat([{ type: 'i32' }]);
    const idx = newLocals.length;
    const code = block(concatenate(Uint8Array,
                                   setLocal(idx, addressCode),
                                   ifExpression(getLocal(idx),
                                                i32Load(i32.sub(getLocal(idx),
                                                                i32Const(CONS_TAG))))));
    return [code, newLocals, functions];
  } else if (op.value === 'cdr') {
    const [valForm] = operands;
    const [addressCode, localsAfterAddress] = compileExpression(valForm, locals, env, functions);
    const newLocals = localsAfterAddress.concat([{ type: 'i32' }]);
    const idx = newLocals.length;
    const code = block(concatenate(Uint8Array,
                                   setLocal(idx, addressCode),
                                   ifExpression(getLocal(idx),
                                                i32Load(getLocal(idx), 1))));
    return [code, newLocals, functions];
  }

  throw new Error('Not yet implemented');
}

// CL form -> WASM expression(s)
function compileExpression(formOrImmediate, locals, env, functions) {
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
        const [code, modifiedLocals] = compileExpression(expr, currentLocals, env, functions);
        bindingCode.push(setLocal(newBindings[name.value], code));
        return modifiedLocals;
      }, locals.concat(bindingLocals));

      const newEnv = Object.assign({}, env, newBindings);
      const bodyCode = [];
      const newLocals = exprs.reduce((currentLocals, expr) => {
        const [code, modifiedLocals] = compileExpression(expr, currentLocals, newEnv, functions);
        bodyCode.push(code);
        return modifiedLocals;
      }, localsAfterBindings);

      return [block(concatenate(Uint8Array, ...bindingCode, ...bodyCode)), newLocals, functions];
    } else if (op.value === 'if') {
      const [testForm, thenForm, elseForm] = operands;

      const [testCode, localsWithTest] = compileExpression(testForm, locals, env, functions);
      const [thenCode, localsWithThen] =
        compileExpression(thenForm, localsWithTest, env, functions);
      const [elseCode, localsWithElse] = elseForm ?
        compileExpression(elseForm, locals, env, functions) : [undefined, localsWithThen];

      const code = ifExpression(testCode, thenCode, elseCode);
      return [code, localsWithElse, functions];
    }

    return compilePrimitiveCall(formOrImmediate, locals, env, functions);
  }

  if (formOrImmediate.type === TOKEN_TYPES.ID) {
    const name = formOrImmediate.value;
    if (!env.hasOwnProperty(name)) {
      throw new Error(`Undefined variable '${name}'`);
    }
    return [getLocal(env[name]), locals, functions];
  }

  return [i32Const(immediateRepr(formOrImmediate)), locals, functions];
}

// compileLambda -> exprAst -> (WASM code for (closure), WASM code for a bunch of function defintions)
// compileLambda((lambda () (+ x y))) => (closure f0 x y), { f0: (i32.add $x $y) }
// compileLambda((lambda (y) (lambda () (+ x y)))) => (closure f1 x y), { f0: (i32.add $x $y), f1: <pointer to closure f0> }
// compileExpression((+ a b)) => (i32.add (get_local $a) (get_local $b)), {}
// compileExpression((+ a (lambda () (let ((b 2)) b)))) => (i32.add (get_local $a) (closure f0)), { f0: (get_local $b) }
// compileSource -> exprAst -> WASM code for the entire module

function compileFunctions(form) {
  const [code, locals, functions] = compileExpression(form, [], {}, []);
  const entryFunction = {
    name: 'entry',
    returnCount: 1,
    returnType: 'i32',
    bodyAst: code,
    locals,
    params: [{ type: 'i32' }],
  };
  functions.push(entryFunction);
  return {
    version: 11,
    memory: { initial: 2, maximum: 2 },
    functions,
  };
  // produce topLevelFunctions, expression
  /*
  (let ((x 5))
    (lambda (y) (lambda () (+ x y)))) // while compiling, anytime a lambda is
                                      // encountered, a new fn is added to the
                                      // fn list in it's place, a call to
                                      // (closure x) is added when compiling a
                                      // lambda, keep track of defined
                                      // variables and referenced variables.
                                      // Free variables are those that are
                                      // referenced, in scope, but never
                                      // defined (as in a let binding)

  (labels ((f0 (code () (x y) (+ x y))) // WASM function with empty environment
           (f1 (code (y) (x) (closure f0 x y)))) // WASM function with env
                                                 // { f0: indirectFnIdx/signatureIndex }
    (let ((x 5)) (closure f1 x))) // yet another WASM function "entry" with env
                                  // { f0: 0, f1: 1 }
                                  // Treat like (code () () (let ((...)) (...)))

  [ { name: "\0",
      returnCount: 1,
      returnType: 'i32',
      codeAst: ["cons", "1",  ["cons", "2", "nil"]] },
    { name: "\1",
      returnCount: 1,
      returnType: 'i32' },
    { name: "entry",
      returnCount: 1,
      returnType: 'i32' } ]
  */
}

const utf8Encoder = new TextEncoder('utf-8');

function compileModule({ version, memory, functions }) {
  const functionEntries = functions.map(({ locals, bodyAst }) => functionBody(locals, bodyAst));
  const nameEntries = functions.map(({ name }) => nameEntry(name, []));
  const typeEntries = functions.map(({ params, returnCount, returnType }) =>
    typeEntry(params.map(p => p.type), returnCount, returnType));

  const sections = [
    preamble(version),
    typeSection(...typeEntries),
    functionSection([...Array(functions.length).keys()]),
    memorySection(memory.initial, memory.maximum),
    exportSection(exportEntry(0, utf8Encoder.encode('entry'))),
    codeSection(...functionEntries),
    nameSection(...nameEntries),
  ];

  return concatenate(Uint8Array, ...sections);
}

export default function compile(source) {
  const ast = parse(tokenize(source));
  const moduleDescription = compileFunctions(ast);
  return compileModule(moduleDescription);
}
