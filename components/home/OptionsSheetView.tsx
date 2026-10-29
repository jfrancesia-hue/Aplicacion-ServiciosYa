import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetScrollView,
  useBottomSheetModal,
} from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet, Switch, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserSettings } from "../../lib/hooks/useUserSettings";
import { useCallback } from "react";
import { useMainNavigation } from "../../lib/hooks/useNavigation";
import { perfilQueryOptions } from "../../lib/queryOptions";
import { getProviderProfileCompleteness } from "../../lib/utils/providerProfile";
import { hasProviderCapability } from "../../lib/utils/user";
import { useIsGuest } from "../../store/authStore";

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
  const navigation = useMainNavigation();
  const { dismiss } = useBottomSheetModal();
  const isGuest = useIsGuest();
  const { data: profile } = useQuery(perfilQueryOptions);
  const bottomNavBarHeight = insets.bottom;
  const { settings, updateSettings } = useUserSettings();

  const showAllCategories = settings?.showAllCategories ?? true;
  const locationRadius = settings?.searchRadius ?? 10000;
  const isProvider = hasProviderCapability(profile);
  const profileCompleteness = getProviderProfileCompleteness(profile);
  const needsProfileCompletion = isProvider
    ? profileCompleteness.score < 100
    : profile?.perfil_completo === false;

  const handleCategoriesSwitch = useCallback(() => {
    updateSettings({ showAllCategories: !showAllCategories });
  }, [showAllCategories, updateSettings]);

  const handleRadiusSelect = useCallback(
    (radius: number) => {
      updateSettings({ searchRadius: radius });
    },
    [updateSettings],
  );

  const handleProfilePress = useCallback(() => {
    dismiss();
    if (profile?.perfil_completo) {
      navigation.navigate("Perfil");
      return;
    }
    navigation.navigate("CrearPerfil");
  }, [dismiss, navigation, profile?.perfil_completo]);

  const radiusOptions = [
    { value: 1000, label: "1KM" },
    { value: 5000, label: "5KM" },
    { value: 10000, label: "10KM" },
    { value: 50000, label: "50KM" },
  ];

  return (
    <BottomSheetScrollView
      contentContainerStyle={[
        styles.sheetContainer,
        { paddingBottom: bottomNavBarHeight + 20 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.sheetTitle}>Ajustes</Text>
      </View>

      <View style={styles.settingsContainer}>
        {!isGuest ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cuenta</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Abrir tu perfil"
                onPress={handleProfilePress}
                style={styles.profileRow}
              >
                <View style={styles.profileIcon}>
                  <Ionicons name="person-outline" size={22} color="#047a8f" />
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.profileTitle}>Tu perfil</Text>
                  <Text style={styles.profileSubtitle}>
                    {isProvider
                      ? `${profileCompleteness.score}% completo`
                      : profile?.perfil_completo
                        ? "Datos personales y de contacto"
                        : "Faltan datos para habilitar todas las funciones"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#52666a" />
              </TouchableOpacity>

              {needsProfileCompletion ? (
                <View style={styles.completionBox}>
                  <Text style={styles.completionTitle}>Completá tu perfil</Text>
                  <Text style={styles.completionText}>
                    {isProvider
                      ? "Sumá la información que falta para que los clientes entiendan mejor tu experiencia."
                      : "Completá los datos pendientes para usar todas las funciones de ServiciosYa."}
                  </Text>
                  {isProvider ? (
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${profileCompleteness.score}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.divider} />
          </>
        ) : null}

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
    </BottomSheetScrollView>
  );
}

export default OptionsSheetView;

const styles = StyleSheet.create({
  sheetContainer: {
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
  profileRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dcebed",
    backgroundColor: "#f7fbfb",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  profileIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#e4f5f5",
  },
  profileCopy: {
    flex: 1,
    marginHorizontal: 12,
  },
  profileTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  profileSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  completionBox: {
    borderRadius: 12,
    backgroundColor: "#eef9f9",
    padding: 12,
  },
  completionTitle: {
    color: "#174f59",
    fontSize: 14,
    fontWeight: "800",
  },
  completionText: {
    color: "#52666a",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  progressTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: "#cde6e8",
    marginTop: 9,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#069eb3",
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
