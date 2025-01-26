// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Evidence {
    struct EvidenceRecord {
        string cid;
        string originalName;
        string mimeType;
        string hash; 
        string encryptedPassword; // Updated field for security
        uint256 timestamp;
        string name; 
        string description; 
        address owner; 
    }

    EvidenceRecord[] private evidenceRecords;  // Made private

    event EvidenceAdded(address indexed owner, string cid, string name);

    function addEvidence(
        string memory _cid,
        string memory _originalName,
        string memory _mimeType,
        string memory _hash,
        string memory _encryptedPassword, // Updated
        string memory _name,
        string memory _description
    ) public {
        evidenceRecords.push(EvidenceRecord({
            cid: _cid,
            originalName: _originalName,
            mimeType: _mimeType,
            hash: _hash,
            encryptedPassword: _encryptedPassword,
            timestamp: block.timestamp,
            name: _name,
            description: _description,
            owner: msg.sender
        }));

        emit EvidenceAdded(msg.sender, _cid, _name);
    }

    function getEvidence(uint256 _index) public view returns (
        string memory cid,
        string memory originalName,
        string memory mimeType,
        string memory name,
        string memory description,
        address owner,
        uint256 timestamp
    ) {
        require(_index < evidenceRecords.length, "Index out of bounds");
        EvidenceRecord memory evidence = evidenceRecords[_index];
        return (
            evidence.cid,
            evidence.originalName,
            evidence.mimeType,
            evidence.name,
            evidence.description,
            evidence.owner,
            evidence.timestamp
        );
    }

    function getEvidenceCount() public view returns (uint256) {
        return evidenceRecords.length;
    }
}
