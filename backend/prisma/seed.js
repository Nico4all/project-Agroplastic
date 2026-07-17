const { PrismaClient } = require('@prisma/client');
const { readFile, readdir } = require('fs/promises');
const { join } = require('path');

const prisma = new PrismaClient();
const dataDirectory = join(__dirname, 'seed-data');

function cleanDisplayText(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeDescription(value) {
  return cleanDisplayText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('es-CO');
}

function normalizeIdentityDocument(value) {
  return value.trim().toLocaleUpperCase('es-CO').replace(/[^A-Z0-9]/g, '');
}

function parseTsv(contents) {
  return contents
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => line.split('\t'));
}

async function seedClients() {
  const files = (await readdir(dataDirectory))
    .filter((name) => /^clients-\d+\.tsv$/.test(name))
    .sort();

  for (const file of files) {
    const rows = parseTsv(await readFile(join(dataDirectory, file), 'utf8'));
    await prisma.client.createMany({
      data: rows.map(([identityDocument, fullName]) => ({
        fullName: cleanDisplayText(fullName),
        identityDocument: cleanDisplayText(identityDocument).toLocaleUpperCase('es-CO'),
        identityDocumentKey: normalizeIdentityDocument(identityDocument),
      })),
      skipDuplicates: true,
    });
  }
}

async function seedProducts() {
  const rows = parseTsv(await readFile(join(dataDirectory, 'products.tsv'), 'utf8'));
  await prisma.product.createMany({
    data: rows.map(([description]) => ({
      description: cleanDisplayText(description),
      normalizedDescription: normalizeDescription(description),
    })),
    skipDuplicates: true,
  });
}

async function main() {
  await seedClients();
  await seedProducts();
  const [clients, products] = await Promise.all([
    prisma.client.count(),
    prisma.product.count(),
  ]);
  console.log(`Seed completado: ${clients} clientes y ${products} productos disponibles.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
