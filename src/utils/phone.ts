/**
 * Normaliza um telefone brasileiro para dígitos com DDI 55.
 * Aceita "(47) 99999-8888", "47999998888", "+55 47 99999-8888", "5547999998888".
 * Retorna null quando não parece um telefone brasileiro válido.
 */
export function normalizeBrazilPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Número com "+" explícito de outro país (ex.: +1) não é brasileiro.
  if ((trimmed.startsWith('+') || trimmed.startsWith('00')) && !digits.startsWith('55')) return null;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!digits.startsWith('55')) return null;
  if (digits.length !== 12 && digits.length !== 13) return null;
  const ddd = Number(digits.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  return digits;
}

/** "5547999998888" -> "(47) 99999-8888" ; "554896410338" -> "(48) 9641-0338" */
export function formatBrazilPhone(digits: string): string {
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const number = local.slice(2);
  if (number.length === 9) return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  if (number.length === 8) return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  return digits;
}

/** Link tel: a partir do telefone de exibição ou dígitos. */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `tel:+${digits}`;
}
