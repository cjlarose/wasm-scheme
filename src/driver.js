import compile from './compile';
import { tokenize } from './parse';

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

console.log(tokenize('())))()((()()'));
console.log(tokenize('8237492834(()))))'));
console.log(tokenize('8237492834 (()))))'));
console.log(tokenize('8237492834 true false ( )'));
console.log(tokenize('hello     my true name is    chris'));
