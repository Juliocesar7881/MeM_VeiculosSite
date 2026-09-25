import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/lib/errors';
import { formDataOrEmpty, readFormData } from '@/server/http';
import { LIKE_PATTERN_MAX_BYTES, likeContains, searchTerms } from '@/utils/text';

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('likeContains (limite de 50 bytes do LIKE no Cloudflare D1)', () => {
  it('termo normal fica igual', () => {
    expect(likeContains('corolla')).toBe('%corolla%');
  });

  it('termo gigante é cortado para caber (antes: erro 500 "LIKE pattern too complex")', () => {
    const pattern = likeContains('a'.repeat(80));
    expect(bytes(pattern)).toBeLessThanOrEqual(LIKE_PATTERN_MAX_BYTES);
    expect(pattern).toBe(`%${'a'.repeat(48)}%`);
  });

  it('caracteres especiais escapados e acentos (2 bytes) também respeitam o limite', () => {
    for (const term of ['%'.repeat(60), '_\\'.repeat(40), 'é'.repeat(60), '🚗'.repeat(30)]) {
      expect(bytes(likeContains(term))).toBeLessThanOrEqual(LIKE_PATTERN_MAX_BYTES);
    }
    expect(likeContains('50%_off')).toBe('%50\\%\\_off%');
  });

  it('a busca usa no máximo 6 termos (limite de parâmetros do D1)', () => {
    expect(searchTerms('a b c d e f g h i j')).toHaveLength(6);
  });
});

describe('leitura de formulários', () => {
  const broken = () =>
    new Request('http://x/', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=zzz' },
      body: 'lixo-que-nao-e-form',
    });

  it('corpo malformado vira erro de validação (422), não erro 500', async () => {
    await expect(readFormData(broken())).rejects.toBeInstanceOf(ValidationError);
  });

  it('no painel, corpo malformado equivale a formulário vazio', async () => {
    const form = await formDataOrEmpty(broken());
    expect([...form.keys()]).toEqual([]);
  });
});
