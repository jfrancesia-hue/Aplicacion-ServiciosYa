import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
  SectionList
} from "react-native";

// Components & Utils
import { CategorySection } from "./CategorySection";
import LoadingView from "../../components/LoadingView";
import { categoriasPorSeccion } from "../../lib/utils/categorias";

// Hooks
import { useUserSettings } from "../../lib/hooks/useUserSettings";
import { withSuspense } from "../withSuspense";
import { useHomeEventsStore } from "../../store/homeEventsStore";
import { useSuspenseQuery } from "@tanstack/react-query";
import { categoriasQueryOptions } from "../../lib/queryOptions";
import {
  getAvailableProviderCounts,
  providerCategoryKey,
} from "../../lib/availableProviders";
import { useLocationStore } from "../../store/locationStore";

interface CategoryListProps {
  busqueda: string;
  onCategoryPress: (category: string) => void;
  isUserRestricted: boolean;
  // Removed 'refreshing' and 'onRefresh' as they were not used (logic is internal)
}

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();

const EXCLUDED_CATEGORIES = new Set(
  ["general", "mi primer trabajo", "servicio"].map(normalize),
);

const CategoryList = ({
  busqueda,
  onCategoryPress,
  isUserRestricted,
}: CategoryListProps) => {
  // 1. Hooks & State
  const { settings } = useUserSettings();
  const [isPullingToRefresh, setIsPullingToRefresh] = useState(false);
  const [workerCountsError, setWorkerCountsError] = useState<string | null>(null);
  const setHomeDataReady = useHomeEventsStore(s => s.setHomeDataReady);
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>({});
  const { data: categoriasDB } = useSuspenseQuery(categoriasQueryOptions);
  const effectiveLocation = useLocationStore((state) => state.effectiveLocation);

  const { dbByNormalized, iconUrls } = useMemo(() => {
    const map = new Map<string, string>();
    const urls: Record<string, string | null> = {};
    for (const c of categoriasDB) {
      if (!c?.nombre) continue;
      const norm = normalize(c.nombre);
      if (EXCLUDED_CATEGORIES.has(norm)) continue;
      map.set(norm, c.nombre);
      urls[c.nombre] = c.icono_url ?? null;
    }
    return { dbByNormalized: map, iconUrls: urls };
  }, [categoriasDB]);

  const loadWorkerCounts = useCallback(async () => {
    if (!effectiveLocation) {
      setWorkerCounts({});
      setWorkerCountsError(null);
      return;
    }

    try {
      setWorkerCountsError(null);
      const counts = await getAvailableProviderCounts({
        city: effectiveLocation?.city,
        province: effectiveLocation?.province,
        locality: effectiveLocation?.locality,
        latitude: effectiveLocation?.latitude,
        longitude: effectiveLocation?.longitude,
        radiusMeters: settings?.searchRadius ?? 10000,
      });
      const mappedCounts: Record<string, number> = {};
      for (const category of categoriasDB) {
        if (!category?.nombre) continue;
        mappedCounts[category.nombre] =
          counts[providerCategoryKey(category.nombre)] ?? 0;
      }
      setWorkerCounts(mappedCounts);
      return;
    } catch (unifiedError) {
      console.warn(
        "[CategoryList] conteo histórico no disponible; se usa el perfil actual:",
        unifiedError,
      );
      setWorkerCounts({});
      setWorkerCountsError(
        "No pudimos actualizar la cantidad de prestadores cercanos. Desliz\u00e1 hacia abajo para reintentar.",
      );
      return;
    }

  }, [
    categoriasDB,
    effectiveLocation?.city,
    effectiveLocation?.locality,
    effectiveLocation?.province,
    effectiveLocation?.latitude,
    effectiveLocation?.longitude,
    settings?.searchRadius,
  ]);

  useEffect(() => {
    loadWorkerCounts();
  }, [loadWorkerCounts]);

  const showAllCategories = settings?.showAllCategories ?? true;

  // 3. Derived State (Memoization)

  // Create a map for O(1) access to counts
  const conteosMap = workerCounts;
  const filteredSections = useMemo(() => {
    const searchNorm = normalize(busqueda);
    const usedInSections = new Set<string>();

    const sections = Object.entries(categoriasPorSeccion).reduce(
      (acc, [seccion, categorias]) => {
        const activeCategories: string[] = [];
        for (const cat of categorias) {
          const dbName = dbByNormalized.get(normalize(cat));
          if (!dbName) continue;
          if (usedInSections.has(dbName)) continue;
          usedInSections.add(dbName);
          const count = conteosMap[dbName] || 0;
          const matchesSearch = !searchNorm || normalize(dbName).includes(searchNorm);
          const hasItemsOrShowAll = showAllCategories || count > 0;
          if (matchesSearch && hasItemsOrShowAll) activeCategories.push(dbName);
        }

        if (activeCategories.length > 0) {
          acc.push({
            title: seccion,
            data: [activeCategories],
          });
        }
        return acc;
      },
      [] as { title: string; data: string[][] }[]
    );

    const otras = Array.from(dbByNormalized.values())
      .filter((cat) => !usedInSections.has(cat))
      .filter((cat) => {
        const count = conteosMap[cat] || 0;
        const matchesSearch = !searchNorm || normalize(cat).includes(searchNorm);
        const hasItemsOrShowAll = showAllCategories || count > 0;
        return matchesSearch && hasItemsOrShowAll;
      })
      .sort((a, b) => a.localeCompare(b));

    if (otras.length > 0) {
      sections.push({ title: "Otros", data: [otras] });
    }

    return sections;
  }, [busqueda, conteosMap, showAllCategories, dbByNormalized]);

  // 4. Handlers
  const handleOnRefresh = useCallback(async () => {
    try {
      setIsPullingToRefresh(true);
      await loadWorkerCounts();
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setIsPullingToRefresh(false);
    }
  }, [loadWorkerCounts]);

  // Este hook debe ejecutarse en todos los renders. Antes estaba debajo de
  // retornos condicionales y React terminaba la pantalla al cambiar la ciudad
  // (la consulta pasaba de loading a success y cambiaba la cantidad de hooks).
  useEffect(() => {
    setHomeDataReady(true);
  }, [setHomeDataReady]);

  return (
    <SectionList
      sections={filteredSections}
      keyExtractor={(_, index) => index.toString()}
      extraData={busqueda}

      ListHeaderComponent={
        !effectiveLocation ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{"Confirm\u00e1 tu ubicaci\u00f3n"}</Text>
            <Text style={styles.noticeText}>
              {"Las cantidades aparecen cuando podemos calcular prestadores dentro de tu radio de b\u00fasqueda."}
            </Text>
          </View>
        ) : workerCountsError ? (
          <View style={[styles.notice, styles.errorNotice]}>
            <Text style={styles.noticeTitle}>No pudimos actualizar la zona</Text>
            <Text style={styles.noticeText}>{workerCountsError}</Text>
          </View>
        ) : null
      }

      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      )}

      renderItem={({ item, section }) => (
        <CategorySection
          title={section.title}
          categories={item}
          conteos={conteosMap}
          onCategoryPress={onCategoryPress}
          disabled={isUserRestricted}
          iconUrls={iconUrls}
        />
      )}

      refreshControl={
        <RefreshControl
          colors={["#00B8A9", "#fe971a"]}
          refreshing={isPullingToRefresh}
          onRefresh={handleOnRefresh}
        />
      }

      contentContainerStyle={{ paddingBottom: 120 }}

      // 🔥 VIRTUALIZACIÓN REAL
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      windowSize={3}
      removeClippedSubviews
    />
  );
};

export default withSuspense(
  CategoryList,
  <LoadingView withNavBarMargin />,
);

// 6. Styles
const styles = StyleSheet.create({
  sectionTitle: {
    fontWeight: "900",
    color: "#333",
    backgroundColor: "white",
    paddingVertical: 6,
    paddingHorizontal: 26,
    borderRadius: 10,
    marginLeft: 16,
    marginBottom: 8,
    alignSelf: "flex-start",
    elevation: 3,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 10,
    paddingBottom: 100,
  },
  centerContainer: {
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "red",
    textAlign: "center",
  },
  notice: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bcdde1",
    backgroundColor: "#edfafa",
    padding: 14,
  },
  errorNotice: {
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed",
  },
  noticeTitle: {
    color: "#174f59",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  noticeText: {
    color: "#52666a",
    fontSize: 13,
    lineHeight: 18,
  },
});
