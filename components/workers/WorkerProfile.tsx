import type React from "react";
import { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import colors from "../../lib/constants/colors";
import WorkerServicesList from "./WorkerServicesList";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../types/navigation";
import { useQuery } from "@tanstack/react-query";
import { userServiceCountQueryOptions } from "../../lib/queryOptions";
import BotonVolver from "../BotonVolver";
import { useBottomSheetModal } from "../../lib/hooks/useBottomSheetModal";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { Servicio } from "../../types/servicios";
import ServicioSheetView from "../servicios/ServicioSheetView";
import { withModalProvider } from "../sheet/withModalProvider";
import ReportServiceModal from "../servicios/ReporteModal";

export interface UserProfile {
    id: string;
    name: string;
    profileImage: string;
    description?: string;
    isVerified?: boolean;
}

type Props = NativeStackScreenProps<
    MainStackParamList,
    "WorkerProfile"
>;

const WorkerProfile: React.FC<Props> = ({
    route, navigation
}) => {
    const { present, dismiss, modalProps } = useBottomSheetModal({
        snapPoints: ["90%"],
    });
    const [servicesCount, setServicesCount] = useState(0);
    const [servicioSeleccionado, setServicioSeleccionado] = useState<Servicio | null>(null);
    const [imageError, setImageError] = useState(false);
    const { id, name, profileImage, isVerified } = route.params;
    const { data: count } = useQuery(userServiceCountQueryOptions(id));

    useEffect(() => {
        if (count) {
            setServicesCount(count);
        }
    }, [count]);

    const handleServiceSelected = (service: Servicio) => {
        setServicioSeleccionado(service);
        present();
    };

    const handleReportar = () => {
        dismiss();
        setReportVisible(true);
    };
    const [reportVisible, setReportVisible] = useState(false);

    return (
        <SafeAreaView style={styles.container}>
            <BotonVolver />
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.profileImageContainer}>
                        {imageError || !profileImage ? (
                            <View style={[styles.profileImage, styles.profileImageFallback]}>
                                <Ionicons name="person" size={40} color={colors.primary} />
                            </View>
                        ) : (
                            <Image
                                source={{ uri: profileImage }}
                                style={styles.profileImage}
                                onError={() => setImageError(true)}
                            />
                        )}
                        {isVerified === true && (
                            <View style={styles.verifiedBadge}>
                                <MaterialIcons name="check" size={16} color="#ffffff" />
                            </View>
                        )}
                    </View>

                    <Text style={styles.userName}>{name}</Text>
                    {/* <Text style={styles.userDescription}>{user.description}</Text> */}

                    <View style={styles.servicesCountContainer}>
                        <MaterialIcons
                            name="work"
                            size={18}
                            color={colors.primary || "#3b82f6"}
                            style={styles.servicesIcon}
                        />
                        <Text style={styles.servicesCountText}>
                            {servicesCount} publicaciones disponibles
                        </Text>
                    </View>
                </View>

                {/* Services Section */}
                <WorkerServicesList userId={id} onServiceSelected={handleServiceSelected} />

            </ScrollView>
            <BottomSheetModal {...modalProps}>
                {servicioSeleccionado && (
                    <ServicioSheetView
                        servicio={servicioSeleccionado}
                        onCancel={() => dismiss()}
                        onReport={handleReportar}
                    />
                )}
            </BottomSheetModal>
            {servicioSeleccionado && (
                <ReportServiceModal
                    visible={reportVisible}
                    onClose={() => setReportVisible(false)}
                    servicio={servicioSeleccionado}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background || "#f9fafb",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.background || "#ffffff",
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    headerButton: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: colors.text || "#111827",
    },
    scrollView: {
        flex: 1,
    },
    profileSection: {
        marginTop: 36,
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 24,
        backgroundColor: colors.background || "#ffffff",
    },
    profileImageContainer: {
        position: "relative",
        marginBottom: 16,
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#f3f4f6",
    },
    profileImageFallback: {
        alignItems: "center",
        justifyContent: "center",
    },
    verifiedBadge: {
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#10b981",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.background || "#ffffff",
    },
    userName: {
        fontSize: 20,
        fontWeight: "700",
        color: colors.text || "#111827",
        marginBottom: 4,
    },
    userDescription: {
        fontSize: 14,
        color: "#6b7280",
        marginBottom: 16,
        textAlign: "center",
    },
    servicesCountContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#dbeafe",
        borderRadius: 20,
    },
    servicesIcon: {
        marginRight: 8,
    },
    servicesCountText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.primary || "#3b82f6",
    },
});

export default withModalProvider(WorkerProfile);
