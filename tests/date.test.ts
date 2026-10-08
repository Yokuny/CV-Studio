import { describe, expect, it } from 'vitest';
import { formatDate } from '../apps/web/src/lib/date';

describe('datas exibidas no front-end', () => {
  it('usa dia com dois dígitos, mês abreviado sem ponto e ano curto', () => {
    expect(formatDate('2026-06-09')).toBe('09 jun 26');
    expect(formatDate('2026-01-01')).toBe('01 jan 26');
    expect(formatDate('2026-12-31')).toBe('31 dez 26');
  });

  it('aceita timestamps e objetos Date', () => {
    const date = new Date(2026, 5, 9, 14, 30);
    expect(formatDate(date)).toBe('09 jun 26');
    expect(formatDate(date.toISOString())).toBe('09 jun 26');
  });

  it('mostra um traço para datas ausentes ou inválidas', () => {
    for (const date of [null, undefined, '', 'inválida', new Date(Number.NaN)]) {
      expect(formatDate(date)).toBe('—');
    }
  });
});
