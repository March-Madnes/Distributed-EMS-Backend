// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Evidence {
    struct EvidenceRecord {
        string cid;
        string originalName;
        string mimeType;
        string hash; // New field
        string password; // New field
        uint256 timestamp;
        string name; // Evidence name
        string description; // Evidence description
        address owner; // Owner's MetaMask ID
    }

    EvidenceRecord[] public evidenceRecords;

    function addEvidence(
        string memory _cid,
        string memory _originalName,
        string memory _mimeType,
        string memory _hash,
        string memory _password,
        string memory _name,
        string memory _description
    ) public {
        evidenceRecords.push(EvidenceRecord({
            cid: _cid,
            originalName: _originalName,
            mimeType: _mimeType,
            hash: _hash,
            password: _password,
            timestamp: block.timestamp,
            name: _name,
            description: _description,
            owner: msg.sender // Store the owner's address
        }));
    }

    function getEvidence(uint256 _index) public view returns (EvidenceRecord memory) {
        require(_index < evidenceRecords.length, "Index out of bounds");
        return evidenceRecords[_index];
    }

    function getEvidenceCount() public view returns (uint256) {
        return evidenceRecords.length;
    }
}
