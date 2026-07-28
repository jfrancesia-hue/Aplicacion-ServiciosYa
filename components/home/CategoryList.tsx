import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
  SectionList
} from "react-native";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";

// Components & Utils
import { CategorySection } from "./CategorySection";
import LoadingView from "../../components/LoadingView";
import { categoriasPorSeccion } from "../../lib/utils/categorias";

// Hooks
import { useServicesCount } from "../../lib/hooks/useServices";
import { useUserSettings } from "../../lib/hooks/useUserSettings";
import { withSuspense } from "../withSuspense";
import { useHomeEventsStore } from "../../store/homeEventsStore";
import { supabase } from "../../lib/supabase";
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

const AnimatedSectionList =
  Animated.createAnimatedComponent(SectionList);

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();

const EXCLUDED_CATEGORIES = new Set(
  ["general", "mi primer trabajo"].map(normalize),
);

const CategoryList = ({
  busqueda,
  onCategoryPress,
  isUserRestricted,
}: CategoryListProps) => {
  // 1. Hooks & State
  const { servicios: servicesQuery } = useServicesCount();
  const { settings } = useUserSettings();
  const [isPullingToRefresh, setIsPullingToRefresh] = useState(false);
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
    try {
      const counts = await getAvailableProviderCounts({
        city: effectiveLocation?.city,
        province: effectiveLocation?.province,
        locality: effectiveLocation?.locality,
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
    }

    const { data } = await supabase
      .from("usuarios")
      .select("categoria")
      .eq("rol", "worker")
      .eq("perfilPublico", true);
    if (!data) return;

    const countsByKey: Record<string, number> = {};
    for (const user of data) {
      let categories: unknown = user.categoria;
      if (typeof categories === "string") {
        try {
          categories = JSON.parse(categories);
        } catch {
          categories = [categories];
        }
      }
      const values: string[] = Array.isArray(categories)
        ? categories.map(String).filter(Boolean)
        : categories
          ? [String(categories)]
          : [];
      for (const category of values) {
        const key = providerCategoryKey(category);
        if (key) countsByKey[key] = (countsByKey[key] || 0) + 1;
      }
    }

    const mappedCounts: Record<string, number> = {};
    for (const category of categoriasDB) {
      if (!category?.nombre) continue;
      mappedCounts[category.nombre] =
        countsByKey[providerCategoryKey(category.nombre)] ?? 0;
    }
    setWorkerCounts(mappedCounts);
  }, [
    categoriasDB,
    effectiveLocation?.city,
    effectiveLocation?.locality,
    effectiveLocation?.province,
  ]);

  useEffect(() => {
    loadWorkerCounts();
  }, [loadWorkerCounts]);

  // 2. Data Destructuring
  const {
    data: conteosData,
    isLoading,
    error,
    refetch,
    isRefetching
  } = servicesQuery || {};

  const showAllCategories = settings?.showAllCategories ?? true;
  const isRefreshing = (isRefetching ?? false) && isPullingToRefresh;

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
    if (!refetch) return;
    try {
      setIsPullingToRefresh(true);
      await Promise.all([refetch(), loadWorkerCounts()]);
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setIsPullingToRefresh(false);
    }
  }, [loadWorkerCounts, refetch]);

  // 5. Render Logic
  if (isLoading) {
    return <LoadingView withNavBarMargin />;
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          Error al cargar las categorías: {errorMessage}
        </Text>
      </View>
    );
  }

  useEffect(() => {
    setHomeDataReady(true);
  }, []);

  return (
    <SectionList
      sections={filteredSections}
      keyExtractor={(_, index) => index.toString()}
      extraData={busqueda}

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
          refreshing={isRefreshing}
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
});
