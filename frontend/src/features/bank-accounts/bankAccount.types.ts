import { gql } from "@apollo/client";

export interface DebitCard {
  id?: string;
  name?: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  network?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bank: string;
  last4: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'SALARY' | 'JOINT';
  upiIds?: string[];
  debitCards?: DebitCard[];
  isPrimary: boolean;
  isActive: boolean;
  openingBalance?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const GET_BANK_ACCOUNTS = gql`
  query getBankAccounts {
    getBankAccounts {
      id
      name
      bank
      last4
      accountType
      upiIds
      debitCards {
        id
        name
        last4
        expiryMonth
        expiryYear
        network
      }
      isPrimary
      isActive
      openingBalance
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_BANK_ACCOUNT = gql`
  mutation createBankAccount($input: CreateBankAccountInput!) {
    createBankAccount(input: $input) {
      success
      error {
        code
        message
      }
      data {
        id
        name
      }
    }
  }
`;

export const UPDATE_BANK_ACCOUNT = gql`
  mutation updateBankAccount($id: ID!, $input: UpdateBankAccountInput!) {
    updateBankAccount(id: $id, input: $input) {
      success
      error {
        code
        message
      }
      data {
        id
        name
      }
    }
  }
`;

export const DELETE_BANK_ACCOUNT = gql`
  mutation deleteBankAccount($id: ID!) {
    deleteBankAccount(id: $id) {
      success
      error {
        code
        message
      }
    }
  }
`;
