import compile from './compile';

function compileAndExecute(source) {
  const view = compile(source);
  const wasmModule = Wasm.instantiateModule(view, {});
  return wasmModule.exports.entry();
}

console.log(compileAndExecute('238'));
console.log(compileAndExecute('0x2f42'));
console.log(compileAndExecute('true'));
console.log(compileAndExecute('false'));
console.log(String.fromCharCode(compileAndExecute("'\\x7E'")));
