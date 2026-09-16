import { useContext } from 'react';
import { AuthContext } from './AuthContext.jsx';

/**
 * Concentra a logica de use auth para manter o restante do modulo mais legivel.
 */
export const useAuth = () => useContext(AuthContext);
