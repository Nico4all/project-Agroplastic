export function cleanDisplayText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeDescription(value: string) {
  return cleanDisplayText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('es-CO');
}

export function normalizeIdentityDocument(value: string) {
  return value.trim().toLocaleUpperCase('es-CO').replace(/[^A-Z0-9]/g, '');
}

export function normalizeDocumentSuffix(value: string) {
  return cleanDisplayText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('es-CO')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
