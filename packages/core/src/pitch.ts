/** Placeholders a pitch or subject may use; they are filled from the job when the email is sent. */
export const pitchVariables = [
  { key: 'empresa', label: 'Empresa da vaga' },
  { key: 'cargo', label: 'Cargo da vaga' },
  { key: 'recrutadora', label: 'Nome de quem recruta' },
  { key: 'nome', label: 'Seu nome (H1 do currículo)' },
] as const;
export type PitchVariable = (typeof pitchVariables)[number]['key'];
export type PitchValues = Partial<Record<PitchVariable, string>>;

export const maxPitchLength = 20000;
/** Version pitches kept in content/cv besides base.pitch.md; older ones are pruned. */
export const pitchLimit = 20;
/** Marks the paragraph of the starter pitch that still has to be written. */
export const pitchTodo = '[Escreva aqui';
export const defaultPitch = `Olá, {{recrutadora}}!

Vi a vaga de {{cargo}} na {{empresa}} e gostaria de me candidatar.

[Escreva aqui por que seu perfil combina com a vaga.]

Envio meu currículo em anexo e fico à disposição para conversarmos.

Atenciosamente,
{{nome}}
`;

export function validPitch(value: unknown): value is string {
  return typeof value === 'string' && value.length <= maxPitchLength;
}

/** The name in the first H1 of a resume, used as {{nome}}. */
export function resumeName(markdown: string) {
  return markdown.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim() ?? '';
}

const placeholder = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * Fills the placeholders of a pitch or subject. Unknown variables and known ones without a
 * value stay visible in the text and are reported, so the email is never sent half-filled.
 */
export function renderTemplate(text: string, values: PitchValues) {
  const unknown = new Set<string>();
  const missing = new Set<string>();
  const rendered = text.replace(placeholder, (match, key: string) => {
    if (!pitchVariables.some((v) => v.key === key)) {
      unknown.add(key);
      return match;
    }
    const value = values[key as PitchVariable]?.trim();
    if (!value) {
      missing.add(key);
      return match;
    }
    return value;
  });
  return { text: rendered, unknown: [...unknown], missing: [...missing] };
}

/** Variables a template uses that are not in pitchVariables. */
export function unknownVariables(text: string) {
  return renderTemplate(text, {}).unknown;
}
