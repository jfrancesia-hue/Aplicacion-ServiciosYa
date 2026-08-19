import { StyleSheet, Text, View, Pressable, ScrollView, Alert } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import colors, { theme } from "../../lib/constants/colors";
import type { Servicio } from "../../types/servicios";
import LoadingView from "../LoadingView";
import SheetContainer from "../sheet/SheetContainer";
import { withSuspense } from "../withSuspense";
import { GenericButton } from "../GenericButtom";
import ProviderInfoCard from "./ProviderInfoCard";
import { Suspense, useState } from "react";
import { useMainNavigation } from "../../lib/hooks/useNavigation";
import { useSuspenseProfile } from "../../lib/hooks/useUser";
import { isGuest } from "../../lib/utils/user";
import useContratar from "../../lib/hooks/useContratar";
import showToast from "../../lib/toast";
import { useBottomSheetModal } from "@gorhom/bottom-sheet";
import { useGrantAchievement } from "../../lib/services/achievements.services";

interface ServicioSheetViewProps {
    servicio: Servicio;
    showProfile?: boolean;
    onCancel?: () => void;
    onReport?: () => void;
}

function ServicioSheetView({
    servicio,
    onCancel,
    onReport,
    showProfile = false,
}: ServicioSheetViewProps) {
    const navigation = useMainNavigation();
    const { checkService } = useGrantAchievement();
    const { rol, isSuscriptor } = useSuspenseProfile();
    const [showFullDescription, setShowFullDescription] = useState(false);
    const { dismiss } = useBottomSheetModal();
    const { mutate, isPending } = useContratar({
        onSuccess: async () => {
            await checkService();
            dismiss();
            showToast.success("¡Éxito!", "Tu propuesta fue enviada.");
        },
        onError(error) {
            showToast.error("Error al contratar", error.message);
        },
    });

    const getTitleSize = (text?: string) => {
        if (!text) return 18;
        return text.length > 28 ? 16 : 18;
    };

    const handleVisitProfile = () => {
        navigation.navigate('WorkerProfile', {
            id: String(servicio.user_id ?? ""),
            name: servicio.nombre ?? "",
            profileImage: servicio.user_foto_perfil ?? servicio.foto_perfil ?? "",
            isVerified: Boolean(servicio.verificado),
        });
    };

    const handleContratarServicio = () => {
        mutate(servicio);
    };

    const capitalizedTitle = servicio.titulo ? servicio.titulo.charAt(0).toUpperCase() + servicio.titulo.slice(1) : '';

    const description = servicio.descripcion || '';
    const isLongDescription = description.length > 144;

    const displayedDescription =
        isLongDescription && !showFullDescription
            ? `${description.substring(0, 144)}...`
            : description;

    return (
        <SheetContainer style={styles.sheetContainer}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.titleSection}>
                        <View style={styles.serviceIcon}>
                            <Ionicons name="construct-outline" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.titleText}>
                            <Text style={[styles.serviceName, { fontSize: getTitleSize(servicio.titulo) }]}>
                                {capitalizedTitle.length > 50 ? `${capitalizedTitle.substring(0, 50)}...` : capitalizedTitle}
                            </Text>
                            <Text style={styles.serviceCategory}>{servicio.categoria}</Text>
                        </View>
                    </View>

                    {/* Report Button */}
                    {onReport && (
                        <Pressable
                            style={styles.reportButton}
                            onPress={onReport}
                            android_ripple={{ color: '#ef444420', borderless: true, radius: 24 }}
                        >
                            <Ionicons name="flag-outline" size={14} color="#ef4444" />
                            <Text style={styles.reportButtonText}>Reportar</Text>
                        </Pressable>
                    )}
                </View>

                {/* Price and Schedule Row */}
                <View style={styles.mainInfoRow}>
                    <View style={styles.priceCard}>
                        <Text style={styles.priceAmount}>
                            ${servicio.precio ? servicio.precio.toLocaleString() : 'Cotizar'}
                        </Text>
                        <Text style={styles.priceUnit}>por servicio</Text>
                    </View>

                    <View style={styles.scheduleCard}>
                        <Ionicons name="time-outline" size={16} color={colors.primary} />
                        <Text style={styles.scheduleText}>
                            {servicio.horario || 'Variable'}
                        </Text>
                    </View>
                </View>

                {/* Description */}
                <View style={styles.descriptionCard}>
                    <Text style={styles.sectionTitle}>Descripción</Text>
                    <Text style={styles.descriptionText}>{displayedDescription}</Text>
                    {isLongDescription && !showFullDescription && (
                        <Pressable
                            onPress={() => setShowFullDescription(true)}
                            style={styles.showAllButton}>
                            <Text style={styles.showAllText}>Mostrar todo</Text>
                        </Pressable>
                    )}
                </View>

                {/* Provider Info */}
                {showProfile && (
                    <Suspense>
                        <ProviderInfoCard
                            user={String(servicio.user_id ?? "")}
                            providerName={servicio.nombre ?? ""}
                            imageProfile={servicio.user_foto_perfil ?? servicio.foto_perfil ?? ""}
                            onPress={handleVisitProfile}
                        />
                    </Suspense>
                )}

               
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
                <GenericButton
    title="Contratar"
    onPress={() => {
        if (isGuest(rol)) {
            Alert.alert(
                "Inicia sesión",
                "Debes iniciar sesión para contratar un servicio.",
                [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Iniciar sesión", onPress: () => navigation.navigate("AuthStack", { screen: "LoginSelect" }) },
                ]
            );
        } else {
            handleContratarServicio();
        }
    }}
    style={styles.hireButton}
    loading={isPending && !isGuest(rol)}
/>

            </View>
        </SheetContainer>
    );
}

export default withSuspense(
    ServicioSheetView,
    <LoadingView withNavBarMargin />
);

const styles = StyleSheet.create({
    sheetContainer: {
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingBottom: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 16,
    },
    titleSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    serviceIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: `${colors.primaryLight}20`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    titleText: {
        flex: 1,
    },
    serviceName: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    serviceCategory: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    reportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'transparent',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#ef4444',
        marginLeft: 8,
    },
    reportButtonText: {
        color: '#ef4444',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    mainInfoRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    priceCard: {
        flex: 2,
        padding: 16,
        backgroundColor: `${colors.primaryLighter}40`,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${colors.primaryLight}60`,
        alignItems: 'center',
    },
    priceAmount: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.primaryDark,
        marginBottom: 2,
    },
    priceUnit: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    scheduleCard: {
        flex: 1,
        padding: 16,
        backgroundColor: colors.lightGray,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${colors.primaryLight}30`,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    scheduleText: {
        fontSize: 11,
        color: colors.textPrimary,
        fontWeight: '500',
        textAlign: 'center',
    },
    descriptionCard: {
        padding: 16,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.lightGray,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    descriptionText: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
        textAlign: 'justify',
    },
    showAllButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    showAllText: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 14,
        paddingVertical: 4,
    },
    creditsCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: colors.lightGray,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${colors.primaryLight}30`,
        marginTop: 8,
    },
    creditsInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    creditsTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textPrimary,
        marginLeft: 8,
    },
    creditsAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.primary,
    },
    actionContainer: {
        flexDirection: 'row',
        paddingTop: 8,
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 14,
    },
    hireButton: {
        flex: 2,
        borderRadius: 10,
        paddingVertical: 14,
        backgroundColor: colors.primary,
    },
});
