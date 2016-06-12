import { TOKEN_TYPES, singleCharacterTokens, reservedWords } from './tokens';

function isDecimalDigit(ch) {
  return /^\d$/.test(ch);
}

function isHexDigit(ch) {
  return /^[\da-fA-F]$/.test(ch);
}

function isLetter(ch) {
  return /^[A-Za-z]$/.test(ch);
}

function isWhitespace(ch) {
  return /^\s$/.test(ch);
}

function isAlphanumeric(ch) {
  return isDecimalDigit(ch) || isLetter(ch);
}

export function tokenize(program) {
  let pos = 0;
  const tokens = [];

  while (pos < program.length) {
    let ch;
    while (isWhitespace(ch = program[pos])) {
      pos++;
    }

    // Read hexadecimal integer literal
    if (ch === '0') {
      pos++;
      if (program[pos] !== 'x') {
        throw new Error(`Unexpected character '${program[pos]}' following '0'. ` +
                         "Expected 'x' as part of hexadecimal literal");
      }
      pos++;

      ch = program[pos];
      if (!isHexDigit(ch)) {
        throw new Error(`Unexpected character '${program[pos]}' following '0x'. ` +
                        'Expected hexadecimal digit (0-9, a-f, A-F)');
      }

      const literalDigits = [ch];
      pos++;
      while (isHexDigit(ch = program[pos])) {
        literalDigits.push(ch);
        pos++;
      }
      const tokenVal = parseInt(literalDigits.join(''), 16);
      tokens.push({ type: TOKEN_TYPES.INTEGER,
                    value: tokenVal });
      continue;
    }

    // Read decimal integer literal
    if (isDecimalDigit(ch)) {
      const literalDigits = [ch];
      pos++;
      while (isDecimalDigit(ch = program[pos])) {
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
      ch = program[pos];
      while (isAlphanumeric(ch) || ch === '?') {
        chars.push(ch);
        ch = program[++pos];
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

function parseWithOffset(tokens, start) {
  if (tokens[start].type !== TOKEN_TYPES.OPEN_PAREN) {
    return [tokens[start], start + 1];
  }

  const ast = [];
  let pos = start + 1;

  while (pos < tokens.length) {
    const token = tokens[pos];
    if (token.type === TOKEN_TYPES.CLOSE_PAREN) {
      return [ast, pos + 1];
    }

    const [newTokens, newPos] = parseWithOffset(tokens, pos);
    ast.push(newTokens);
    pos = newPos;
  }

  throw new Error('Unexpected end of input');
}

export function parse(tokens) {
  const result = parseWithOffset(tokens, 0);
  return result[0];
}
