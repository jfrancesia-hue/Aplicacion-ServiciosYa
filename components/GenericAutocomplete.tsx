// GenericAutocomplete.tsx
import type React from "react";
import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  memo,
  forwardRef,
} from "react";
import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { AutocompleteDropdown } from "react-native-autocomplete-dropdown";
import type {
  AutocompleteDropdownItem,
  IAutocompleteDropdownProps,
  IAutocompleteDropdownRef,
} from "react-native-autocomplete-dropdown";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";

// Extend the type to include selectedItem
type ExtendedAutocompleteProps = IAutocompleteDropdownProps & {
  selectedItem?: AutocompleteDropdownItem | null;
};

interface GenericAutocompleteProps<T> {
  label?: string;
  data: T[];
  onSelectItem: (item: T | null) => void;
  itemToDropdownItem: (item: T) => AutocompleteDropdownItem;
  placeholder?: string;
  dropdownProps?: Partial<ExtendedAutocompleteProps>;
  style?: StyleProp<ViewStyle>;
}

const GenericAutocomplete = forwardRef(function GenericAutocomplete<T>(
  {
    label,
    data,
    onSelectItem,
    itemToDropdownItem,
    placeholder = "Buscar...",
    dropdownProps,
    style,
  }: GenericAutocompleteProps<T>,
  ref: React.ForwardedRef<IAutocompleteDropdownRef>,
) {
  const [selectedItem, setSelectedItem] =
    useState<AutocompleteDropdownItem | null>(null);

  const dropdownData = useMemo(
    () => data.map(itemToDropdownItem),
    [data, itemToDropdownItem],
  );

  const dropdownController = useRef<IAutocompleteDropdownRef>(null);

  const handleSelectItem = useCallback(
    (item: AutocompleteDropdownItem | null) => {
      setSelectedItem(item);
      if (item) {
        const originalItem = data.find(
          (d) => itemToDropdownItem(d).id === item.id,
        );
        onSelectItem(originalItem || null);
      } else {
        onSelectItem(null);
      }
    },
    [data, itemToDropdownItem, onSelectItem],
  );

  // Expose the dropdown controller via ref
  useEffect(() => {
    if (ref) {
      if (typeof ref === "function") {
        ref(dropdownController.current);
      } else {
        ref.current = dropdownController.current;
      }
    }
  }, [ref]);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <AutocompleteDropdown
        dataSet={dropdownData}
        onSelectItem={handleSelectItem}
        clearOnFocus={false}
        closeOnBlur={true}
        useFilter={true}
        InputComponent={BottomSheetTextInput}
        textInputProps={{
          placeholder,
          style: styles.textInput,
        }}
        inputContainerStyle={styles.inputContainer}
        suggestionsListContainerStyle={styles.suggestionsListContainer}
        flatListProps={{
          windowSize: 5,
          initialNumToRender: 10,
          maxToRenderPerBatch: 15,
          removeClippedSubviews: true,
          keyboardShouldPersistTaps: "always",
        }}
        containerStyle={{ backgroundColor: "#F7F7F7", borderRadius: 8 }}
        emptyResultText="No se encontro ningun resultado"
        selectedItem={selectedItem}
        controller={(controller) => {
          dropdownController.current = controller;
        }}
        {...dropdownProps}
      />
    </View>
  );
}) as <T>(
  props: GenericAutocompleteProps<T> & {
    ref?: React.ForwardedRef<IAutocompleteDropdownRef>;
  },
) => React.ReactElement;

export default GenericAutocomplete;

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    color: "#19D4C6",
  },
  textInput: {
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    color: "#333",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputContainer: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
  },
  suggestionsListContainer: {
    backgroundColor: "white",
    maxHeight: 200,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginTop: 5,
  },
});
