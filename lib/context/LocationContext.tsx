import type React from "react";
import { createContext, useState, useContext } from "react";

type LocationType = {
  latitude: number;
  longitude: number;
} | null;

type LocationContextType = {
  location: LocationType;
  setLocation: React.Dispatch<React.SetStateAction<LocationType>>;
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [location, setLocation] = useState<LocationType>(null);

  return (
    <LocationContext.Provider value={{ location, setLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation debe usarse dentro de LocationProvider");
  return ctx;
};
