import compile from './compile';

function compileAndExecute(source) {
  const view = compile(source);
  const wasmModule = Wasm.instantiateModule(view, {});
  return wasmModule.exports.entry();
}

// literals
console.log(compileAndExecute('238'));
// console.log(compileAndExecute('-238'));
console.log(compileAndExecute('0x1'));
console.log(compileAndExecute('0x99ccff'));
console.log(compileAndExecute('true'));
console.log(compileAndExecute('false'));
//console.log(String.fromCharCode(compileAndExecute("'\\x7E'")));

// unary operations
console.log(compileAndExecute('(negate 238)'));
console.log(compileAndExecute('(negate 0xff)'));
console.log(compileAndExecute('(not true)'));
console.log(compileAndExecute('(not false)'));
