import compile from './compile';

// http://stackoverflow.com/a/18197341/1231384
function download(filename, url) {
  const element = document.createElement('a');
  element.setAttribute('href', url);
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function downloadCode(source) {
  const view = compile(source);
  const url = URL.createObjectURL(new Blob([view], { type: 'application/octet-stream' }));
  download('wasmtest.wasm', url);
}

function compileAndExecute(source) {
  const view = compile(source);
  const wasmModule = Wasm.instantiateModule(view, {});
  return wasmModule.exports.entry(0);
}

function taggedFixnum(num) {
  return num << 2 | 1;
}

function taggedBoolean(val) {
  return val << 2 | 2;
}

function taggedCons(val) {
  return val + 3;
}

describe('Compiling literals', () => {
  it('handles integers in decimal notation', () => {
    expect(compileAndExecute('238')).toBe(taggedFixnum(238));
  });

  it('handles integers in hexadecimal notation', () => {
    expect(compileAndExecute('0x1')).toBe(taggedFixnum(1));
    expect(compileAndExecute('0x99ccff')).toBe(taggedFixnum(10079487));
  });

  it('handles boolean literals', () => {
    expect(compileAndExecute('t')).toBe(taggedBoolean(true));
    expect(compileAndExecute('nil')).toBe(taggedBoolean(false));
  });
});

describe('The not operation', () => {
  it('negates simple boolean expressions', () => {
    expect(compileAndExecute('(not t)')).toBe(taggedBoolean(false));
    expect(compileAndExecute('(not nil)')).toBe(taggedBoolean(true));
  });

  it('negates complex boolean expressions', () => {
    expect(compileAndExecute('(not (not t))')).toBe(taggedBoolean(true));
    expect(compileAndExecute('(not (not (not t)))')).toBe(taggedBoolean(false));
  });
});

describe('The fixnum? predicate', () => {
  it('returns true for fixnums', () => {
    expect(compileAndExecute('(fixnum? 238)')).toBe(taggedBoolean(true));
  });

  it('returns false for booleans', () => {
    expect(compileAndExecute('(fixnum? nil)')).toBe(taggedBoolean(false));
  });
});

describe('The boolean? predicate', () => {
  it('returns false for fixnums', () => {
    expect(compileAndExecute('(boolean? 238)')).toBe(taggedBoolean(false));
  });

  it('returns true for booleans', () => {
    expect(compileAndExecute('(boolean? nil)')).toBe(taggedBoolean(true));
  });
});

describe('The plus operation', () => {
  it('does nothing to a single positive integer', () => {
    expect(compileAndExecute('(+ 55)')).toBe(taggedFixnum(55));
  });

  it('adds two fixnums', () => {
    expect(compileAndExecute('(+ 45 55)')).toBe(taggedFixnum(100));
  });

  it('adds more than one fixnum', () => {
    expect(compileAndExecute('(+ 45 55 50)')).toBe(taggedFixnum(150));
    expect(compileAndExecute('(+ 45 55 50 100)')).toBe(taggedFixnum(250));
  });
});

describe('The minus operation', () => {
  it('negates a single positive integer', () => {
    expect(compileAndExecute('(- 55)')).toBe(taggedFixnum(-55));
  });

  it('subtracts one fixnum from another', () => {
    expect(compileAndExecute('(- 55 5)')).toBe(taggedFixnum(50));
  });

  it('subtracts several fixnums in sequence', () => {
    expect(compileAndExecute('(- 55 5 50)')).toBe(taggedFixnum(0));
    expect(compileAndExecute('(- 55 5 50 100)')).toBe(taggedFixnum(-100));
  });
});

describe('The let form', () => {
  it('binds values to named variables', () => {
    expect(compileAndExecute('(let ((a 255) (b 1)) (+ a b))')).toBe(taggedFixnum(256));
  });

  it('uses environment defined by parent expression', () => {
    const source = '(let ((a 255)) (let ((a 5) (b a)) (+ a b)))';
    expect(compileAndExecute(source)).toBe(taggedFixnum(260));
  });
});

describe('The if form', () => {
  it('yields the second argument if the test evaluates to non-nil', () => {
    expect(compileAndExecute('(if t 1 2)')).toBe(taggedFixnum(1));
  });

  it('yields the third argument if the test evaluates to nil', () => {
    expect(compileAndExecute('(if nil 1 2)')).toBe(taggedFixnum(2));
  });

  it('yields nil if the test evaluates to nil and no third argument is provided', () => {
    expect(compileAndExecute('(if nil 1)')).toBe(taggedBoolean(false));
  });
});

describe('The cons function', () => {
  it('allocates a list at memory location 0', () => {
    expect(compileAndExecute('(cons 1 2)')).toBe(taggedCons(0));
  });

  it('allocates a second list at memory location 8', () => {
    expect(compileAndExecute('(cons 8 (cons 5 nil))')).toBe(taggedCons(8));
  });
});

describe('The car function', () => {
  it('yields nil for a nil input', () => {
    expect(compileAndExecute('(car nil)')).toBe(taggedBoolean(false));
  });

  it('yields the first element of a cons', () => {
    expect(compileAndExecute('(car (cons 13 17))')).toBe(taggedFixnum(13));
  });

  it('yields a pointer to a cons if the car of the cons is another cons', () => {
    expect(compileAndExecute('(car (cons (cons 5 2) nil))')).toBe(taggedCons(0));
  });
});

describe('The cdr function', () => {
  it('yields nil for a nil input', () => {
    expect(compileAndExecute('(cdr nil)')).toBe(taggedBoolean(false));
  });

  it('yields the second element of a cons', () => {
    expect(compileAndExecute('(cdr (cons 13 17))')).toBe(taggedFixnum(17));
  });

  it('yields a pointer to a cons if the cdr of the cons is another cons', () => {
    expect(compileAndExecute('(cdr (cons nil (cons 5 2)))')).toBe(taggedCons(0));
  });
});

describe('Lambdas', () => {
  it('without parameters are evaluated when called', () => {
    const source = '(let ((f (lambda () (+ 7 3)))) (f))';
    expect(compileAndExecute(source)).toBe(taggedFixnum(10));
  });

  /*
  it('with parameters have access to arguments', () => {
    const source = '(let ((f (lambda (x) (+ 2 x)))) (f 3))';
    expect(compileAndExecute(source)).toBe(taggedBoolean(taggedFixnum(5)));
  });

  it('can include lambda defintions', () => {
  });

  it('close over variables available in the scope in which they were defined', () => {
  });
  */
});
