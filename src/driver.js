import compile from './compile';
import parse from './parse';

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

// console.log(tokenize('())))()((()()'));
// console.log(tokenize('8237492834(()))))'));
// console.log(tokenize('8237492834 (()))))'));
// console.log(tokenize('8237492834 true false ( )'));
// console.log(tokenize('hello     my true name is    chris'));

console.log(JSON.stringify(parse('(())')));
console.log(JSON.stringify(parse('(hello (238902 true) ((()) false))')));
