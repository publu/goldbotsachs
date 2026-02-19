# Goldbot Sachs — Plan

> Goldman Sachs for AI agents. Non-custodial yield on idle USDC. One contract. No server.

## What It Is

AI agents hold USDC but can't earn yield. Goldbot Sachs is a single ERC-4626 vault contract on Base:

- **clawUSDC**: Deposit USDC, get clawUSDC. It appreciates as yield accrues.
- **Beefy yield**: Under the hood, deposits into Beefy's Morpho Steakhouse USDC vault (~4% APY).
- **10% performance fee**: We take 10% of yield. That's it.
- **No server. No API. No custody.** One contract. We never touch user funds.

Bots that want gasless txs can use a Gnosis Safe (5 free txs/day on Base via Gelato). That's their choice — not our problem to solve.

## Architecture

```
Bot (EOA or Safe, doesn't matter)
  │
  │ approve USDC + deposit
  │
  ▼
clawUSDC Vault (ERC-4626) ← our one contract
  │
  │ deposits USDC into Beefy
  │
  ▼
Beefy Morpho Steakhouse USDC (~4% APY)
  │
  │ yield accrues → clawUSDC appreciates
  │
  ▼
Bot withdraws anytime: redeem clawUSDC → get back more USDC than deposited
```

**One contract. No server. No middleware.**

## Key Addresses (Base Mainnet)

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Beefy Morpho Steakhouse USDC: `0xF1C55b6E063ee90A33FFE62deBe618962bae021e`
- clawUSDC: TBD (we deploy)
- Safe Singleton Factory: pre-installed on Base (OP Stack)

## The Contract: ClawUSDC.sol

ERC-4626 vault wrapping Beefy's USDC vault.

**Standard ERC-4626 interface:**
- `deposit(assets, receiver)` → deposits USDC, mints clawUSDC shares
- `withdraw(assets, receiver, owner)` → burns clawUSDC, returns USDC
- `redeem(shares, receiver, owner)` → burns shares, returns USDC
- `totalAssets()` → total USDC in Beefy
- `asset()` → USDC address

**Custom additions:**
- `depositWithPermit(assets, receiver, deadline, v, r, s)` → permit + deposit in one call. Bot signs permit off-chain, calls this. Single tx, no prior approval needed.
- `harvest()` → permissionless. Calculates new yield since last harvest, mints 10% as clawUSDC shares to fee recipient (us). Anyone can call.

**Fee mechanism:**
- On `harvest()`, calculate yield: `currentTotalAssets - lastHarvestTotalAssets`
- Mint 10% of yield as new clawUSDC shares to fee recipient
- Dilutes holders by exactly 10% of yield — standard vault pattern (Yearn v2 does the same)
- Fee percentage and recipient are owner-configurable (capped at 20%)

**Under the hood:**
- Inherits OpenZeppelin ERC4626
- `totalAssets()` = Beefy mooToken balance × `getPricePerFullShare() / 1e18`
- On deposit: USDC → approve Beefy → `beefyVault.deposit(amount)`
- On withdraw: `beefyVault.withdraw(shares)` → USDC back to caller
- Beefy withdrawals are instant — no lockup

## Conway Skill File

A skill file that teaches Conway automatons how to use Goldbot Sachs:

```markdown
# goldbot-sachs

## Deposit idle USDC
1. Approve clawUSDC vault to spend your USDC (or use depositWithPermit)
2. Call deposit(amount, yourAddress) on clawUSDC
3. You now hold clawUSDC — it earns ~4% APY

## Check balance
Read clawUSDC.balanceOf(yourAddress) and clawUSDC.convertToAssets(balance)

## Withdraw
Call clawUSDC.redeem(shares, yourAddress, yourAddress)
```

This is how bots discover us — they install the skill and know how to use the vault.

## Repo Structure

```
goldbotsachs/
  contracts/
    ClawUSDC.sol              — ERC-4626 yield vault (the whole product)
    interfaces/
      IBeefyVault.sol         — Beefy vault interface
  test/
    ClawUSDC.t.sol            — Forge tests
  script/
    Deploy.s.sol              — Deployment script
  skills/
    goldbot-sachs.md          — Conway automaton skill
  foundry.toml
  README.md
```

## Tech Stack

- **Contracts**: Solidity 0.8.x, Foundry (forge)
- **Dependencies**: OpenZeppelin (ERC4626, Ownable)
- **Chain**: Base L2 (chain ID 8453)
- **Yield**: Beefy Finance (Morpho Steakhouse USDC, ~4% APY)
- **No server. No backend. No database.**

## User Flow

### Deposit
1. Bot approves clawUSDC to spend USDC (or uses `depositWithPermit` for single-tx flow)
2. Bot calls `clawUSDC.deposit(amount, botAddress)`
3. USDC moves: bot → clawUSDC vault → Beefy
4. Bot now holds clawUSDC shares

### Earn
- clawUSDC appreciates as Beefy earns yield
- Anyone can call `harvest()` to compound and take fees
- Bot does nothing — yield is automatic

### Withdraw
1. Bot calls `clawUSDC.redeem(shares, botAddress, botAddress)`
2. USDC moves: Beefy → clawUSDC vault → bot
3. Done

### With a Gnosis Safe (optional, for gasless)
- Bot uses a Safe → 5 free txs/day on Base via Gelato
- Deposit: 1 free tx. Withdraw: 1 free tx. Zero gas.

## Gas Summary

| Action | Cost |
|--------|------|
| deposit / depositWithPermit | Caller pays (~$0.001 on Base) or free via Safe |
| redeem / withdraw | Caller pays (~$0.001 on Base) or free via Safe |
| harvest() | Anyone (~$0.001) |

**We pay zero gas.**

## Revenue Model

- 10% performance fee on yield (taken as minted clawUSDC shares)
- $100k TVL × 4% APY = $4k yield → $400/year to us
- $1M TVL = $4k/year
- $10M TVL = $40k/year
- We can hold or sell our clawUSDC fee shares

## MVP Scope

### Phase 1 — Ship it
1. ClawUSDC.sol (ERC-4626 + Beefy + depositWithPermit + harvest + 10% fee)
2. Deploy script
3. Forge tests
4. Conway skill file
5. README
6. Deploy to Base mainnet (amounts are tiny, Base gas is fractions of a cent)

### Phase 2 — Growth
- Landing page at goldbotsachs.com
- Multi-vault support (ETH, other stables)
- Dashboard (TVL, yield, bots served)
- Integrations with other agent frameworks (not just Conway)

## Open Questions

1. Should harvest() be callable by anyone (MEV bots will do it for free) or restricted?
2. Base Sepolia for testing first, or straight to mainnet?

---

*฿hat & Pablo*
