// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

/// @title Allows a specified address to hold and withdraw value, and pass on to an inheritor in case of extended inactivity
contract Inheritance {
    address public owner;
    address public heir;
    uint public lastWithdrawnTime;
    uint ONE_MONTH = 30 days;

    constructor(address _owner, address _heir) {
        owner = _owner;
        heir = _heir;
        lastWithdrawnTime = block.timestamp;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyHeir() {
        require(msg.sender == heir, "not heir");
        _;
    }

    /// @notice withdraws the specified eth and resets the inheritance counter
    /// @param _amountInWei the amount to withdraw in wei. Can be 0 to just reset the counter
    function withdraw(uint _amountInWei) public onlyOwner {
        require(
            address(this).balance >= _amountInWei,
            "Not enough Ether in contract!"
        );

        lastWithdrawnTime = block.timestamp;

        bool sent = payable(owner).send(_amountInWei);
        require(sent, "Failed to withdraw Ether");
    }

    /// @notice sets heir as owner and appoints new heir if 30 days have passed since owner last active
    /// @param _newHeir address of the new heir
    function inherit(address _newHeir) public onlyHeir {
        require(
            (block.timestamp > (lastWithdrawnTime + ONE_MONTH)),
            "owner still active"
        );
        owner = msg.sender;
        heir = _newHeir;
        lastWithdrawnTime = block.timestamp;
    }

    ///  @notice contract can receive Ether.
    receive() external payable {}
}
