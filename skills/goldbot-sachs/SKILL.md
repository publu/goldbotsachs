---
name: goldbot-sachs
description: DeFi yield automation on Base. Deploy Gnosis Safes, deposit USDC into Beefy Morpho vaults via clawUSDC, and refuel ETH via CoW Swap when gas is low. Use when the user wants to (1) earn yield on idle USDC, (2) set up a gasless Safe for DeFi operations, (3) swap USDC to ETH without gas (CoW Swap), or (4) automate DeFi workflows on Base with 5 free daily relay transactions via Gelato.
---

# Goldbot Sachs

Earn ~4% APY on idle USDC via Beefy Morpho vaults. Fully non-custodial on Base with gasless deposits and withdrawals via Safe + Gelato relay.

## Prerequisites

- Node.js and npm
- A wallet with private key (Base mainnet)
- USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

Install dependencies:
```bash
npm install viem @safe-global/protocol-kit @safe-global/relay-kit @cowprotocol/cow-sdk @cowprotocol/sdk-viem-adapter
```

## Quick Start

### 1. Set Environment Variables

```bash
export PRIVATE_KEY="0x..."
export SAFE_ADDRESS=""  # Will be set after activation
```

### 2. Deploy Your Safe

```bash
node scripts/activate-safe.js
```

Save the Safe address and set `SAFE_ADDRESS`.

### 3. Fund the Safe

```bash
node scripts/transfer-to-safe.js
```

### 4. Deposit and Earn

```bash
node scripts/gasless-deposit.js
```

This uses 1 of your 5 free daily relay transactions.

### 5. Check Balances

```bash
export CLAWUSDC_ADDRESS="0x..."  # Optional
node scripts/check-balance.js
```

## CoW Swap Refueling

When your EOA has USDC but no ETH for gas, the refuel script handles everything — permit signing, quoting, and order submission — in one step:

```bash
export PRIVATE_KEY="0x..."
export SELL_AMOUNT="1000000"  # 1 USDC (optional, defaults to 1 USDC)
node scripts/cowswap-refuel.js
```

Zero gas required. A USDC EIP-2612 permit is attached as a CoW pre-hook so no prior approval tx is needed. If the wallet already has allowance, the permit is skipped.

See `references/cowswap-guide.md` for the full SDK integration guide.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Your EOA  │────▶│  Gnosis Safe │────▶│  clawUSDC Vault  │
│  (controls) │     │  (1-of-1)    │     │  (Beefy Morpho)  │
└─────────────┘     └──────────────┘     └──────────────────┘
        │                  │
        │          Gelato Relay (free)
        │                  │
        └──────────▶ CoW Swap (refuel)
```

## Key Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Deposit asset |
| clawUSDC | `0xTBD` | Yield-bearing vault |
| Beefy Morpho | `0xF1C55b6E063ee90A33FFE62deBe618962bae021e` | Underlying yield source |
| CoW Relayer | `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110` | Gasless swap execution |

## Scripts Reference

| Script | Purpose | Gas Cost |
|--------|---------|----------|
| `activate-safe.js` | Deploy 1-of-1 Safe | ~$0.01 (one-time) |
| `transfer-to-safe.js` | Move USDC to Safe | User pays |
| `gasless-deposit.js` | Approve + deposit to vault | Free (relay) |
| `cowswap-refuel.js` | Swap USDC → ETH | Free (CoW) |
| `check-balance.js` | View all balances | Read-only |

## Free Transaction Limits

Safe on Base includes 5 free sponsored transactions per day via Gelato:
- Count resets at UTC midnight
- Batched operations count as 1 tx
- No limit on read-only operations

When limit is reached:
1. Wait for reset (UTC midnight)
2. Or pay gas directly from EOA (~$0.001 per tx on Base)

## Reference Documentation

- `references/overview.md` - Full system overview and ABI reference
- `references/cowswap-guide.md` - Detailed CoW Swap integration guide

## Troubleshooting

**"Safe not deployed"**: Run `activate-safe.js` first.

**"Insufficient USDC allowance"**: The `gasless-deposit.js` script batches approve + deposit. If it fails, you may need to approve first separately.

**"Relay failed"**: You may have exceeded 5 free daily txs. Wait for UTC midnight or execute directly with ETH.

**"CoW order not filling"**: Ensure your signature uses EIP-712 scheme and valid `validTo` timestamp (future time).

## Source

https://github.com/publu/goldbotsachs
