"use client";

import { createConfig, http } from "wagmi";
import { polygon, base } from "wagmi/chains";
import { metaMask } from "wagmi/connectors";

/**
 * Config de wagmi limitada a las dos redes que OMI soporta al lanzar:
 * Polygon y Base. Agregar una red nueva más adelante es solo sumarla
 * acá + el contrato USDC correspondiente en el backend (config.py).
 */
export const wagmiConfig = createConfig({
  chains: [polygon, base],
  connectors: [metaMask()],
  transports: {
    [polygon.id]: http(),
    [base.id]: http(),
  },
});

// Direcciones de los contratos USDC en cada red (públicas, no secretas).
export const USDC_CONTRACTS: Record<number, `0x${string}`> = {
  [polygon.id]: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

export const USDC_DECIMALS = 6;

export const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
