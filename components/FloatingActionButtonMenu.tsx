import type React from "react";
import { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface FloatingActionButtonMenuProps {
  onChatPress: () => void;
  onHelpPress: () => void;
}

const FloatingActionButtonMenu: React.FC<FloatingActionButtonMenuProps> = ({
  onChatPress,
  onHelpPress,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    if (isOpen) {
      // Cerrar menú
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setIsOpen(false));
    } else {
      // Abrir menú
      setIsOpen(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleButtonPress = (action: () => void) => {
    fadeAnim.stopAnimation();
    translateYAnim.stopAnimation();
    fadeAnim.setValue(0);
    translateYAnim.setValue(0);
    setIsOpen(false);
    action();
  };

  return (
      <View pointerEvents="box-none" style={styles.container}>
        {/* Botones del menú */}
        {isOpen && (
          <>
            {/* Botón de ayuda */}
            <Animated.View
              style={[
                styles.menuItem,
                styles.helpItem,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: translateYAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => handleButtonPress(onHelpPress)}
                style={[styles.button, { backgroundColor: "#19D4C6" }]}
              >
                <Ionicons name="help" size={24} color="#fff" />
              </TouchableOpacity>
            </Animated.View>

            {/* Botón de chat */}
            <Animated.View
              style={[
                styles.menuItem,
                styles.chatItem,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: translateYAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => handleButtonPress(onChatPress)}
                style={[styles.button, { backgroundColor: "#fe971a" }]}
              >
                <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        {/* Botón principal */}
        <TouchableOpacity onPress={toggleMenu} style={styles.mainButton}>
          <Ionicons name={isOpen ? "close" : "menu"} size={28} color="#fff" />
        </TouchableOpacity>
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 70,
    right: 10,
    width: 56,
    height: 205,
  },
  menuItem: {
    position: "absolute",
    right: 0,
  },
  helpItem: {
    bottom: 140,
  },
  chatItem: {
    bottom: 72,
  },
  mainButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#069eb3",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    zIndex: 10,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    marginBottom: 10,
  },
});

export default FloatingActionButtonMenu;
