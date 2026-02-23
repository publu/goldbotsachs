# Beefy Morpho Steakhouse Logic (ClawUSDC)

The Goldbot Sachs strategy uses the **Beefy Morpho Steakhouse USDC** vault as its primary yield source. This document explains the underlying math and interaction flow.

## 1. The Strategy
The strategy deposits USDC into the Morpho Blue protocol, which is a modular lending primitive. Beefy automates the management of these positions to maximize yield while maintaining liquidity.

- **Underlying Protocol**: Morpho Blue
- **Vault Manager**: Beefy Finance
- **Asset**: USDC (Base)
- **Beefy Vault ID**: `morpho-base-steakhouse-high-yield-usdc`

## 2. Interaction Flow (ClawUSDC Wrapper)

The `clawUSDC` contract acts as an ERC-4626 compliant wrapper for the Beefy vault, providing a simplified interface for Goldbot users.

1. **User Deposit**: User sends USDC to the `clawUSDC` contract.
2. **Beefy Minting**: The contract deposits USDC into Beefy and receives `mooUSDC` shares.
3. **Share Calculation**: `clawUSDC` mints its own vault shares to the user based on the current exchange rate.
4. **Performance Fee**: A small portion of the accrued yield (typically 10%) is harvested as a performance fee to maintain the Goldbot infrastructure.

## 3. Math & Yield Calculation

The yield is auto-compounding. The value of your shares increases relative to USDC over time.

### Share Price (Price Per Share)
$$PPS = \frac{Total Assets}{Total Shares}$$

### APY Tracking
Yield is updated every few blocks as Morpho interest accrues. You can check the current APY via the Beefy API:
`https://api.beefy.finance/apy`

## 4. Withdrawal Logic
Withdrawals are instant. When a user redeems `clawUSDC` shares:
1. The contract calculates the required `mooUSDC` to burn.
2. Beefy withdraws USDC from Morpho.
3. USDC is sent back to the user's Safe or EOA.

## 5. Security & Risk
- **Smart Contract Risk**: Interaction with Safe, Beefy, and Morpho.
- **Liquidity Risk**: Yield depends on Morpho utilization.
- **Base Network**: High performance and low fees (~$0.01 per tx).
