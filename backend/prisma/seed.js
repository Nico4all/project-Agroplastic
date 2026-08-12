const { PrismaClient } = require('@prisma/client');
const { readFile, readdir } = require('fs/promises');
const { join } = require('path');
const argon2 = require('argon2');

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

function normalizeUsername(value) {
  return value.trim().toLocaleLowerCase('es-CO');
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

async function seedBootstrapUser(role, rawUsername, password, name) {
  const username = normalizeUsername(rawUsername);
  const existing = await prisma.user.findUnique({ where: { username } });
  const passwordHash = await argon2.hash(password);
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role, isActive: true, passwordHash, emailVerifiedAt: existing.emailVerifiedAt || new Date() },
    });
    return;
  }
  await prisma.user.create({
    data: {
      name,
      username,
      email: `${username}@local.agroplastic`,
      passwordHash,
      role,
      emailVerifiedAt: new Date(),
    },
  });
}

async function seedBootstrapUsers() {
  await seedBootstrapUser(
    'ADMIN',
    process.env.ADMIN_USERNAME || 'admin',
    process.env.ADMIN_PASSWORD || 'admin12345',
    process.env.ADMIN_NAME || 'Administrador',
  );
  await seedBootstrapUser(
    'SUPERADMIN',
    process.env.SUPERADMIN_USERNAME || 'superadmin',
    process.env.SUPERADMIN_PASSWORD || '123456789',
    process.env.SUPERADMIN_NAME || 'Superadministrador',
  );
}

async function seedPointsOfSale() {
  const points = [
    { name: 'Cali', code: 'Cl', documentPrefix: 'Cl', city: 'Cali' },
    { name: 'Ipiales', code: 'Ip', documentPrefix: 'Ip', city: 'Ipiales' },
    { name: 'Pasto', code: 'Ps', documentPrefix: 'Ps', city: 'Pasto' },
    { name: 'Popayan', code: 'Py', documentPrefix: 'Py', city: 'Popayan' },
  ];

  for (const point of points) {
    const existing = await prisma.pointOfSale.findFirst({
      where: {
        OR: [
          { code: point.code },
          { name: point.name },
        ],
      },
    });
    if (existing) {
      await prisma.pointOfSale.update({
        where: { id: existing.id },
        data: {
          ...point,
          address: null,
          isActive: true,
        },
      });
      continue;
    }
    await prisma.pointOfSale.create({
      data: {
        ...point,
        address: null,
      },
    });
  }
}

async function seedPriceList() {
  const data = JSON.parse(await readFile(join(dataDirectory, 'price-list-products.json'), 'utf8'));
  await prisma.priceListCategory.createMany({
    data: data.categories.map((name, sortOrder) => ({
      name,
      normalizedName: normalizeDescription(name),
      sortOrder,
    })),
    skipDuplicates: true,
  });
  await prisma.supplier.createMany({
    data: data.suppliers.map((name) => ({ name, normalizedName: normalizeDescription(name) })),
    skipDuplicates: true,
  });

  const [categories, suppliers] = await Promise.all([
    prisma.priceListCategory.findMany(),
    prisma.supplier.findMany(),
  ]);
  const categoryIds = new Map(categories.map((category) => [category.normalizedName, category.id]));
  const supplierIds = new Map(suppliers.map((supplier) => [supplier.normalizedName, supplier.id]));

  await prisma.priceListProduct.createMany({
    data: data.products.map((product) => ({
      sourceKey: product.sourceKey,
      categoryId: categoryIds.get(normalizeDescription(product.category)),
      supplierId: supplierIds.get(normalizeDescription(product.supplier)),
      reference: product.reference,
      measure: product.measure,
      presentation: product.presentation,
      primaryPriceLabel: product.primaryPriceLabel,
      secondaryPriceLabel: product.secondaryPriceLabel,
      defaultPrimaryPrice: product.primaryPrice,
      defaultSecondaryPrice: product.secondaryPrice,
      defaultPrimaryNote: product.primaryPriceNote,
      defaultSecondaryNote: product.secondaryPriceNote,
      sourceSheet: product.sourceSheet,
      sourceRow: product.sourceRow,
    })),
    skipDuplicates: true,
  });

  const [points, products] = await Promise.all([
    prisma.pointOfSale.findMany({ select: { id: true } }),
    prisma.priceListProduct.findMany({
      select: {
        id: true,
        defaultPrimaryPrice: true,
        defaultSecondaryPrice: true,
        defaultPrimaryNote: true,
        defaultSecondaryNote: true,
      },
    }),
  ]);
  if (points.length && products.length) {
    await prisma.pointOfSalePrice.createMany({
      data: points.flatMap((point) => products.map((product) => ({
        pointOfSaleId: point.id,
        productId: product.id,
        primaryPrice: product.defaultPrimaryPrice,
        secondaryPrice: product.defaultSecondaryPrice,
        primaryPriceNote: product.defaultPrimaryNote,
        secondaryPriceNote: product.defaultSecondaryNote,
      }))),
      skipDuplicates: true,
    });
  }
}

async function main() {
  await seedBootstrapUsers();
  await seedPointsOfSale();
  await seedClients();
  await seedProducts();
  await seedPriceList();
  const [clients, products, priceListProducts, suppliers, pointsOfSale] = await Promise.all([
    prisma.client.count(),
    prisma.product.count(),
    prisma.priceListProduct.count(),
    prisma.supplier.count(),
    prisma.pointOfSale.count(),
  ]);
  console.log(`Seed completado: ${clients} clientes, ${products} productos de pedidos, ${priceListProducts} productos de lista, ${suppliers} proveedores y ${pointsOfSale} puntos de venta.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
