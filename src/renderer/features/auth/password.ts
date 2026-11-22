/** The rule the backend enforces too: at least 8 characters, a letter and a digit. */
export function meetsPasswordRules(password: string): boolean {
  return password.length >= 8 && /\p{L}/u.test(password) && /\d/.test(password)
}

export type Strength = 0 | 1 | 2 | 3 | 4

/**
 * 0 for an empty field; otherwise one point each for the length, a letter with a digit, mixed
 * case, and a symbol or a length of 12+. Below the rules it never climbs past "weak".
 */
export function passwordStrength(password: string): Strength {
  if (!password) return 0
  if (!meetsPasswordRules(password)) return 1
  let score = 2
  if (/\p{Lu}/u.test(password) && /\p{Ll}/u.test(password)) score++
  if (/[^\p{L}\d]/u.test(password) || password.length >= 12) score++
  return Math.min(score, 4) as Strength
}

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())

/** d••••s@example.com: enough to recognise the address without showing all of it. */
export function maskEmail(email: string): string {
  const [name, domain] = email.trim().split('@')
  if (!name || !domain) return email
  if (name.length <= 2) return `${name[0]}••••@${domain}`
  return `${name[0]}••••${name[name.length - 1]}@${domain}`
}
