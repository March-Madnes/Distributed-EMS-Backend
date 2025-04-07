// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Evidence {
    enum Role {
        Admin,
        Investigator,
        Validator
    }

    struct EvidenceRecord {
        string cid;
        string originalName;
        string mimeType;
        string hash;
        string encryptedPassword;
        uint256 timestamp;
        string name;
        string description;
        address owner;
    }

    address public constant ADMIN_ADDRESS =
        0x031c7166b87d48E9c99a3B09A6A94Aa55A1969Af;

    mapping(address => Role) public userRoles;
    mapping(uint256 => EvidenceRecord) private evidenceRecords;
    mapping(uint256 => mapping(address => bool)) private evidenceAccess;
    uint256 public evidenceCount;

    event EvidenceAdded(
        address indexed owner,
        uint256 indexed evidenceId,
        string name
    );
    event RoleAssigned(address indexed user, Role role);
    event ValidatorAssigned(
        uint256 indexed evidenceId,
        address indexed validator
    );
    event AccessGranted(uint256 indexed evidenceId, address indexed user);
    event AccessRevoked(uint256 indexed evidenceId, address indexed user);

    modifier onlyAdmin() {
        require(userRoles[msg.sender] == Role.Admin, "Not an admin");
        _;
    }

    modifier onlyInvestigator() {
        require(
            userRoles[msg.sender] == Role.Investigator,
            "Not an Investigator"
        );
        _;
    }

    modifier onlyValidator() {
        require(userRoles[msg.sender] == Role.Validator, "Not a validator");
        _;
    }

    modifier onlyOwner(uint256 evidenceId) {
        require(
            evidenceRecords[evidenceId].owner != address(0),
            "Evidence does not exist"
        );
        require(
            evidenceRecords[evidenceId].owner == msg.sender,
            "Not the evidence owner"
        );
        _;
    }

    constructor() {
        userRoles[ADMIN_ADDRESS] = Role.Admin;
    }

    function assignRole(address _user, Role _role) public {
        userRoles[_user] = _role;
        emit RoleAssigned(_user, _role);
    }

    function getUserRole(address _user) public view returns (Role) {
        return userRoles[_user];
    }

    function addEvidence(
        string memory _cid,
        string memory _originalName,
        string memory _mimeType,
        string memory _hash,
        string memory _encryptedPassword,
        string memory _name,
        string memory _description
    ) public onlyInvestigator {
        evidenceCount++;
        uint256 evidenceId = evidenceCount;
        evidenceRecords[evidenceId] = EvidenceRecord({
            cid: _cid,
            originalName: _originalName,
            mimeType: _mimeType,
            hash: _hash,
            encryptedPassword: _encryptedPassword,
            timestamp: block.timestamp,
            name: _name,
            description: _description,
            owner: msg.sender
        });

        evidenceAccess[evidenceId][msg.sender] = true;
        emit EvidenceAdded(msg.sender, evidenceId, _name);
    }

    function assignValidator(
        uint256 _evidenceId,
        address _validator
    ) public {

        evidenceAccess[_evidenceId][_validator] = true;
        emit ValidatorAssigned(_evidenceId, _validator);
    }

    function grantAccess(
        uint256 _evidenceId,
        address _user
    ) public {
        evidenceAccess[_evidenceId][_user] = true;
        emit AccessGranted(_evidenceId, _user);
    }

    function revokeAccess(
        uint256 _evidenceId,
        address _user
    ) public {
        evidenceAccess[_evidenceId][_user] = false;
        emit AccessRevoked(_evidenceId, _user);
    }

    function getMyEvidenceIds() public view returns (uint256[] memory) {
        uint256 count = 0;

        for (uint256 i = 1; i <= evidenceCount; i++) {
            if (evidenceRecords[i].owner == msg.sender) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= evidenceCount; i++) {
            if (evidenceRecords[i].owner == msg.sender) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }

    function getAccessibleEvidenceIds(
        address _user
    ) public view returns (uint256[] memory) {
        uint256 count = 0;

        // First pass: count how many evidences the user can access
        for (uint256 i = 0; i < evidenceCount; i++) {
            if (evidenceAccess[i][_user] || evidenceRecords[i].owner == _user) {
                count++;
            }
        }

        // Second pass: collect the IDs
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < evidenceCount; i++) {
            if (evidenceAccess[i][_user] || evidenceRecords[i].owner == _user) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }

    function getEvidence(
        uint256 _evidenceId
    )
        public
        view
        returns (
            string memory cid,
            string memory originalName,
            string memory mimeType,
            string memory name,
            string memory description,
            address owner,
            uint256 timestamp
        )
    {

        EvidenceRecord memory evidence = evidenceRecords[_evidenceId];
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
        return evidenceCount;
    }
}
