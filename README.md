# Propyto

## Decentralized Real-World Asset (RWA) Management Platform

Propyto is a blockchain-based platform for managing and trading Real-World Assets (RWAs) in a decentralized manner. It enables fractional ownership, property listings, rentals, and transparent property management using smart contracts on the Polygon network.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Deployment](#deployment)
- [Scripts](#scripts)
- [Error Handling](#error-handling)
- [Contract Methods](#contract-methods)
- [License](#license)

## Overview

Propyto revolutionizes real estate and asset management by tokenizing physical assets on the blockchain. This enables fractional ownership, transparent transactions, and automated management of real-world assets through smart contracts.

## Features

- **Asset Tokenization**: Convert real-world assets into on-chain digital representations
- **Fractional Ownership**: Enable partial ownership of high-value assets
- **Marketplace Integration**: Buy, sell, and rent properties through a decentralized marketplace
- **Governance System**: Property-related decisions through on-chain voting
- **Rental Management**: Automated rental agreements and payments
- **Transparent Records**: Immutable history of asset transactions and changes

## Tech Stack

- **Smart Contracts**: Solidity 0.8.28
- **Development Framework**: Hardhat
- **Contract Standards**: ERC1155 (PropytoSFT)
- **Testing**: HardHat Test Suite
- **Security**: OpenZeppelin Contracts (upgradeable, reentrancy guards, pausable)
- **Deployment**: OpenZeppelin Upgrades Plugin

## Project Structure

```
propyto/
├── contracts/              # Smart contracts
│   ├── PropytoRegistry.sol # Main registry for managing assets
│   ├── PropytoSFT.sol      # ERC1155 implementation for asset tokenization
│   └── MockERC20.sol       # Test token for development
├── scripts/                # Deployment and interaction scripts
│   ├── deploy.ts           # Main deployment script
│   ├── listAsset.ts        # Script for listing assets
│   ├── buyAsset.ts         # Script for buying assets
│   └── manageAsset.ts      # Asset management utilities
├── test/                   # Test suite
├── artifacts/              # Compiled contract artifacts
├── cache/                  # Hardhat cache
├── errors.json             # Error code definitions
└── hardhat.config.ts       # Hardhat configuration
```

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```
PRIVATE_KEY=your_private_key_here
POLYGON_RPC_URL=https://polygon-rpc.com
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/0xrobinr/propyto.git
   cd propyto
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile contracts:
   ```bash
   npx hardhat compile
   ```

## Deployment

Deploy to local development network:

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

Deploy to Polygon Amoy testnet:

```bash
npx hardhat run scripts/deploy.ts --network amoy
```

Deploy to Polygon mainnet:

```bash
npx hardhat run scripts/deploy.ts --network polygon
```

The deployment script will:
1. Deploy a mock USDT token (for testing)
2. Deploy and initialize the PropytoRegistry contract
3. Configure marketplace parameters
4. Save contract addresses in `scripts/config.json`

## Scripts

### Deploy Contracts
```bash
npx hardhat run scripts/deploy.ts --network <network-name>
```

### List an Asset
```bash
npx hardhat run scripts/listAsset.ts --network <network-name>
```

### Buy Asset Shares
```bash
npx hardhat run scripts/buyAsset.ts --network <network-name>
```

### Manage Asset
```bash
npx hardhat run scripts/manageAsset.ts --network <network-name>
```

## Error Handling

The `errors.json` file contains all error codes and their descriptions used throughout the contracts. This standardized approach ensures consistent error reporting and improves debugging.

Key error codes include:

| Code | Description |
|------|-------------|
| E1   | Asset must have partial ownership enabled in its settings |
| E2   | Partial ownership already initialized |
| E3   | Total shares must be greater than zero |
| E7   | Asset does not exist |
| E11  | Asset is not available for purchase |
| E13  | Partial ownership not initialized for this asset |
| E20  | Price must be greater than zero |
| E24  | Fee percentage cannot exceed 30% |

## Contract Methods

### PropytoRegistry

#### Asset Management
- `registerAsset(...)`: Register a new asset in the system
- `updateAssetDetails(...)`: Update asset details
- `enablePartialOwnership(...)`: Enable fractional ownership for an asset

#### Transaction Methods
- `purchaseShares(...)`: Purchase an entire asset or  partial shares of an asset

### PropytoSFT

- `tokenizeAsset(...)`: Create a new token for an asset
- `mintShares(...)`: Mint new shares for an asset
- `burnShares(...)`: Burn/destroy shares

## License

This project is licensed under the MIT License.
