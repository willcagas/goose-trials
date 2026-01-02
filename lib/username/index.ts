// Shared utilities (server + client)
export { normalizeUsername, validateUsernameShape } from './validation';

// Client-side validation (includes reserved word check for UX)
export { 
  validateUsernameClient, 
  isClientReservedUsername 
} from './client-validation';

