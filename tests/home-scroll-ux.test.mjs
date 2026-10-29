import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const readAppSources = (relativeDirectory) => {
  const directoryUrl = new URL(relativeDirectory, import.meta.url);
  return readdirSync(directoryUrl, { recursive: true, withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && /\.(?:js|jsx|ts|tsx)$/.test(entry.name),
    )
    .map((entry) => {
      const relativePath = `${entry.parentPath ?? entry.path}/${entry.name}`;
      return [relativePath, readFileSync(relativePath, "utf8")];
    });
};

const home = readSource("../screens/Home.tsx");
const workerHome = readSource("../components/home/WorkerHomeView.tsx");
const categoryList = readSource("../components/home/CategoryList.tsx");
const categorySection = readSource("../components/home/CategorySection.tsx");
const optionsSheet = readSource("../components/home/OptionsSheetView.tsx");
const workerState = readSource("../components/home/WorkerState.tsx");
const availabilitySheet = readSource(
  "../components/workers/SelectWorkStateSheetView.tsx",
);
const publishRequest = readSource("../screens/PublicarNecesidad.tsx");
const backButton = readSource("../components/BotonVolver.tsx");
const micaChat = readSource("../screens/MicaChat.tsx");
const myServices = readSource("../screens/MisServicios.js");
const settings = readSource("../screens/Configuracion.tsx");
const offerService = readSource("../screens/OfrecerServicio.tsx");
const jobsScreen = readSource("../screens/TrabajosPendientes.tsx");

test("el inicio completo se desplaza con el contenido y no deja el encabezado fijo", () => {
  assert.match(home, /const homeHeaderContent =/);
  assert.match(home, /<WorkerHomeView[\s\S]*header=\{homeHeaderContent\}/);
  assert.match(home, /<CategoryList[\s\S]*header=\{homeHeaderContent\}/);
  assert.match(categoryList, /ListHeaderComponent=/);
  assert.match(categoryList, /\{header\}/);
  assert.match(workerHome, /header=\{workerHeader\}/);
});

test("las categorías usan una grilla vertical y no capturan el gesto horizontal", () => {
  assert.doesNotMatch(categorySection, /FlatList/);
  assert.doesNotMatch(categorySection, /\bhorizontal\b/);
  assert.match(categorySection, /flexWrap: "wrap"/);
  assert.match(categorySection, /useWindowDimensions/);
  assert.match(categoryList, /Servicios disponibles/);
  assert.match(categoryList, /Elegí una categoría/);
});

test("ofertas tiene un solo desplazamiento vertical", () => {
  assert.match(
    workerHome,
    /activeTab === "ofertas"[\s\S]*<OfertasView navigation=\{navigation\} header=\{workerHeader\}/,
  );
  assert.doesNotMatch(
    workerHome,
    /<ScrollView[\s\S]{0,500}activeTab === "ofertas"/,
  );
});

test("MICA y las acciones secundarias se desplazan sin tapar contenido", () => {
  assert.doesNotMatch(home, /SideQuickAccessMenu/);
  assert.doesNotMatch(home, /FloatingActionButtonMenu/);
  assert.match(home, /onMicaPress=/);
});

test("completar el perfil vive en el menú y no ocupa el inicio", () => {
  assert.doesNotMatch(home, /ProfileIncompleteWarning/);
  assert.match(optionsSheet, /Tu perfil/);
  assert.match(optionsSheet, /Completá tu perfil/);
  assert.match(optionsSheet, /profileCompleteness\.score/);
});

test("la disponibilidad se prende y apaga con un interruptor y recuerda su duración", () => {
  assert.match(workerState, /<Switch/);
  assert.match(workerState, /Estoy disponible/);
  assert.match(workerState, /durationHours: preferredDuration/);
  assert.match(availabilitySheet, /8 horas/);
  assert.match(availabilitySheet, /12 horas/);
  assert.match(availabilitySheet, /24 horas/);
  assert.doesNotMatch(availabilitySheet, /Estoy ocupado/);
});

test("nueva publicación respeta el área segura y desplaza su encabezado", () => {
  assert.match(publishRequest, /<SafeAreaView style=\{styles\.screen\}>/);
  assert.ok(
    publishRequest.indexOf("<ScrollView") <
      publishRequest.indexOf("<View style={styles.header}>"),
  );
  assert.match(publishRequest, /accessibilityLabel="Volver"/);
});

test("el botón volver participa siempre del diseño de la pantalla", () => {
  assert.doesNotMatch(backButton, /floating|contenedorFlotante|position:/);
  assert.match(backButton, /minHeight: 44/);
  assert.match(backButton, /accessibilityLabel=\{texto\}/);
  assert.match(micaChat, /paddingTop: Math\.max\(insets\.top \+ 8, 16\)/);
  assert.doesNotMatch(micaChat, /paddingTop: 72/);
});

test("las pantallas y componentes no dependen de posiciones absolutas", () => {
  const sources = [
    ...readAppSources("../screens/"),
    ...readAppSources("../components/"),
  ];

  for (const [filePath, source] of sources) {
    assert.doesNotMatch(
      source,
      /position\s*:\s*["']absolute["']/,
      `El layout de ${filePath} volviÃ³ a usar posiciÃ³n absoluta`,
    );
  }
});

test("las pantallas secundarias desplazan sus encabezados con el contenido", () => {
  assert.match(
    myServices,
    /ListHeaderComponent=\{[\s\S]*<BotonVolver \/>[\s\S]*Mis servicios/,
  );
  assert.ok(
    settings.indexOf("<ScrollView") < settings.indexOf("<BotonVolver />"),
  );
  assert.ok(
    offerService.indexOf("<KeyboardAwareScrollView") <
      offerService.indexOf("<BotonVolver />"),
  );
  assert.match(jobsScreen, /<JobsOverview[\s\S]*header=/);
  assert.match(jobsScreen, /<SafeAreaView style=\{styles\.screen\}>/);
});
