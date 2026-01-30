import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ethers } from 'ethers';

declare global {
  interface Window { ethereum: any; }
}

@Injectable({
  providedIn: 'root'
})
export class Web3Service {
  private provider: ethers.BrowserProvider | undefined;
  private signer: ethers.JsonRpcSigner | undefined;
  
  private readonly contractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

  private readonly contractABI = [
    "function itemCount() view returns (uint256)", 
    "function createItem(string name, string itemType, uint256 price, string ipfsHash) public",
    "function purchaseItem(uint256 _itemId) external payable",
    "function confirmReceipt(uint256 _itemId) external",
    "function items(uint256) view returns (uint256 id, string name, string itemType, uint256 value, uint8 state, address seller, address buyer, string ipfsHash)"
  ];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId) && window.ethereum) {
      this.provider = new ethers.BrowserProvider(window.ethereum);
    }
  }

  // --- LECTURE (Pas de try/catch complexe ici car pas de gas) ---
  async loadMarketplace(): Promise<any[]> {
    if (!this.provider) return [];
    const contract = new ethers.Contract(this.contractAddress, this.contractABI, this.provider);
    
    try {
      const count = await contract['itemCount']();
      const items = [];

      for (let i = 0; i < Number(count); i++) {
        const item = await contract['items'](i);
        items.push({
          id: Number(item.id),
          name: item.name,
          type: item.itemType,
          value: ethers.formatEther(item.value) + ' ETH',
          priceRaw: item.value,
          state: this.getStateName(item.state),
          seller: item.seller,
          buyer: item.buyer
        });
      }
      return items;
    } catch (error) {
      console.error("Erreur chargement:", error);
      return [];
    }
  }

  // --- ÉCRITURE (Avec gestion d'erreurs avancée) ---

async createItem(name: string, itemType: string, priceEth: string): Promise<ethers.TransactionResponse> {
    if (!this.signer) await this.connectWallet();

    const contract = new ethers.Contract(this.contractAddress, this.contractABI, this.signer!);
    const priceInWei = ethers.parseEther(priceEth);
    
    let realIpfsHash = "QmDefault..."; 
    if (itemType === 'Immobilier') realIpfsHash = "QmHouseHash"; 
    if (itemType === 'Véhicule') realIpfsHash = "QmCarHash";
    
    const ipfsLink = `ipfs://${realIpfsHash}`; 

    try {
      return await contract['createItem'](name, itemType, priceInWei, ipfsLink);
    } catch (error) {
      throw new Error(this.handleError(error));
    }
  }

  async purchaseItem(itemId: number, priceEth: string): Promise<ethers.TransactionResponse> {
    if (!this.signer) await this.connectWallet();
    const contract = new ethers.Contract(this.contractAddress, this.contractABI, this.signer!);
    const priceClean = priceEth.replace(' ETH', '').trim();
    const priceInWei = ethers.parseEther(priceClean);

    try {
      return await contract['purchaseItem'](itemId, { value: priceInWei });
    } catch (error) {
      throw new Error(this.handleError(error));
    }
  }

  async confirmReceipt(itemId: number): Promise<ethers.TransactionResponse> {
    if (!this.signer) await this.connectWallet();
    const contract = new ethers.Contract(this.contractAddress, this.contractABI, this.signer!);
    
    try {
      return await contract['confirmReceipt'](itemId);
    } catch (error) {
      throw new Error(this.handleError(error));
    }
  }

  // --- UTILITAIRES ---

// 🛡️ TRADUCTEUR UTILISATEUR (UX Friendly)
  private handleError(error: any): string {
    console.warn("Analyse erreur:", error); // Garde ça pour toi développeur

    // 1. On récupère tout le texte technique en vrac
    // On cherche dans toutes les propriétés possibles où Ethers/Hardhat cachent le message
    const rawMessage = (error.reason || error.shortMessage || error.message || "").toLowerCase();

    // 2. Annulation volontaire
    if (rawMessage.includes("rejected") || error.code === 4001) {
      return "Action annulée. Vous n'avez rien payé.";
    }

    // 3. 🎯 DÉTECTION PRÉCISE (Basée sur tes 'require' Solidity)
    
    // Si le contrat dit : "Cooldown actif"
    if (rawMessage.includes("cooldown") || rawMessage.includes("attendez")) {
      return "⏳ Hop là ! Vous devez attendre 5 minutes entre chaque action. Prenez une pause ☕";
    }

    // Si le contrat dit : "Limite atteinte"
    if (rawMessage.includes("limite") || rawMessage.includes("max 4")) {
      return "🚫 Plafond atteint : Vous possédez déjà 4 articles (le maximum autorisé).";
    }

    // Si le contrat dit : "Trop tot" ou "Lock"
    if (rawMessage.includes("trop tot") || rawMessage.includes("lock")) {
      return "🔒 Sécurité : Les fonds sont verrouillés 10 minutes. Revenez un peu plus tard !";
    }

    // Si le contrat dit : "Pas disponible"
    if (rawMessage.includes("pas disponible")) {
      return "Oups, cet article n'est plus disponible à la vente.";
    }

    // Si le contrat dit : "Montant incorrect"
    if (rawMessage.includes("montant incorrect")) {
      return "Le montant envoyé ne correspond pas au prix de l'article.";
    }

    // 4. Problèmes de fonds (ETH)
    if (rawMessage.includes("insufficient funds") || rawMessage.includes("exceeds balance")) {
      return "💸 Fonds insuffisants : Vous n'avez pas assez d'ETH pour payer l'article + les frais.";
    }

    // 5. Le cas "Mystère" (CALL_EXCEPTION / missing revert data)
    // C'est quand la blockchain bloque sans donner la raison exacte (souvent le Cooldown sur Hardhat)
    if (rawMessage.includes("missing revert data") || error.code === 'CALL_EXCEPTION') {
      return "⚠️ Action bloquée par la sécurité.\n\nVérifiez que :\n Le délai de 5 min est passé\n ou que Vous n'avez pas déjà 4 articles.";
    }

    // 6. Erreur technique inconnue (Dernier recours)
    return "Une erreur inattendue est survenue. Réessayez plus tard.";
  }

  private getStateName(state: number): string {
    switch (Number(state)) {
      case 0: return 'AVAILABLE';
      case 1: return 'LOCKED';
      case 2: return 'RELEASED';
      default: return 'UNKNOWN';
    }
  }

  get isMetamaskInstalled(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return typeof window.ethereum !== 'undefined';
  }

  async connectWallet(): Promise<string> {
    if (!this.provider) throw new Error("Metamask non installé");
    await this.provider.send("eth_requestAccounts", []);
    this.signer = await this.provider.getSigner();
    return await this.signer.getAddress();
  }

  async getBalance(address: string): Promise<string> {
    if (!this.provider) return '0';
    const balanceWei = await this.provider.getBalance(address);
    return ethers.formatEther(balanceWei);
  }
}