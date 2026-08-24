/**
 * User model interface for the vulnerable API lab.
 * 
 * Users have roles ("user" | "admin") used in authorization checks.
 * Passwords are stored as bcrypt hashes.
 */
export interface User {
  id: number;
  name: string;
  email: string;
  password: string;  // bcrypt hash
  role: 'user' | 'admin';
}

/**
 * Safe user representation (without password) for API responses.
 */
export type SafeUser = Omit<User, 'password'>;
