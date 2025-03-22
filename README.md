# Distributed-EMS

### Prerequisits
- Truffle installed globally.
- Installed Dependencies of repo.
- API keys from Pinata.

### Make sure Ganache is running on port `HTTP://127.0.0.1:7545`

 > Use Node version 18.x

### Upload contract 
```
# mac
cd evidence-contract

sudo truffle migrate --network development

# Win
truffle migrate --network development
```

- Update `Server` : const contractAddress = "0xyourDeployContractAddress";
- Copy the ABI created in `build/contracts/Evidence.json` and move to `EvidenceABI.json`

### Run server
```
npm run server
```


Truffle v5.11.5 (core: 5.11.5)
Ganache v7.9.1
Solidity v0.5.16 (solc-js)
Node v18.20.6
Web3.js v1.10.0