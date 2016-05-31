export const TOKEN_TYPES = {
  OPEN_PAREN: 'OPEN_PAREN',
  CLOSE_PAREN: 'CLOSE_PAREN',
  ID: 'ID',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
};

export const singleCharacterTokens = {
  '(': { type: TOKEN_TYPES.OPEN_PAREN },
  ')': { type: TOKEN_TYPES.CLOSE_PAREN },
  '+': { type: TOKEN_TYPES.PLUS },
  '-': { type: TOKEN_TYPES.MINUS },
};

export const reservedWords = {
  true: { type: TOKEN_TYPES.BOOLEAN,
          value: true },
  false: { type: TOKEN_TYPES.BOOLEAN,
           value: false },
};
