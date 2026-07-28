import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  getBlockedUsers,
  unblockUser,
} from "../../lib/utils/trustSafety";

type BlockedUser = {
  id: string;
  nombre: string | null;
  foto_perfil: string | null;
};

export default function BlockedUsersSection() {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setUsers(await getBlockedUsers());
    } catch (error) {
      console.warn("[BlockedUsersSection]", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmUnblock = (user: BlockedUser) => {
    Alert.alert(
      "Desbloquear perfil",
      `¿Querés volver a permitir conversaciones con ${user.nombre || "este usuario"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desbloquear",
          onPress: async () => {
            try {
              setBusyId(user.id);
              await unblockUser(user.id);
              setUsers((current) =>
                current.filter((item) => item.id !== user.id),
              );
            } catch (error) {
              Alert.alert(
                "No se pudo desbloquear",
                error instanceof Error ? error.message : "Intentá nuevamente.",
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Personas bloqueadas</Text>
      <Text style={styles.description}>
        Administrá quién puede volver a contactarte por el chat interno.
      </Text>
      {loading ? (
        <ActivityIndicator color="#047a8f" style={styles.loader} />
      ) : users.length === 0 ? (
        <Text style={styles.empty}>No bloqueaste a nadie.</Text>
      ) : (
        users.map((user) => (
          <View key={user.id} style={styles.row}>
            {user.foto_perfil ? (
              <Image source={{ uri: user.foto_perfil }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>
                  {(user.nombre || "U").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text numberOfLines={1} style={styles.name}>
              {user.nombre || "Usuario"}
            </Text>
            <TouchableOpacity
              activeOpacity={0.76}
              disabled={busyId === user.id}
              onPress={() => confirmUnblock(user)}
              style={styles.button}
            >
              {busyId === user.id ? (
                <ActivityIndicator size="small" color="#047a8f" />
              ) : (
                <Text style={styles.buttonText}>Desbloquear</Text>
              )}
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 28,
  },
  title: {
    color: "#202B3A",
    fontSize: 17,
    fontWeight: "800",
  },
  description: {
    marginTop: 5,
    color: "#65777b",
    fontSize: 13,
    lineHeight: 18,
  },
  loader: {
    marginTop: 14,
    alignSelf: "flex-start",
  },
  empty: {
    marginTop: 12,
    color: "#7b8d90",
    fontSize: 13,
  },
  row: {
    minHeight: 58,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 9,
    borderWidth: 1,
    borderColor: "#d4e7e9",
    borderRadius: 14,
    backgroundColor: "#f8fcfc",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d9eff1",
  },
  avatarLetter: {
    color: "#047a8f",
    fontWeight: "900",
  },
  name: {
    flex: 1,
    color: "#263c40",
    fontSize: 14,
    fontWeight: "700",
  },
  button: {
    minWidth: 94,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#8ecbd2",
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  buttonText: {
    color: "#047a8f",
    fontSize: 12,
    fontWeight: "800",
  },
});
