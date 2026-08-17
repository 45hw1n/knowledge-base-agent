import { gql } from "@apollo/client";

export interface CreditCard {
  id: string;
  name: string;
  bank: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  network: string;
  billingCycleDay: number;
  dueDateDay: number;
}

export const GET_CREDIT_CARDS = gql`
  query getCreditCards {
    getCreditCards {
      id
      name
      bank
      last4
      expiryMonth
      expiryYear
      billingCycleDay
      dueDateDay
    }
  }
`;
export const CREATE_CREDIT_CARD = gql`
  mutation createCreditCard($input: CreateCreditCardInput!) {
    createCreditCard(input: $input) {
      success
      error {
        code
        message
      }
      data {
        id
        name
        bank
        last4
        expiryMonth
        expiryYear
        billingCycleDay
        dueDateDay
      }
    }
  }
`;

export const DELETE_CREDIT_CARD = gql`
  mutation deleteCreditCard($id: ID!) {
    deleteCreditCard(id: $id) {
      success
      error {
        code
        message
      }
    }
  }
`;

export const UPDATE_CREDIT_CARD = gql`
  mutation updateCreditCard($id: ID!, $input: UpdateCreditCardInput!) {
    updateCreditCard(id: $id, input: $input) {
      success
      error {
        code
        message
      }
      data {
        id
        name
        bank
        last4
        expiryMonth
        expiryYear
        billingCycleDay
        dueDateDay
      }
    }
  }
`;