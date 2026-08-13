import { MaterialIcons } from "@expo/vector-icons";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LEGAL_TERMS_URL, PRIVACY_POLICY_URL } from "../lib/constants/legal";
import {
  LEGAL_DOCUMENTS,
  type LegalDocumentKind,
} from "../lib/legal/documents";

type LegalRoute = RouteProp<
  { LegalDocument: { document: LegalDocumentKind } },
  "LegalDocument"
>;

export default function LegalDocumentScreen() {
  const navigation = useNavigation();
  const route = useRoute<LegalRoute>();
  const document = LEGAL_DOCUMENTS[route.params.document];
  const publicUrl =
    document.kind === "terms" ? LEGAL_TERMS_URL : PRIVACY_POLICY_URL;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Volver"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>DOCUMENTO VIGENTE</Text>
          <Text numberOfLines={2} style={styles.headerTitle}>
            {document.title}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.versionCard}>
          <MaterialIcons name="verified-user" size={24} color="#047a8f" />
          <View style={styles.versionCopy}>
            <Text style={styles.version}>{document.version}</Text>
            <Text style={styles.date}>
              Vigente desde {document.effectiveDate}
            </Text>
          </View>
        </View>

        <Text style={styles.summary}>{document.summary}</Text>

        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
            {section.bullets?.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        ))}

        <TouchableOpacity
          accessibilityRole="link"
          onPress={() =>
            void Linking.openURL(publicUrl).catch(() =>
              Alert.alert(
                "Copia web no disponible",
                "El documento vigente continúa visible dentro de la aplicación.",
              ),
            )
          }
          style={styles.publicLink}
        >
          <MaterialIcons name="language" size={19} color="#047a8f" />
          <Text style={styles.publicLinkText}>
            Abrir copia publicada en la web
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f3fafb" },
  header: {
    minHeight: 88,
    backgroundColor: "#047a8f",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  headerCopy: { flex: 1, marginLeft: 12 },
  eyebrow: {
    color: "#bdeef4",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  headerTitle: { color: "#fff", fontSize: 19, fontWeight: "900", marginTop: 3 },
  content: { padding: 18, paddingBottom: 44 },
  versionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#e2f5f7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bce5ea",
  },
  versionCopy: { flex: 1, marginLeft: 10 },
  version: { color: "#075c6b", fontSize: 13, fontWeight: "900" },
  date: { color: "#3f6f77", fontSize: 12, marginTop: 2 },
  summary: {
    color: "#36565c",
    fontSize: 15,
    lineHeight: 22,
    marginVertical: 20,
  },
  section: { marginBottom: 22 },
  sectionTitle: {
    color: "#123f47",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  paragraph: {
    color: "#3f555a",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 9,
  },
  bullet: { color: "#047a8f", fontSize: 18, lineHeight: 21, marginRight: 8 },
  bulletText: { flex: 1, color: "#3f555a", fontSize: 14, lineHeight: 21 },
  publicLink: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#91ccd4",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#fff",
  },
  publicLinkText: { color: "#047a8f", fontSize: 13, fontWeight: "800" },
});
