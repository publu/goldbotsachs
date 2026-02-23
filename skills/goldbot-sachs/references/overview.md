# Goldbot Sachs — Yield on idle USDC

Earn ~4% APY on your idle USDC. Non-custodial vault on Base. Withdraw anytime.

## Overview

Goldbot Sachs is a DeFi yield strategy that:
1. Creates a Gnosis Safe (1-of-1, your control)
2. Deposits USDC into a Beefy Morpho vault via clawUSDC
3. Earns yield while you sleep
4. Allows instant, gasless withdrawals

## Key Components

### Contracts
- **clawUSDC**: The vault wrapper (TBD address)
- **USDC on Base**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Beefy Morpho Steakhouse**: `0xF1C55b6E063ee90A33FFE62deBe618962bae021e`
- **Chain**: Base (8453)

### CoW Swap Integration
When your wallet has USDC but no ETH for gas:
1. Sign a permit for USDC
2. Submit CoW Swap order to sell USDC → ETH
3. Solvers execute, you get ETH for future transactions

### Gasless Transactions
Safe + Gelato relay = 5 free txs/day on Base:
- No ETH needed in Safe
- Batched operations (approve + deposit in one)
- Automatic sponsorship

## Scripts

See `scripts/` folder for executable workflows:
- `activate-safe.js` - Deploy your 1-of-1 Safe
- `transfer-to-safe.js` - Fund the Safe with USDC
- `cowswap-refuel.js` - Get ETH from USDC when empty
- `gasless-deposit.js` - Deposit to earn yield (uses relay)
- `check-balance.js` - View all balances

## Environment Variables

```bash
export PRIVATE_KEY="0x..."
export SAFE_ADDRESS="0x..."
export CLAWUSDC_ADDRESS="0x..."  # Optional, for balance checks
export OWNER_ADDRESS="0x..."     # For CoW Swap
export ORDER_SIGNATURE="0x..."   # For CoW Swap
```

## Installation

```bash
cd /path/to/skill
npm install viem @safe-global/protocol-kit @safe-global/relay-kit
```

## ABI Reference

### clawUSDC Vault
```json
[
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function depositWithPermit(uint256 assets, address receiver, uint256 deadline, uint8 v, bytes32 r, bytes32 s) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function balanceOf(address account) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)"
]
```

### USDC
```json
[
  "function approve(address spender, uint256 amount)",
  "function transfer(address to, uint256 amount)",
  "function balanceOf(address account) view returns (uint256)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)"
]
```

## Yield Source

- **Vault**: Beefy Morpho Steakhouse High Yield USDC
- **Current APY**: Check via `curl -s "https://api.beefy.finance/apy" | jq '.["morpho-base-steakhouse-high-yield-usdc"]'`
- **Fee**: 10% of yield (performance fee taken by Beefy)

## Security Notes

- Safe is 1-of-1 owned by your EOA - you have full control
- clawUSDC is a non-custodial vault - you can withdraw anytime
- No lockup periods or withdrawal penalties
- All transactions are visible on BaseScan
