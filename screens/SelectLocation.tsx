// screens/BottomSheetScreen.js
import React, { useMemo, useRef, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";

type BottomSheetScreenProps = {
  navigation: { goBack: () => void };
  route: { params?: { itemId?: string | number } };
};

// Note: `route.params` will contain data passed via navigate()
const BottomSheetScreen = ({ navigation, route }: BottomSheetScreenProps) => {
  const { itemId } = route.params || {};
  const bottomSheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => ["50%"], []);

  // Automatically expand the sheet when the screen is mounted
  useEffect(() => {
    bottomSheetRef.current?.expand();
  }, []);

  // When the sheet is closed, go back to the previous screen
  const handleSheetChanges = (index: number) => {
    if (index === -1) {
      // -1 means the sheet is fully closed
      navigation.goBack();
    }
  };

  return (
    // This View darkens the background
    <View style={styles.container}>
      <BottomSheet
        ref={bottomSheetRef}
        index={0} // Start at the first snap point (0-indexed)
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        onChange={handleSheetChanges}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Sheet as a Screen</Text>
          {itemId && <Text>Received Item ID: {itemId}</Text>}
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Dimmed background
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
  },
});

export default BottomSheetScreen;
