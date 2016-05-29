import compile from './compile';

const view = compile("238");
const wasmModule = Wasm.instantiateModule(view, {});

console.log(wasmModule.exports.entry());
