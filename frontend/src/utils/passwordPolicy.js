/** Política única de senha usada por todos os formulários do frontend. */
export const PASSWORD_RULES = Object.freeze([
  { id: 'length', label: 'Pelo menos 10 caracteres', test: (value) => String(value || '').length >= 10 },
  { id: 'uppercase', label: 'Uma letra maiúscula', test: (value) => /[A-Z]/.test(String(value || '')) },
  { id: 'lowercase', label: 'Uma letra minúscula', test: (value) => /[a-z]/.test(String(value || '')) },
  { id: 'number', label: 'Um número', test: (value) => /\d/.test(String(value || '')) },
  { id: 'symbol', label: 'Um caractere especial', test: (value) => /[^A-Za-z0-9]/.test(String(value || '')) }
]);

export const isStrongPassword = (value) => PASSWORD_RULES.every((rule) => rule.test(value));

