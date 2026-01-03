import { test, expect, describe } from 'bun:test';
import { normalizeCode, extractTokens, calculateSimilarity } from '../src/plagiarism.js';

describe('normalizeCode', () => {
  test('removes single-line comments', () => {
    const code = `
      // This is a comment
      const x = 5; // inline comment
    `;
    const normalized = normalizeCode(code);

    expect(normalized).not.toContain('comment');
    expect(normalized).toContain('const x = 5');
  });

  test('removes multi-line comments', () => {
    const code = `
      /* This is a
         multi-line comment */
      const x = 5;
    `;
    const normalized = normalizeCode(code);

    expect(normalized).not.toContain('multi-line');
    expect(normalized).toContain('const x = 5');
  });

  test('removes Python-style comments', () => {
    const code = `
      # This is a Python comment
      x = 5
    `;
    const normalized = normalizeCode(code);

    expect(normalized).not.toContain('Python');
    expect(normalized).toContain('x = 5');
  });

  test('collapses whitespace', () => {
    const code = `const   x   =   5;`;
    const normalized = normalizeCode(code);

    expect(normalized).toBe('const x = 5;');
  });

  test('converts to lowercase', () => {
    const code = `CONST X = 5;`;
    const normalized = normalizeCode(code);

    expect(normalized).toBe('const x = 5;');
  });
});

describe('extractTokens', () => {
  test('replaces variable declarations with VAR', () => {
    const code = `const myVariable = 5;`;
    const tokens = extractTokens(code);

    expect(tokens).toContain('const VAR');
    expect(tokens).not.toContain('myVariable');
  });

  test('replaces function calls with FUNC', () => {
    const code = `myFunction(arg1, arg2)`;
    const tokens = extractTokens(code);

    expect(tokens).toContain('FUNC(');
    expect(tokens).not.toContain('myFunction');
  });

  test('replaces strings with STRING', () => {
    const code = `const msg = "Hello World";`;
    const tokens = extractTokens(code);

    expect(tokens).toContain('STRING');
    expect(tokens).not.toContain('Hello');
  });

  test('replaces numbers with NUM', () => {
    const code = `const x = 42; const y = 3.14;`;
    const tokens = extractTokens(code);

    expect(tokens).toContain('NUM');
    expect(tokens).not.toContain('42');
    expect(tokens).not.toContain('3.14');
  });
});

describe('calculateSimilarity', () => {
  test('returns 1.0 for identical strings', () => {
    const similarity = calculateSimilarity('hello world', 'hello world');

    expect(similarity).toBe(1.0);
  });

  test('returns 0.0 for completely different strings', () => {
    const similarity = calculateSimilarity('abc', 'xyz');

    expect(similarity).toBe(0);
  });

  test('returns 1.0 for empty strings', () => {
    const similarity = calculateSimilarity('', '');

    expect(similarity).toBe(1.0);
  });

  test('returns 0.0 when one string is empty', () => {
    const similarity1 = calculateSimilarity('hello', '');
    const similarity2 = calculateSimilarity('', 'world');

    expect(similarity1).toBe(0);
    expect(similarity2).toBe(0);
  });

  test('returns high similarity for similar strings', () => {
    const similarity = calculateSimilarity('hello world', 'hello worlD');

    expect(similarity).toBeGreaterThan(0.9);
  });

  test('returns moderate similarity for somewhat similar strings', () => {
    const similarity = calculateSimilarity('function add', 'function sum');

    expect(similarity).toBeGreaterThan(0.5);
    expect(similarity).toBeLessThan(0.9);
  });
});

describe('plagiarism detection (integration)', () => {
  test('detects similar code with different variable names', () => {
    const code1 = `
      function calculateTotal(items) {
        let total = 0;
        for (const item of items) {
          total += item.price * item.quantity;
        }
        return total;
      }
    `;

    const code2 = `
      function computeSum(products) {
        let sum = 0;
        for (const product of products) {
          sum += product.price * product.quantity;
        }
        return sum;
      }
    `;

    const tokens1 = extractTokens(code1);
    const tokens2 = extractTokens(code2);

    const similarity = calculateSimilarity(tokens1, tokens2);

    // These should be similar after tokenization (variable renaming detection)
    expect(similarity).toBeGreaterThan(0.65);
  });

  test('detects identical code after normalization', () => {
    const code1 = `
      // Original code
      function add(a, b) {
        return a + b;
      }
    `;

    const code2 = `
      // Copied with different comment
      function add(a, b) {
        return a + b;
      }
    `;

    const normalized1 = normalizeCode(code1);
    const normalized2 = normalizeCode(code2);

    const similarity = calculateSimilarity(normalized1, normalized2);

    expect(similarity).toBe(1.0);
  });

  test('does not flag completely different code', () => {
    const code1 = `
      function fibonacci(n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
      }
    `;

    const code2 = `
      class User {
        constructor(name, email) {
          this.name = name;
          this.email = email;
        }
      }
    `;

    const tokens1 = extractTokens(code1);
    const tokens2 = extractTokens(code2);

    const similarity = calculateSimilarity(tokens1, tokens2);

    expect(similarity).toBeLessThan(0.5);
  });
});
