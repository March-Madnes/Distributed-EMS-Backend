# Distributed-EMS

### Prerequisits
- Truffle installed globally.
- Installed Dependencies of repo.
- API keys from Pinata.

### Make sure Ganache is running on port `HTTP://127.0.0.1:7545`

### Upload contract 
```
# mac
sudo truffle migrate --network development

# Win
truffle migrate --network development
```

### Copy the ABI created in `build/contracts/Evidence.json` and move to `EvidenceABI.json`

### Run server
```
npm run server
```