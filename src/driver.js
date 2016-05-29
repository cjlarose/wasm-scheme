import compile from './compile';

function compileAndExecute(source) {
  const view = compile(source);
  const wasmModule = Wasm.instantiateModule(view, {});

  console.log(wasmModule.exports.entry());
}

compileAndExecute('238');
compileAndExecute('0x2f42');
