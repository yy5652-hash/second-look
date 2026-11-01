import { describe, it, expect } from 'vitest';
import { isExternalResource } from '../src/ui/Privacy';

describe('live privacy counter', () => {
  const origin = 'https://app.example';
  it('counts requests to other sites', () => {
    expect(isExternalResource('https://tracker.example/p.gif', origin)).toBe(true);
    expect(isExternalResource('http://app.example/x', origin)).toBe(true);
    expect(isExternalResource('https://app.example.evil.test/x', origin)).toBe(true);
  });
  it('does not count the app itself or non-network URLs', () => {
    expect(isExternalResource('https://app.example/assets/a.js', origin)).toBe(false);
    expect(isExternalResource('blob:https://app.example/1', origin)).toBe(false);
    expect(isExternalResource('data:image/png;base64,AAAA', origin)).toBe(false);
    expect(isExternalResource('not a url', origin)).toBe(false);
  });
});
