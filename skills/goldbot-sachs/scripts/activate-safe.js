import Safe from '@safe-global/protocol-kit'
import { privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, createWalletClient, http } from 'viem'
import { base } from 'viem/chains'

const RPC_URL = 'https://mainnet.base.org'
const PRIVATE_KEY = process.env.PRIVATE_KEY

if (!PRIVATE_KEY) {
  console.error('Error: PRIVATE_KEY environment variable required')
  process.exit(1)
}

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY)
  const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) })
  const walletClient = createWalletClient({ 
    account, 
    chain: base, 
    transport: http(RPC_URL) 
  })

  console.log('Owner Address:', account.address)

  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: PRIVATE_KEY,
    predictedSafe: {
      safeAccountConfig: {
        owners: [account.address],
        threshold: 1
      },
      safeDeploymentConfig: {
        saltNonce: '1'
      }
    }
  })

  const isDeployed = await protocolKit.isSafeDeployed()
  const safeAddress = await protocolKit.getAddress()

  console.log('Safe Address:', safeAddress)
  console.log('Deployed:', isDeployed)

  if (!isDeployed) {
    console.log('Safe not deployed. Deploying now...')
    const deploymentTx = await protocolKit.createSafeDeploymentTransaction()
    
    const hash = await walletClient.sendTransaction({
      to: deploymentTx.to,
      value: BigInt(deploymentTx.value),
      data: deploymentTx.data
    })
    
    console.log('Deployment Transaction Sent!')
    console.log('Hash:', hash)
    console.log('View on Explorer: https://basescan.org/tx/' + hash)
  } else {
    console.log('Safe is already activated.')
  }
}

main().catch(console.error)
