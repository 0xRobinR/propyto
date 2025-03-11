# Propyto Deployment Guide

This document provides instructions for deploying the Propyto smart contracts using Hardhat Ignition.

## Project Structure

The deployment scripts are organized as follows:

```
├── ignition/
│   ├── modules/
│   │   ├── MockUSDT.ts                 # Module for deploying a mock USDT token (for local testing)
│   │   └── PropytoDeployment.ts        # Main deployment module for PropytoRegistry and PropytoSFT
│   ├── deployments/
│   │   ├── local.ts                    # Local deployment configuration
│   │   ├── testnet.ts                  # Testnet (Mumbai) deployment configuration
│   │   └── mainnet.ts                  # Mainnet (Polygon) deployment configuration
│   ├── network-config.ts               # Network-specific configurations
│   └── types.ts                        # TypeScript types and interfaces
├── scripts/
│   └── deploy.ts                       # Helper script for deployment and verification
└── hardhat.config.ts                   # Hardhat configuration
```

## Prerequisites

1. Node.js and npm installed
2. Create a `.env` file in the project root with the following variables:
   ```
   PRIVATE_KEY=your_private_key
   POLYGON_RPC_URL=your_polygon_rpc_url
   MUMBAI_RPC_URL=your_mumbai_rpc_url
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

## Installation

Install the required dependencies:

```bash
npm install
```

## Deployment Process

### 1. Local Development

To deploy to a local Hardhat network:

```bash
# Start a local Hardhat node
npx hardhat node

# In a separate terminal, deploy using the local module
npx hardhat deploy --module local --network localhost
```

This will:
- Deploy a mock USDT token
- Deploy PropytoRegistry with a proxy
- Deploy PropytoSFT with a proxy
- Link the contracts together
- Configure marketplace settings

### 2. Testnet Deployment (Mumbai)

To deploy to the Mumbai testnet:

```bash
npx hardhat deploy --module testnet --network mumbai
```

This will:
- Use the existing USDT token on Mumbai
- Deploy PropytoRegistry with a proxy
- Deploy PropytoSFT with a proxy
- Link the contracts together
- Configure marketplace settings

### 3. Mainnet Deployment (Polygon)

To deploy to the Polygon mainnet:

```bash
npx hardhat deploy --module mainnet --network polygon
```

This will:
- Use the existing USDT token on Polygon
- Deploy PropytoRegistry with a proxy
- Deploy PropytoSFT with a proxy
- Link the contracts together
- Configure marketplace settings

## Contract Verification

The contract verification is handled automatically in the deployment script. If you need to verify the contracts manually:

```bash
npx hardhat verify --network polygon <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

For proxy contracts, you'll need to verify both the implementation contract and the proxy contract.

## Deployment Outputs

After successful deployment, the contract addresses will be saved in a JSON file in the `deployments` directory with the network name (e.g., `mumbai.json`).

The JSON file contains:
- `registryAddress`: The address of the PropytoRegistry proxy
- `sftAddress`: The address of the PropytoSFT proxy
- `usdtAddress`: The address of the USDT token (or mock USDT for local deployments)

## Upgrading Contracts

If you need to upgrade the contracts in the future, you can use the OpenZeppelin Upgrades plugin:

```typescript
// Example for upgrading PropytoRegistry
const PropytoRegistryV2 = await ethers.getContractFactory("PropytoRegistryV2");
const upgradedRegistry = await upgrades.upgradeProxy(registryAddress, PropytoRegistryV2);
```

## Troubleshooting

If you encounter any issues during deployment:

1. Make sure your `.env` file is properly configured
2. Check that you have sufficient funds in your wallet for gas
3. For testnet and mainnet deployments, ensure you're connected to the correct RPC endpoints
4. If a deployment fails partway through, you may need to clean up the Ignition artifacts before retrying:
   ```bash
   npx hardhat ignition clear
   ```

For any other issues, please open an issue in the project repository or contact the development team. 