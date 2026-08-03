import type React from "react";
import { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
} from "react-native";
import type { HomeEventComponentProps } from "../../store/homeEventsStore";

const WelcomeModal: React.FC<HomeEventComponentProps> = ({
    onDismiss,
    onComplete,
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const handleContratar = () => {
        onComplete();
    };

    const handleOfrecer = () => {
        onComplete();
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={isVisible}
            onRequestClose={() => onDismiss()}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <Text style={styles.title}>¡Bienvenido a Servicios Ya! 👋</Text>

                    <Text style={styles.subtitle}>¿Qué querés hacer hoy?</Text>

                    {/* Botón Contratar */}
                    <TouchableOpacity
                        onPress={handleContratar}
                        style={styles.btnContratar}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.btnText}>Contratar</Text>
                    </TouchableOpacity>

                    {/* Botón Ofrecer Servicio */}
                    <TouchableOpacity
                        onPress={handleOfrecer}
                        style={styles.btnOfrecer}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.btnText}>Ofrecer un servicio</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContainer: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 25,
        width: "90%",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 12,
        color: "#333",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 16,
        color: "#444",
        marginBottom: 25,
        textAlign: "center",
    },
    btnContratar: {
        backgroundColor: "#00B8A9",
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 12,
    },
    btnOfrecer: {
        backgroundColor: "#007BFF",
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
    },
    btnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});

export default WelcomeModal;