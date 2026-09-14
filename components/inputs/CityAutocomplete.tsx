import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "../../lib/supabase"; // Adjust your supabase import path
import type {
  IAutocompleteDropdownProps,
  IAutocompleteDropdownRef,
} from "react-native-autocomplete-dropdown";
import GenericAutocomplete from "../GenericAutocomplete";
import type { StyleProp, ViewStyle } from "react-native";
import type { BottomSheetTextInput } from "@gorhom/bottom-sheet";

// Define the City type based on your table
export type City = {
  id: number;
  name: string;
  state_id: number;
  state_code: string;
  country_id: number;
  country_code: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
  flag: number;
  wikiDataId?: string;
};

interface CityAutocompleteProps {
  label?: string;
  countryCode?: string | null;
  onSelectCity: (city: City | null) => void;
  placeholder?: string;
  dropdownProps?: Partial<IAutocompleteDropdownProps>;
  style?: StyleProp<ViewStyle>;
}

export const CityAutocomplete = ({
  label,
  countryCode,
  onSelectCity,
  placeholder = "Busqueda",
  dropdownProps,
  style,
}: CityAutocompleteProps) => {
  const [selectValue, setSelectValue] = useState("");
  const autocompleteRef = useRef<IAutocompleteDropdownRef>(null);
  const {
    data: cities,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cities", countryCode],
    queryFn: async () => {
      if (!countryCode) return [];

      const allCities: City[] = [];
      const pageSize = 1000;

      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("cities")
          .select("*")
          .eq("country_code", countryCode)
          .order("name", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw new Error(error.message);
        const page = (data ?? []) as City[];
        allCities.push(...page);
        if (page.length < pageSize) break;
      }

      return allCities;
    },
    enabled: !!countryCode, // Only fetch when country code exists
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Reset selection when country changes
  useEffect(() => {
    onSelectCity(null);
    autocompleteRef.current?.clear();
    console.log("se cambio el country code");
  }, [countryCode]);

  // Handle empty states
  const emptyResultText = !countryCode
    ? "Seleccione un país primero"
    : isLoading
      ? "Cargando ciudades..."
      : error
        ? "Error al cargar ciudades"
        : "No se encontraron ciudades";

  const handleSelected = (city: City | null) => {
    const id = city?.id.toString();
    setSelectValue(id ?? "");
    onSelectCity(city);
  };

  return (
    <GenericAutocomplete<City>
      label={label}
      data={cities || []}
      onSelectItem={(value) => handleSelected(value)}
      itemToDropdownItem={(city) => ({
        id: city.id.toString(),
        title: city.name,
        payload: city, // Include full city object
      })}
      placeholder={placeholder}
      dropdownProps={{
        loading: isLoading,
        emptyResultText,
        textInputProps: {
          editable: !!countryCode, // Disable input when no country selected,
          placeholder: "Buscar ciudad",
        },
        ...dropdownProps,
      }}
      style={style}
      ref={autocompleteRef}
    />
  );
};
