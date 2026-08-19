import React from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Text,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  type SharedValue,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// --- Constants ---
const SPRING_CONFIG = {
  duration: 1200,
  overshootClamping: true,
  dampingRatio: 0.8,
};
const OFFSET = 60;
const DEFAULT_POSITION = { bottom: 50, right: 30 };
const ICON_SIZE = 40;
const ICON_OFFSET = 12;

export type FloatingMenuButton = {
  icon: string;
  label: string;
  onPress: () => void;
};

type FloatingMenuPosition = Pick<ViewStyle, "bottom" | "top" | "left" | "right">;

type ActionButtonProps = {
  isExpanded: SharedValue<boolean>;
  index: number;
  button: FloatingMenuButton;
  position: FloatingMenuPosition;
};

// --- Child Action Button Component ---
const ActionButton = ({ isExpanded, index, button, position }: ActionButtonProps) => {
  const { icon, label, onPress } = button;
  const [textWidth, setTextWidth] = React.useState<number | null>(null);

  // Animation for the entire component (icon + label) to move up/down
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const moveValue = isExpanded.value ? OFFSET * index : 0;
    const translateValue = withSpring(-moveValue, SPRING_CONFIG);
    return {
      transform: [{ translateY: translateValue }],
      opacity: withTiming(isExpanded.value ? 1 : 0),
    };
  });

  // Animation for the icon circle to scale
  const iconAnimatedStyle = useAnimatedStyle(() => {
    const delay = index * 100;
    return {
      transform: [
        { scale: withDelay(delay, withTiming(isExpanded.value ? 1 : 0)) },
      ],
    };
  });

  // Animation for the label wrapper to fade in
  const labelWrapperAnimatedStyle = useAnimatedStyle(() => {
    const delay = index * 100 + 50;
    return {
      opacity: withDelay(delay, withTiming(isExpanded.value ? 1 : 0)),
    };
  });

  // Determine if the FAB is on the left or right of the screen
  const labelPositionStyle = React.useMemo(() => {
    if (position.right !== undefined) {
      return { right: ICON_SIZE + ICON_OFFSET }; // Label to the left of icon
    }
      return { left: ICON_SIZE + ICON_OFFSET }; // Label to the right of icon
  }, [position]);

  // Measure text width using hidden text
  const handleTextLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (textWidth === null) {
      setTextWidth(width);
    }
  };

  return (
    <View>
      {/* Hidden text to measure width - positioned off-screen */}
      <Text
        style={[
          styles.labelText,
          { position: "absolute", left: -9999, opacity: 0 },
        ]}
        onLayout={handleTextLayout}
      >
        {label}
      </Text>

      {/* Actual component */}
      <AnimatedPressable
        style={[styles.actionButtonContainer, containerAnimatedStyle]}
        onPress={onPress}
      >
        {/* Only render label if we have measured the text width */}
        {textWidth !== null && (
          <Animated.View
            style={[
              styles.labelContainer,
              labelPositionStyle,
              labelWrapperAnimatedStyle,
              { width: textWidth + 20 }, // 20 for padding
            ]}
          >
            <Text style={styles.labelText} numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
        )}

        <Animated.View
          style={[styles.iconButton, styles.shadow, iconAnimatedStyle]}
        >
          <Text style={styles.iconText}>{icon}</Text>
        </Animated.View>
      </AnimatedPressable>
    </View>
  );
};

// --- Main Menu Component ---
export default function FloatingButtonMenu({
  buttons,
  position = DEFAULT_POSITION,
}: {
  buttons: FloatingMenuButton[];
  position?: FloatingMenuPosition;
}) {
  const isExpanded = useSharedValue(false);

  const handlePress = () => {
    isExpanded.value = !isExpanded.value;
  };

  const plusIconStyle = useAnimatedStyle(() => {
    const rotateValue = isExpanded.value ? "45deg" : "0deg";
    return {
      transform: [{ rotate: withTiming(rotateValue) }],
    };
  });

  return (
    <View style={[styles.menuContainer, position]}>
      {buttons.map((button: FloatingMenuButton, index: number) => (
        <ActionButton
          key={button.label}
          isExpanded={isExpanded}
          index={index + 1}
          button={button}
          position={position}
        />
      ))}
      <AnimatedPressable
        onPress={handlePress}
        style={[styles.shadow, mainButtonStyles.button]}
      >
        <Animated.Text style={[plusIconStyle, mainButtonStyles.content]}>
          +
        </Animated.Text>
      </AnimatedPressable>
    </View>
  );
}

// --- Styles ---
const mainButtonStyles = StyleSheet.create({
  button: {
    height: 56,
    width: 56,
    borderRadius: 100,
    backgroundColor: "#b58df1",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    fontSize: 24,
    color: "#f8f9ff",
  },
});

const styles = StyleSheet.create({
  menuContainer: {
    position: "absolute",
    alignItems: "center",
  },
  actionButtonContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  iconButton: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 100,
    backgroundColor: "#069eb3",
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    color: "#f8f9ff",
    fontWeight: "bold",
  },
  labelContainer: {
    position: "absolute",
    backgroundColor: "white",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    shadowColor: "#171717",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  labelText: {
    color: "#333",
    fontWeight: "500",
  },
  shadow: {
    shadowColor: "#171717",
    shadowOffset: { width: -0.5, height: 3.5 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
});
