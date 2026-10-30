import React, { useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { CategoryItem } from "./CategoryItem";

interface CategorySectionProps {
  categories: string[];
  conteos: Record<string, number>;
  onCategoryPress: (category: string) => void;
  disabled?: boolean;
  iconUrls?: Record<string, string | null | undefined>;
}

const CARD_WIDTH = 132;

const pairCategories = (categories: string[]) => {
  const pairs: string[][] = [];
  for (let index = 0; index < categories.length; index += 2) {
    pairs.push(categories.slice(index, index + 2));
  }
  return pairs;
};

export const CategorySection = ({
  categories,
  conteos,
  onCategoryPress,
  disabled,
  iconUrls,
}: CategorySectionProps) => {
  const categoryPairs = useMemo(() => pairCategories(categories), [categories]);

  if (categories.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={categoryPairs}
        keyExtractor={(pair) => pair.join("|")}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.columnSeparator} />}
        renderItem={({ item: pair }) => (
          <View style={styles.column}>
            {pair.map((category) => (
              <CategoryItem
                key={category}
                categoria={category}
                count={conteos[category] || 0}
                onPress={() => onCategoryPress(category)}
                disabled={disabled}
                iconoUrl={iconUrls?.[category]}
                width={CARD_WIDTH}
                compact
              />
            ))}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 18 },
  listContent: { paddingHorizontal: 16, paddingBottom: 4 },
  column: { gap: 10 },
  columnSeparator: { width: 10 },
});
