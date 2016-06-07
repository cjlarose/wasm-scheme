import compile from './compile';

function compileAndExecute(source) {
  console.log(source);
  const view = compile(source);
  const wasmModule = Wasm.instantiateModule(view, {});
  const result = wasmModule.exports.entry(0);
  console.log(result >> 2);
}

// literals
console.log('Literals');
compileAndExecute('238');
// compileAndExecute('-238');
compileAndExecute('0x1');
compileAndExecute('0x99ccff');
compileAndExecute('t');
compileAndExecute('nil');
//String.fromCharCode(compileAndExecute("'\\x7E'"));

// unary operations
console.log('Unary operations');
compileAndExecute('(not t)');
compileAndExecute('(not nil)');

compileAndExecute('(fixnum? 238)');
compileAndExecute('(fixnum? nil)');

compileAndExecute('(boolean? 238)');
compileAndExecute('(boolean? nil)');

// binary operations
console.log('Binary operations');
compileAndExecute('(+ 55)');
compileAndExecute('(+ 45 55)');
compileAndExecute('(+ 45 55 50)');
compileAndExecute('(+ 45 55 50 100)');

compileAndExecute('(- 55)');
compileAndExecute('(- 55 5)');
compileAndExecute('(- 45 55 50)');
compileAndExecute('(- 45 55 50 100)');

// local variables
console.log('Local variables');
compileAndExecute('(let ((a 0xFF) (b 1)) (+ a b))');

// conditionals
console.log('Conditionals');
compileAndExecute('(if t 1 2)');
compileAndExecute('(if nil 1 2)');
compileAndExecute('(if nil 1)');

// conses
console.log('Conses');
compileAndExecute('(cons 1 2)');
compileAndExecute('(cons 1 nil)');
compileAndExecute(`(let ()
                     (cons 1 nil)
                     (cons 2 3))`);
compileAndExecute('(car (cons 8 2))');
compileAndExecute('(car nil)');
compileAndExecute('(cdr (cons 8 104))');
compileAndExecute('(cdr nil)');

compileAndExecute('(cons 5 nil)');
compileAndExecute('(cons 8 (cons 5 nil))');
compileAndExecute('(car (cons 8 (cons 5 nil)))');
compileAndExecute('(let ((a (cons 8 (cons 5 nil)))) (car a))');
compileAndExecute('(cdr (cons 8 (cons 5 nil)))');
compileAndExecute('(car (cdr (cons 8 (cons 5 nil))))');
