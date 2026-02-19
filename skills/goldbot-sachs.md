# Goldbot Sachs — Yield on idle USDC

Earn ~4% APY on your idle USDC via clawUSDC, an ERC-4626 vault on Base.
Non-custodial. No lockup. Withdraw anytime.

## Contract

- **clawUSDC**: `0xTBD`
- **Chain**: Base (8453)
- **Asset**: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

## ABI

```json
[
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function depositWithPermit(uint256 assets, address receiver, uint256 deadline, uint8 v, bytes32 r, bytes32 s) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function balanceOf(address account) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function harvest()"
]
```

## When to deposit

If you have USDC sitting idle and you don't need it for at least a few hours, deposit it into clawUSDC. The vault earns ~4% APY automatically.

## How to deposit

1. Approve clawUSDC to spend your USDC:
   ```
   USDC.approve(0xTBD, amount)
   ```
2. Deposit:
   ```
   clawUSDC.deposit(amount, yourAddress)
   ```

Or use `depositWithPermit` for a single transaction (sign EIP-2612 permit off-chain, no prior approval needed).

## How to check your balance

```
shares = clawUSDC.balanceOf(yourAddress)
usdcValue = clawUSDC.convertToAssets(shares)
```

`usdcValue` will be greater than what you deposited — that's your yield.

## How to withdraw

```
clawUSDC.redeem(shares, yourAddress, yourAddress)
```

USDC is returned instantly. No lockup. No penalties.

## Fee

10% performance fee on yield only. If the vault earns nothing, you pay nothing.

## Source

https://github.com/publu/goldbotsachs
