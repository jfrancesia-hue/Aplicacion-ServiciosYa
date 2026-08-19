const fs = require('node:fs');
const path = require('node:path');

const file = 'lib/utils/categorias.ts';
const source = fs.readFileSync(file, 'utf8');
const unique = (items) => [...new Set(items)];

const legacyAliases = new Set([
  'Servicio',
  'Mecanico',
  'chef ',
  'alquiler de Quinchos o locales',
  'publicidad de Radios o medios',
  'Gomeria',
  'Electromecanico',
  'Disenador gráfico',
  'Cuidado de ancianos',
  'Disenador UX/UI',
  'Dj para eventos',
  'guarderia de mascotas',
  'Disenador industrial',
]);

function parseStringArray(blockName) {
  const match = source.match(new RegExp(`export const ${blockName} = \\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`No se encontró ${blockName}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const categoriasDisponibles = unique(parseStringArray('categoriasDisponibles'));
const iconBlock = source.match(/export const iconosCategoria = \{([\s\S]*?)\n\};/);
if (!iconBlock) throw new Error('No se encontró iconosCategoria');

const iconEntries = [...iconBlock[1].matchAll(/(?:"([^"]+)"|([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)):\s*require\("([^"]+)"\)/g)].map((m) => ({
  categoria: m[1] || m[2],
  relPath: m[3],
}));
const iconMap = new Map(iconEntries.map((entry) => [entry.categoria, entry.relPath]));

const sectionsBlock = source.match(/export const categoriasPorSeccion = \{([\s\S]*?)\n\};/);
if (!sectionsBlock) throw new Error('No se encontró categoriasPorSeccion');
const categoriasEnSecciones = unique(
  [...sectionsBlock[1].matchAll(/(?:"[^"]+"|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+):\s*\[([\s\S]*?)\]/g)]
    .flatMap((sectionMatch) => [...sectionMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]))
);
const allCategories = unique([...categoriasDisponibles, ...categoriasEnSecciones]);

const missingIcon = allCategories.filter((cat) => !iconMap.has(cat));
const missingFile = iconEntries.filter((entry) => !fs.existsSync(path.resolve(path.dirname(file), entry.relPath)));
const iconWithoutCategory = iconEntries.filter((entry) => !allCategories.includes(entry.categoria) && !legacyAliases.has(entry.categoria));
const intentionalLegacyAliases = iconEntries.filter((entry) => legacyAliases.has(entry.categoria));
const usedNotAvailable = categoriasEnSecciones.filter((cat) => !categoriasDisponibles.includes(cat));
const availableNotInSections = categoriasDisponibles.filter((cat) => !categoriasEnSecciones.includes(cat));

console.log(JSON.stringify({
  counts: {
    categoriasDisponibles: categoriasDisponibles.length,
    categoriasEnSecciones: categoriasEnSecciones.length,
    iconosCategoria: iconMap.size,
    aliasesCompatibilidad: intentionalLegacyAliases.length,
  },
  missingIcon,
  missingFile,
  iconWithoutCategory,
  usedNotAvailable,
  availableNotInSections,
  intentionalLegacyAliases,
}, null, 2));
