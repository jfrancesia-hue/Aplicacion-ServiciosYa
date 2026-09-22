import type React from "react";
import { memo, useContext } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MainStackParamList } from "../../types/navigation";
import { useLinkProps, type LinkProps } from "@react-navigation/native";
import { AuthContext } from "../../lib/context/AppContext";

interface NavButtonProps {
  name: React.ComponentProps<typeof Ionicons>["name"];
}

function NavButton({
  name,
  ...linkProps
}: NavButtonProps & LinkProps<MainStackParamList>) {
  const props = useLinkProps(linkProps);
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? "rgba(255,255,255,0.2)" : "transparent",
          borderRadius: 20,
          padding: 8,
          marginHorizontal: 2,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}
    >
      <Ionicons name={name} size={30} color="#fff" />
    </Pressable>
  );
}

function BadgeNavButton({
  name,
  badgeCount = 0,
  ...linkProps
}: NavButtonProps & LinkProps<MainStackParamList> & { badgeCount?: number }) {
  const props = useLinkProps(linkProps);
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        {
          backgroundColor: pressed ? "rgba(255,255,255,0.2)" : "transparent",
          borderRadius: 20,
          padding: 8,
          marginHorizontal: 2,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}
    >
      <Ionicons name={name} size={30} color="#fff" />
      {badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface BottomNavBarProps {
  unreadMessagesCount?: number;
  isWorker?: boolean;
}

const BottomNavBar = ({
  unreadMessagesCount: unreadProp,
  isWorker = false,
}: BottomNavBarProps) => {
  const insets = useSafeAreaInsets();
  const { unreadMessagesCount: contextUnread = 0 } = useContext(AuthContext);
  const unreadMessagesCount = unreadProp ?? contextUnread;

  return (
    <LinearGradient
      colors={["#069eb3", "#047a8f"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.navContainer, { paddingBottom: insets.bottom }]}
    >
      <NavButton name="home-outline" screen="Home" />
      {isWorker ? <NavButton name="list-outline" screen="MisServicios" /> : null}
      <NavButton name="calendar-outline" screen="TrabajosPendientes" />

      <BadgeNavButton
        name="chatbubble-ellipses-outline"
        screen="ChatIA"
        badgeCount={unreadMessagesCount}
      />

      <NavButton name="settings-outline" screen="Configuracion" />
    </LinearGradient>
  );
};

export default memo(BottomNavBar);

const styles = StyleSheet.create({
  navContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderTopColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  navButton: {
    position: "relative",
    padding: 6,
  },
  publishButton: {
    backgroundColor: "#069eb3",
    padding: 12,
    borderRadius: 30,
    top: -25,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#ff5b5b",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
  },
});
