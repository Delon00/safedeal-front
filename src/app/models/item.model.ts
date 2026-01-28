export interface Item {
  id: number;
  name: string;
  type: string;
  value: string; // ex: "1.0 ETH"
  priceInWei?: string; // Utile pour la transaction
  seller: string;
  state: 'AVAILABLE' | 'LOCKED' | 'RELEASED';
  ipfsHash: string;
}