import { StyleSheet, Text, View, Pressable, ScrollView, Share } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import colors from "../lib/constants/colors";
import LoadingView from "./LoadingView";
import SheetContainer from "./sheet/SheetContainer";
import { withSuspense } from "./withSuspense";
import { GenericButton } from "./GenericButtom";
import showToast from "../lib/toast";
import { useBottomSheetModal } from "@gorhom/bottom-sheet";
import { customAlphabet } from "nanoid/non-secure";
import { useEffect, useState } from "react";
import { useSuspenseProfile } from "../lib/hooks/useUser";

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nanoid = customAlphabet(alphabet, 8);

interface InviteSheetViewProps {
    onClose?: () => void;
}

function InviteSheetView({
    onClose,
}: InviteSheetViewProps) {
    const { referral_code, update, refetch } = useSuspenseProfile();
    const [userCode, setUserCode] = useState(referral_code);

    // El referral_code se crea bajo demanda
    useEffect(() => {
        if (!referral_code) {
            const referral_code = nanoid();
            setUserCode(referral_code);
            update({ referral_code })
                .then(() => refetch())
                .catch((error: unknown) => {
                    console.error("Failed to update referral code:", error);
                    showToast.error("Error", "No se pudo generar tu código de invitación.");
                });
        }
    }, [referral_code]);

    const inviteLink = `https://inicio.serviciosya.info/invite.html?referralCode=${userCode ?? ''}`;
    const { dismiss } = useBottomSheetModal();

    const handleCopyLink = async () => {
        try {
            console.log("Copiando enlace:", inviteLink);
            await Clipboard.setStringAsync(inviteLink);
            // showToast.success("¡Copiado!", "El enlace se copió al portapapeles");
        } catch (error) {
            showToast.error("Error", "No se pudo copiar el enlace");
        }
    };

    const handleShare = async () => {
        try {
            const result = await Share.share({
                message: `¡Únete a nuestra app! Usa mi enlace de invitación: ${inviteLink}`,
                title: "Invitación a la app",
            });

            if (result.action === Share.sharedAction) {
                showToast.success("¡Compartido!", "La invitación fue compartida");
            }
        } catch (error) {
            showToast.error("Error", "No se pudo compartir el enlace");
        }
    };

    const handleClose = () => {
        dismiss();
        onClose?.();
    };

    return (
        <SheetContainer style={styles.sheetContainer}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.titleSection}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="gift-outline" size={24} color={colors.primary} />
                        </View>
                        <View style={styles.titleText}>
                            <Text style={styles.title}>Invita a tus amigos</Text>
                            <Text style={styles.subtitle}>Comparte la app con otros</Text>
                        </View>
                    </View>
                </View>

                {/* Description */}
                <View style={styles.descriptionCard}>
                    <Text style={styles.descriptionText}>
                        Tu círculo merece las mejores soluciones. Invita a amigos y familiares: al registrarse recibe créditos.
                    </Text>
                </View>

                {/* Link Card */}
                <View style={styles.linkCard}>
                    <View style={styles.linkHeader}>
                        <Ionicons name="link-outline" size={18} color={colors.textPrimary} />
                        <Text style={styles.linkTitle}>Tu enlace de invitación</Text>
                    </View>
                    <View style={styles.linkContainer}>
                        <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="middle">
                            {inviteLink}
                        </Text>
                    </View>
                    <Pressable
                        style={styles.copyButton}
                        onPress={handleCopyLink}
                        android_ripple={{ color: `${colors.primaryLight}40` }}
                    >
                        <Ionicons name="copy-outline" size={16} color={colors.primary} />
                        <Text style={styles.copyButtonText}>Copiar enlace</Text>
                    </Pressable>
                </View>

                {/* Share Options */}
                {/* <View style={styles.shareCard}>
                    <Text style={styles.sectionTitle}>Compartir en</Text>
                    <Pressable
                        style={styles.shareOption}
                        onPress={handleShare}
                        android_ripple={{ color: colors.lightGray }}
                    >
                        <View style={styles.shareOptionLeft}>
                            <View style={styles.shareIconContainer}>
                                <Ionicons name="share-social-outline" size={20} color={colors.primary} />
                            </View>
                            <Text style={styles.shareOptionText}>Compartir enlace</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </Pressable>
                </View> */}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
                <GenericButton
                    title="Cerrar"
                    onPress={handleClose}
                    style={styles.closeButton}
                    textStyle={styles.closeButtonText}
                />
                <GenericButton
                    title="Compartir ahora"
                    onPress={handleShare}
                    style={styles.shareButton}
                />
            </View>
        </SheetContainer>
    );
}

export default withSuspense(
    InviteSheetView,
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
        paddingTop: 16,
        paddingBottom: 16,
    },
    titleSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: `${colors.primaryLight}20`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    titleText: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    descriptionCard: {
        padding: 16,
        backgroundColor: `${colors.primaryLighter}40`,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${colors.primaryLight}60`,
        marginBottom: 16,
    },
    descriptionText: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
        textAlign: 'center',
    },
    linkCard: {
        padding: 16,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.lightGray,
        marginBottom: 16,
    },
    linkHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    linkTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    linkContainer: {
        padding: 12,
        backgroundColor: colors.lightGray,
        borderRadius: 8,
        marginBottom: 12,
    },
    linkText: {
        fontSize: 13,
        color: colors.textPrimary,
        fontFamily: 'monospace',
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: `${colors.primaryLight}20`,
        borderRadius: 8,
        gap: 8,
    },
    copyButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
    shareCard: {
        padding: 16,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.lightGray,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 12,
    },
    shareOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: colors.lightGray,
        borderRadius: 8,
    },
    shareOptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    shareIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: `${colors.primaryLight}20`,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareOptionText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textPrimary,
    },
    actionContainer: {
        flexDirection: 'row',
        paddingTop: 8,
        gap: 12,
    },
    closeButton: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    closeButtonText: {
        color: colors.primary,
    },
    shareButton: {
        flex: 2,
        borderRadius: 10,
        paddingVertical: 14,
        backgroundColor: colors.primary,
    },
});
