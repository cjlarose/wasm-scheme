import compile from './compile';

function compileAndExecute(source) {
  const view = compile(source);
  const wasmModule = Wasm.instantiateModule(view, {});
  return wasmModule.exports.entry(0);
}

// literals
console.log('Literals');
console.log(compileAndExecute('238') >> 2);
// console.log(compileAndExecute('-238'));
console.log(compileAndExecute('0x1') >> 2);
console.log(compileAndExecute('0x99ccff') >> 2);
console.log(compileAndExecute('t') >> 2);
console.log(compileAndExecute('nil') >> 2);
//console.log(String.fromCharCode(compileAndExecute("'\\x7E'")));

// unary operations
console.log('Unary operations');
console.log(compileAndExecute('(not t)') >> 2);
console.log(compileAndExecute('(not nil)') >> 2);

console.log(compileAndExecute('(fixnum? 238)') >> 2);
console.log(compileAndExecute('(fixnum? nil)') >> 2);

console.log(compileAndExecute('(boolean? 238)') >> 2);
console.log(compileAndExecute('(boolean? nil)') >> 2);

// binary operations
console.log('Binary operations');
console.log(compileAndExecute('(+ 55)') >> 2);
console.log(compileAndExecute('(+ 45 55)') >> 2);
console.log(compileAndExecute('(+ 45 55 50)') >> 2);
console.log(compileAndExecute('(+ 45 55 50 100)') >> 2);

console.log(compileAndExecute('(- 55)') >> 2);
console.log(compileAndExecute('(- 55 5)') >> 2);
console.log(compileAndExecute('(- 45 55 50)') >> 2);
console.log(compileAndExecute('(- 45 55 50 100)') >> 2);

// local variables
console.log('Local variables');
console.log(compileAndExecute('(let ((a 0xFF) (b 1)) (+ a b))') >> 2);

// conditionals
console.log('Conditionals');
console.log(compileAndExecute('(if t 1 2)') >> 2);
console.log(compileAndExecute('(if nil 1 2)') >> 2);
console.log(compileAndExecute('(if nil 1)') >> 2);

// conses
console.log('Conses');
console.log(compileAndExecute('(cons 1 2)') >> 2);
console.log(compileAndExecute('(cons 1 nil)') >> 2);
console.log(compileAndExecute(`(let ()
                                 (cons 1 nil)
                                 (cons 2 3))`));
console.log(compileAndExecute('(car (cons 8 2))') >> 2);
