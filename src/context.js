import { createContext, useContext } from 'react';
export const AtlasContext = createContext(null);
export const useAtlas = () => useContext(AtlasContext);
