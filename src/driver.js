import compile from './compile';

//const view = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x0b, 0x00, 0x00, 0x00]);
const view = compile();
const wasmModule = Wasm.instantiateModule(view, {});

console.log(wasmModule.exports.entry());
