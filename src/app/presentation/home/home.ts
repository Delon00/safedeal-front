import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Web3Service } from '../../services/web3';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  
  allItems: any[] = [];  
  displayedItems: any[] = [];
  
  activeFilter: string = 'Tout';

  loading = false;
  message = '';
  error = false;

  constructor(
    private web3: Web3Service,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.loadProducts();
  }

  async loadProducts() {
    this.loading = true;
    this.allItems = await this.web3.loadMarketplace();
    this.applyFilter();
    this.loading = false;
    this.cdr.detectChanges();
  }

  setFilter(category: string) {
    this.activeFilter = category;
    this.applyFilter();
  }

  private applyFilter() {
    if (this.activeFilter === 'Tout') {
      this.displayedItems = [...this.allItems];
    } else {
      this.displayedItems = this.allItems.filter(item => item.type === this.activeFilter);
    }
  }

  async onBuy(item: any) {
    if (!this.web3.isMetamaskInstalled) { alert("Installez Metamask !"); return; }

    try {
      this.loading = true;
      this.message = "Validation MetaMask...";
      this.error = false; 
      this.cdr.detectChanges();

      const tx = await this.web3.purchaseItem(item.id, item.value);
      
      this.message = "Achat en cours... ⏳";
      this.cdr.detectChanges();
      
      await tx.wait();

      this.message = "✅ Achat réussi !";
      this.loadProducts(); 

    } catch (err: any) {
      this.message = err.message;
      this.error = true;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async onConfirm(item: any) {
    try {
      this.loading = true;
      this.message = "Validation MetaMask...";
      this.error = false;
      this.cdr.detectChanges();

      const tx = await this.web3.confirmReceipt(item.id);
      await tx.wait();

      this.message = "✅ Fonds libérés !";
      this.loadProducts();
    } catch (err: any) {
      this.message = err.message;
      this.error = true;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}