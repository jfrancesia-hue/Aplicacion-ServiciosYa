import { BottomSheetView } from "@gorhom/bottom-sheet";
import { View, Text, StyleSheet, Switch, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserSettings } from "../../lib/hooks/useUserSettings";
import { useCallback } from "react";

// Color definitions
const colors = {
  primary: "#00B8A9",
  primaryLight: "#5DD0C5",
  primaryLighter: "#A0E6DF",
  primaryDark: "#00897B",
  secondary: "#fe971a",
  secondaryLight: "#FFB96A",
  secondaryLighter: "#FFD4A8",
  gray: "#767577",
  lightGray: "#F5F5F5",
  darkGray: "#3E3E3E",
  textPrimary: "#1A1A1A",
  textSecondary: "#5E5E5E",
  background: "#FFFFFF",
};

interface SettingSwitchProps {
  label: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

interface RadiusOptionProps {
  label: string;
  value: number;
  isSelected: boolean;
  onSelect: (value: number) => void;
}

const SettingSwitch = ({
  label,
  subtitle,
  value,
  onValueChange,
}: SettingSwitchProps) => {
  return (
    <View style={styles.switchContainer}>
      <View style={styles.switchLabelContainer}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Text style={styles.switchSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        trackColor={{ false: colors.gray, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : colors.lightGray}
        ios_backgroundColor={colors.darkGray}
        onValueChange={onValueChange}
        value={value}
      />
    </View>
  );
};

const RadiusOption = ({
  label,
  value,
  isSelected,
  onSelect,
}: RadiusOptionProps) => {
  return (
    <TouchableOpacity
      onPress={() => onSelect(value)}
      style={[styles.radiusOption, isSelected && styles.radiusOptionSelected]}
    >
      <Text
        style={[
          styles.radiusOptionText,
          isSelected && styles.radiusOptionTextSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

function OptionsSheetView() {
  const insets = useSafeAreaInsets();
  const bottomNavBarHeight = insets.bottom;
  const { settings, updateSettings } = useUserSettings();

  const showAllCategories = settings?.showAllCategories ?? true;
  const locationRadius = settings?.searchRadius ?? 10000;

  const handleCategoriesSwitch = useCallback(() => {
    updateSettings({ showAllCategories: !showAllCategories });
  }, [showAllCategories, updateSettings]);

  const handleRadiusSelect = useCallback(
    (radius: number) => {
      updateSettings({ searchRadius: radius });
    },
    [updateSettings],
  );

  const radiusOptions = [
  { value: 1000, label: "1KM" },
  { value: 5000, label: "5KM" },
  { value: 10000, label: "10KM" },
  { value: 50000, label: "50KM" },
];


  return (
    <BottomSheetView
      style={[
        styles.sheetContainer,
        { paddingBottom: bottomNavBarHeight + 20 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.sheetTitle}>Ajustes</Text>
      </View>

      <View style={styles.settingsContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ubicación</Text>

          <Text style={styles.locationPrivacyText}>
            El GPS se usa solamente cuando tocás “Usar mi ubicación”. Si
            preferís, podés ingresar una dirección manualmente.
          </Text>
          <View style={styles.radiusContainer}>
            <Text style={styles.radiusLabel}>Radio de búsqueda</Text>
            <View style={styles.radiusOptionsContainer}>
              {radiusOptions.map((option) => (
                <RadiusOption
                  key={option.value}
                  label={option.label}
                  value={option.value}
                  isSelected={locationRadius === option.value}
                  onSelect={handleRadiusSelect}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categorías</Text>
          <SettingSwitch
            label="Mostrar todas las categorías"
            subtitle="Muestra categorías incluso si no hay servicios cercanos disponibles"
            value={showAllCategories}
            onValueChange={handleCategoriesSwitch}
          />
        </View>
      </View>
    </BottomSheetView>
  );
}

export default OptionsSheetView;

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryLighter,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  settingsContainer: {
    gap: 24,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 4,
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  switchLabelContainer: {
    flex: 1,
    gap: 4,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  switchSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  locationPrivacyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  radiusContainer: {
    gap: 8,
  },
  radiusLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  radiusOptionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  radiusOption: {
    backgroundColor: colors.lightGray,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 70,
    alignItems: "center",
  },
  radiusOptionSelected: {
    backgroundColor: colors.primary,
  },
  radiusOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  radiusOptionTextSelected: {
    color: colors.background,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.primaryLighter,
    marginVertical: 8,
  },
});
