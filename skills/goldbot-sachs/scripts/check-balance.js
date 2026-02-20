import Safe from '@safe-global/protocol-kit'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const RPC_URL = 'https://mainnet.base.org'
const SAFE_ADDRESS = process.env.SAFE_ADDRESS

if (!SAFE_ADDRESS) {
  console.error('Error: SAFE_ADDRESS environment variable required')
  process.exit(1)
}

async function main() {
  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })

  console.log('Checking Safe status...')
  console.log('Address:', SAFE_ADDRESS)

  // Check ETH balance
  const ethBalance = await publicClient.getBalance({ address: SAFE_ADDRESS })
  console.log('ETH Balance:', ethBalance.toString(), 'wei')

  // Check USDC balance
  const usdcAbi = [{
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  }] as const

  const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  
  try {
    const usdcBalance = await publicClient.readContract({
      address: usdcAddress,
      abi: usdcAbi,
      functionName: 'balanceOf',
      args: [SAFE_ADDRESS]
    })
    console.log('USDC Balance:', (usdcBalance / 1000000n).toString(), 'USDC')
  } catch (e) {
    console.log('USDC Balance: Unable to fetch')
  }

  // Check if Safe is deployed
  const code = await publicClient.getBytecode({ address: SAFE_ADDRESS })
  const isDeployed = code && code.length > 2
  console.log('Safe Deployed:', isDeployed)

  // Check clawUSDC balance if address provided
  const clawUsdcAddress = process.env.CLAWUSDC_ADDRESS
  if (clawUsdcAddress) {
    const clawAbi = [{
      "constant": true,
      "inputs": [{"name": "account", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"name": "", "type": "uint256"}],
      "type": "function"
    }, {
      "constant": true,
      "inputs": [{"name": "shares", "type": "uint256"}],
      "name": "convertToAssets",
      "outputs": [{"name": "", "type": "uint256"}],
      "type": "function"
    }] as const

    try {
      const shares = await publicClient.readContract({
        address: clawUsdcAddress,
        abi: clawAbi,
        functionName: 'balanceOf',
        args: [SAFE_ADDRESS]
      })
      
      if (shares > 0n) {
        const assets = await publicClient.readContract({
          address: clawUsdcAddress,
          abi: clawAbi,
          functionName: 'convertToAssets',
          args: [shares]
        })
        console.log('clawUSDC Shares:', shares.toString())
        console.log('clawUSDC Value:', (assets / 1000000n).toString(), 'USDC')
      } else {
        console.log('clawUSDC Balance: 0 (not deposited)')
      }
    } catch (e) {
      console.log('clawUSDC Balance: Unable to fetch')
    }
  }
}

main().catch(console.error)
