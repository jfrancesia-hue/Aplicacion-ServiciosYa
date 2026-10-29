import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import colors from "../../lib/constants/colors";

interface SheetButtonProps {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline";
  size?: "small" | "medium" | "large";
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export function SheetButton({
  onPress,
  label,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "medium",
  style,
  textStyle,
  testID,
}: SheetButtonProps) {
  // --- Animation Shared Values ---

  // Controls the rotation of the spinner icon
  const rotation = useSharedValue(0);

  // --- Animation Logic ---

  React.useEffect(() => {
    // Start or stop the repeating rotation animation
    if (loading) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1, // -1 means infinite repetition
      );
    } else {
      // It's important to cancel the animation before resetting the value
      cancelAnimation(rotation);
      rotation.value = 0;
    }
  }, [loading, rotation]);

  // --- Animated Styles ---

  // Style for the spinner icon's rotation
  const animatedSpinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const iconColor =
    variant === "primary"
      ? colors.background
      : variant === "outline"
        ? colors.secondary
        : colors.text || colors.secondary;

  const iconSize = size === "small" ? 18 : size === "large" ? 28 : 22;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        styles[`button_${size}`],
        // Apply disabled styles when loading or disabled
        (disabled || loading) && styles[`button_${variant}_disabled`],
        (disabled || loading) && styles.buttonDisabled, // Generic disabled style
        pressed &&
          !disabled &&
          !loading && [
            styles.buttonPressed,
            styles[`button_${variant}_pressed`],
          ],
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <Animated.View style={styles.spinner}>
          <Animated.View style={animatedSpinnerStyle}>
            <MaterialCommunityIcons
              name="loading"
              size={iconSize}
              color={iconColor}
            />
          </Animated.View>
        </Animated.View>
      ) : (
        <Text
          style={[
            styles.buttonText,
            styles[`buttonText_${variant}`],
            styles[`buttonText_${size}`],
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// Adjusted StyleSheet
const styles = StyleSheet.create({
  // Base button styles
  button: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden", // Ensures pressed state scale doesn't bleed out
  },

  // Size variants
  button_small: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 38, // Added to ensure consistent height
  },
  button_medium: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 54, // Added to ensure consistent height
  },
  button_large: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    minHeight: 68, // Added to ensure consistent height
  },

  // Variant styles
  button_primary: {
    backgroundColor: colors.secondary,
  },
  button_secondary: {
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: colors.border || colors.lightGray,
  },
  button_outline: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: colors.secondary,
  },

  // Pressed states
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  button_primary_pressed: {
    backgroundColor: colors.secondaryDark || colors.secondary,
  },
  button_secondary_pressed: {
    backgroundColor: colors.gray || colors.lightGray,
  },
  button_outline_pressed: {
    backgroundColor: `${colors.secondary}20`, // 20% opacity
  },

  // Disabled states
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  button_primary_disabled: {
    backgroundColor: colors.secondaryLighter || "#AECBF1",
  },
  button_secondary_disabled: {
    backgroundColor: colors.lightGray,
    opacity: 0.7,
  },
  button_outline_disabled: {
    borderColor: colors.secondaryLighter || "#AECBF1",
    backgroundColor: "transparent",
  },

  // Text styles
  buttonText: {
    fontWeight: "600",
    textAlign: "center",
  },
  // Text size variants
  buttonText_small: {
    fontSize: 14,
  },
  buttonText_medium: {
    fontSize: 16,
  },
  buttonText_large: {
    fontSize: 18,
  },

  // Text color variants
  buttonText_primary: {
    color: colors.background,
  },
  buttonText_secondary: {
    color: colors.text || colors.secondary,
  },
  buttonText_outline: {
    color: colors.secondary,
  },

  // Spinner wrapper
  spinner: {
    alignItems: "center",
    justifyContent: "center",
  },
});
