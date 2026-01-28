import { TestBed } from '@angular/core/testing';

import { Web3 } from './web3';

describe('Web3', () => {
  let service: Web3;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Web3);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
