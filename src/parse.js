const TOKEN_TYPES = {
  OPEN_PAREN: 'OPEN_PAREN',
  CLOSE_PAREN: 'CLOSE_PAREN',
  ID: 'ID',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
};

const singleCharacterTokens = {
  '(': { type: TOKEN_TYPES.OPEN_PAREN },
  ')': { type: TOKEN_TYPES.CLOSE_PAREN },
};

const reservedWords = {
  true: { type: TOKEN_TYPES.BOOLEAN,
          value: true },
  false: { type: TOKEN_TYPES.BOOLEAN,
           value: false },
};

function isDigit(ch) {
  return /^\d$/.test(ch);
}

function isLetter(ch) {
  return /^[A-Za-z]$/.test(ch);
}

function isWhitespace(ch) {
  return /^\s$/.test(ch);
}

function isAlphanumeric(ch) {
  return isDigit(ch) || isLetter(ch);
}

export function tokenize(program) {
  let pos = 0;
  const tokens = [];

  while (pos < program.length) {
    let ch;
    while (isWhitespace(ch = program[pos])) {
      pos++;
    }

    // Read decimal integer literal
    if (isDigit(ch)) {
      const literalDigits = [ch];
      pos++;
      while (isDigit(ch = program[pos])) {
        literalDigits.push(ch);
        pos++;
      }
      const tokenVal = parseInt(literalDigits.join(''), 10);
      tokens.push({ type: TOKEN_TYPES.INTEGER,
                    value: tokenVal });
      continue;
    }

    // Read reserved word or identifier
    if (isLetter(ch)) {
      const chars = [ch];
      pos++;
      while (isAlphanumeric(ch = program[pos])) {
        chars.push(ch);
        pos++;
      }
      const lexeme = chars.join('');
      const reservedWordToken = reservedWords[lexeme];
      if (reservedWordToken) {
        tokens.push(reservedWordToken);
        continue;
      }
      tokens.push({ type: TOKEN_TYPES.ID,
                    value: lexeme });
      continue;
    }

    // Read single-character token
    const token = singleCharacterTokens[ch];
    if (!token) {
      throw new Error(`Unexpected token '${ch}'`);
    }
    tokens.push(token);
    pos++;
  }

  return tokens;
}

function parse(tokens, start) {
  const ast = [];
  let pos = start;
  if (tokens[pos].type !== TOKEN_TYPES.OPEN_PAREN) {
    throw new Error(`Unexpected token type '${tokens[pos].type}'`);
  }
  pos++;

  while (pos < tokens.length) {
    const token = tokens[pos];
    if (token.type === TOKEN_TYPES.CLOSE_PAREN) {
      return [ast, pos + 1];
    } else if (token.type === TOKEN_TYPES.OPEN_PAREN) {
      const [newTokens, newPos] = parse(tokens, pos);
      ast.push(newTokens);
      pos = newPos;
    } else {
      ast.push(token);
      pos++;
    }
  }

  throw new Error('Unexpected end of input');
}

export default function parseProgram(source) {
  const tokens = tokenize(source);
  const result = parse(tokens, 0);
  return result[0];
}
