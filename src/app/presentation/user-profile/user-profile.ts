import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Web3Service } from '../../services/web3';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './user-profile.html',
  styleUrls: ['./user-profile.scss'] 
})
export class UserProfile implements OnInit {
  currentAccount = '';
  userBalance = '0';
  
  // ✅ Variable pour la catégorie (Valeur par défaut importante)
  newItemType: string = 'Clé';
  
  myItems: any[] = []; 

  // Logique de création
  newItemName = '';
  newItemPrice = '';
  loading = false;
  message = '';
  error = false;

  constructor(
    private web3: Web3Service,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.refreshWalletInfo();
    // On charge aussi les items dès le démarrage
    await this.loadMyItems(); 
  }

  async refreshWalletInfo() {
    if (this.web3.isMetamaskInstalled) {
      try {
        this.currentAccount = await this.web3.connectWallet();
        this.userBalance = await this.web3.getBalance(this.currentAccount);
        this.cdr.detectChanges();
      } catch (e) { console.warn(e); }
    }
  }

  // Charge et filtre les articles du user connecté
  async loadMyItems() {
    const allItems = await this.web3.loadMarketplace();
    
    if (this.currentAccount) {
      // On ne garde que ceux où le vendeur == moi
      this.myItems = allItems.filter(item => 
        item.seller.toLowerCase() === this.currentAccount.toLowerCase()
      );
    }
    this.cdr.detectChanges();
  }

  async onCreateItem() {
    if (!this.newItemName || !this.newItemPrice) return;

    try {
      this.loading = true;
      this.message = "Signature Metamask requise...";
      this.error = false;
      this.cdr.detectChanges();

      const priceAsString = String(this.newItemPrice); 

      // 👇 C'EST ICI LA CORRECTION IMPORTANTE 👇
      // On passe (Nom, TYPE, Prix)
      const tx = await this.web3.createItem(
        this.newItemName, 
        this.newItemType,
        priceAsString
      );
      
      this.message = "Transaction envoyée... Attente de validation ⏳";
      this.cdr.detectChanges();

      await tx.wait();

      this.message = "✅ Article créé avec succès !";
      
      // Reset du formulaire
      this.newItemName = '';
      this.newItemPrice = '';
      this.newItemType = 'Clé'; // On remet la valeur par défaut

      await this.refreshWalletInfo();
      await this.loadMyItems();

    } catch (err: any) {
      // Notre Web3Service renvoie maintenant un message propre, on l'affiche direct
      this.message = err.message; 
      this.error = true;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}