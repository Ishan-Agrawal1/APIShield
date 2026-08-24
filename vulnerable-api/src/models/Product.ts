/**
 * Product model interface for the vulnerable API lab.
 */
export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  createdBy: number; // User ID of creator
}
