import { StyleSheet, Dimensions } from "react-native";

const screenHeight = Dimensions.get("window").height;

export const styles = StyleSheet.create({
  // --- Screen Styles ---
  safeArea: {
    flex: 1,
    paddingTop: 24,
    backgroundColor: "#F8F8F8",
  },
  screenContainer: {
    flex: 1,
  },
  scrollViewContainer: {
    padding: 18,
  },
  title: {
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 20,
    color: "#19D4C6",
    letterSpacing: 0.5,
  },
  noServicios: {
    fontSize: 17,
    color: "#FF6B35",
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 30,
  },
  botonMapa: {
    backgroundColor: "#19D4C6",
    paddingVertical: 11,
    paddingHorizontal: 26,
    borderRadius: 23,
    alignSelf: "center",
    marginBottom: 20,
    elevation: 3,
  },
  botonMapaTexto: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 0.1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // --- ServiceCard Styles ---
  servicioCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#19D4C6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: "#F2F6F6",
  },
  servicioTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#333",
    marginBottom: 2,
  },
  servicioText: {
    fontSize: 15,
    color: "#444",
    marginBottom: 2,
  },

  // --- Modal Styles ---
  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalContenido: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    maxHeight: screenHeight * 0.85,
    shadowColor: "#19D4C6",
    shadowOpacity: 0.2,
    elevation: 8,
  },
  modalTituloContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitulo: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#19D4C6",
    flex: 1, // Allow title to take space
  },
  modalTexto: {
    fontSize: 16,
    color: "#333",
    marginBottom: 6,
    lineHeight: 21,
  },
  botonContratar: {
    marginTop: 22,
    backgroundColor: "#19D4C6",
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#19D4C6",
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  botonTexto: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
    letterSpacing: 0.3,
  },
  cancelar: {
    marginTop: 15,
    textAlign: "center",
    color: "#888",
    fontWeight: "600",
  },

  // --- ConfirmationModal Styles ---
  modalConfirmacion: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 28,
    alignItems: "center",
    elevation: 8,
    shadowColor: "#19D4C6",
    shadowOpacity: 0.15,
  },
  mensajeConfirmacion: {
    fontSize: 17,
    color: "#19D4C6",
    textAlign: "center",
    marginBottom: 22,
    fontWeight: "bold",
  },
  botonVolver: {
    backgroundColor: "#FF6B35",
    paddingVertical: 13,
    paddingHorizontal: 36,
    borderRadius: 25,
    elevation: 2,
    shadowColor: "#FF6B35",
    shadowOpacity: 0.15,
    marginTop: 6,
  },
});
