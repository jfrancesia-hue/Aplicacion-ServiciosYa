import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import JobsOverview from "../components/jobs/JobsOverview";
import type { MainStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<MainStackParamList, "TrabajosPendientes">;

export default function TrabajosPendientes({ navigation }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color="#075f6f" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Mis trabajos</Text>
          <Text style={styles.subtitle}>
            Agenda, acciones, cierres y reclamos
          </Text>
        </View>
      </View>
      <JobsOverview navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f6f7" },
  header: {
    minHeight: 70,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dbe5e7",
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f7f9",
  },
  headerCopy: { marginLeft: 11 },
  title: { color: "#17383f", fontSize: 20, fontWeight: "900" },
  subtitle: { color: "#6d8388", fontSize: 11, marginTop: 2 },
});
