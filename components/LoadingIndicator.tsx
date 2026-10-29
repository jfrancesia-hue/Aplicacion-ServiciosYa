import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type LoadingIndicatorProps = {
  loading?: boolean;
  size?: number;
  color?: string;
  children?: React.ReactNode;
};

const LoadingIndicator = ({
  loading = true,
  size = 32,
  color = "#000",
  children,
}: LoadingIndicatorProps) => {
  // Animation values
  const rotation = useSharedValue(0);
  React.useEffect(() => {
    if (loading) {
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1000,
          easing: Easing.linear,
        }),
        -1, // Infinite repetition
      );
    } else {
      rotation.value = withTiming(0);
    }
  }, [loading]);

  const loadingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {loading ? (
        <Animated.View style={loadingStyle}>
          <MaterialCommunityIcons name="loading" size={size} color={color} />
        </Animated.View>
      ) : (
        <View>
          {children || (
          <MaterialIcons name="check-circle" size={size} color={color} />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default LoadingIndicator;
