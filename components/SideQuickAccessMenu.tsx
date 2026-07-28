import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

interface QuickAccessItem {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string, string];
  badge: string;
  onPress: () => void;
}

interface SideQuickAccessMenuProps {
  onBuscarServicioPress?: () => void;
  onOfrecerServicioPress?: () => void;
}

const SideQuickAccessMenu: React.FC<SideQuickAccessMenuProps> = ({
  onBuscarServicioPress,
  onOfrecerServicioPress,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    breatheLoop.start();

    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ]),
    );
    haloLoop.start();

    const wiggleLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2200),
        Animated.timing(wiggle, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: -1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
    );
    wiggleLoop.start();

    return () => {
      breatheLoop.stop();
      haloLoop.stop();
      wiggleLoop.stop();
    };
  }, []);

  const items: QuickAccessItem[] = [
    {
      label: "Buscar servicio",
      subtitle: "Contale a MICA qué necesitás",
      icon: "search-outline",
      gradient: ["#12c7dd", "#069eb3", "#047486"],
      badge: "CLIENTE",
      onPress: () => onBuscarServicioPress?.(),
    },
    {
      label: "Ofrecer trabajo",
      subtitle: "Armá tu perfil de prestador",
      icon: "briefcase-outline",
      gradient: ["#ffb04a", "#fe971a", "#d86f00"],
      badge: "PRO",
      onPress: () => onOfrecerServicioPress?.(),
    },
  ];

  const runPulse = () => {
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(pulse, {
        toValue: 1,
        friction: 3,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleMenu = () => {
    runPulse();
    if (isOpen) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setIsOpen(false));
    } else {
      setIsOpen(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }).start();
    }
  };

  const closeMenu = () => {
    if (!isOpen) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setIsOpen(false));
  };

  const handleItemPress = (action: () => void) => {
    closeMenu();
    setTimeout(action, 180);
  };

  const rotateInterpolate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "135deg"],
  });

  const breathScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const glowScale = halo.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.9],
  });
  const glowOpacity = halo.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0.55, 0],
  });
  const wiggleRotate = wiggle.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-12deg", "12deg"],
  });
  const idleActive = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <TouchableWithoutFeedback onPress={closeMenu}>
      <View style={styles.container}>
        {isOpen &&
          items.map((item, index) => {
            const verticalOffset = -(84 + index * 78);

            const translateY = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, verticalOffset],
            });
            const scale = progress.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.2, 0.85, 1],
            });
            const opacity = progress.interpolate({
              inputRange: [0, 0.25 + index * 0.12, 1],
              outputRange: [0, 0.4, 1],
            });

            return (
              <Animated.View
                key={item.label}
                style={[
                  styles.menuItem,
                  {
                    opacity,
                    transform: [{ translateY }, { scale }],
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleItemPress(item.onPress)}
                  style={styles.itemRow}
                >
                  <LinearGradient
                    colors={item.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.itemCard}
                  >
                    <View style={styles.iconCircle}>
                      <Ionicons name={item.icon} size={21} color="#fff" />
                    </View>
                    <View style={styles.itemCopy}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                      <Text style={styles.labelText} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={styles.subtitleText} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={19} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

        <Animated.View
          style={[
            styles.glowHalo,
            {
              opacity: Animated.multiply(glowOpacity, idleActive),
              transform: [{ scale: glowScale }],
            },
          ]}
          pointerEvents="none"
        />

        <Animated.View
          style={[
            styles.mainButtonWrapper,
            { transform: [{ scale: Animated.multiply(pulse, breathScale) }] },
          ]}
        >
          {!isOpen && (
            <Animated.View
              style={[styles.mainCallout, { opacity: idleActive }]}
              pointerEvents="none"
            >
              <Text style={styles.mainCalloutTitle}>MICA</Text>
              <Text style={styles.mainCalloutText}>empezá acá</Text>
            </Animated.View>
          )}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={toggleMenu}
            style={styles.mainButtonTouch}
          >
            <LinearGradient
              colors={["#1ed4e8", "#069eb3", "#045e6e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mainButton}
            >
              <Animated.View
                style={{
                  transform: [
                    { rotate: rotateInterpolate },
                    { rotate: wiggleRotate },
                  ],
                }}
              >
                <Ionicons
                  name={isOpen ? "close" : "chatbubble-ellipses"}
                  size={29}
                  color="#fff"
                />
              </Animated.View>
              {!isOpen && (
                <View style={styles.spark}>
                  <Ionicons name="sparkles" size={12} color="#ffffff" />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 70,
    left: 10,
    overflow: "visible",
  },
  menuItem: {
    position: "absolute",
    bottom: 6,
    left: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemCard: {
    width: 250,
    minHeight: 66,
    borderRadius: 8,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 9,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.58)",
    elevation: 8,
    shadowColor: "#06333a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
  },
  itemCopy: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  itemHeader: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
  labelText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 15,
  },
  subtitleText: {
    color: "rgba(255,255,255,0.88)",
    fontWeight: "700",
    fontSize: 11,
  },
  glowHalo: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#1ed4e8",
  },
  mainButtonWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  mainButtonTouch: {
    borderRadius: 31,
  },
  mainButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    zIndex: 10,
    shadowColor: "#0cc3dc",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  mainCallout: {
    position: "absolute",
    left: 70,
    width: 112,
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(6,158,179,0.28)",
    elevation: 5,
    shadowColor: "#06333a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
  },
  mainCalloutTitle: {
    color: "#069eb3",
    fontSize: 14,
    fontWeight: "900",
  },
  mainCalloutText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "800",
  },
  spark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,161,60,0.95)",
  },
});

export default SideQuickAccessMenu;
