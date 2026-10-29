import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { CategoryItem } from "./CategoryItem";

interface CategorySectionProps {
  categories: string[];
  conteos: Record<string, number>;
  onCategoryPress: (category: string) => void;
  disabled?: boolean;
  iconUrls?: Record<string, string | null | undefined>;
}

const GRID_GAP = 12;
const GRID_HORIZONTAL_PADDING = 16;

export const CategorySection = ({
  categories,
  conteos,
  onCategoryPress,
  disabled,
  iconUrls,
}: CategorySectionProps) => {
  const { width: screenWidth } = useWindowDimensions();

  if (categories.length === 0) return null;

  const availableWidth = Math.max(
    screenWidth - GRID_HORIZONTAL_PADDING * 2,
    280,
  );
  const columnCount = availableWidth >= 720 ? 4 : availableWidth >= 520 ? 3 : 2;
  const cardWidth =
    (availableWidth - GRID_GAP * (columnCount - 1)) / columnCount;

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {categories.map((category) => (
          <CategoryItem
            key={category}
            categoria={category}
            count={conteos[category] || 0}
            onPress={() => onCategoryPress(category)}
            disabled={disabled}
            iconoUrl={iconUrls?.[category]}
            width={cardWidth}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
  },
});
