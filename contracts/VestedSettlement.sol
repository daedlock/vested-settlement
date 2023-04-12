// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VestedSettlement {
  uint constant NINETY_DAYS = 3 * 30 days;

  // 50% of the settlement can be claimed immediately
  uint constant CLAIMABLE_IMMEDIATELY_PCT = 50;

  // 25% of the settlement can be claimed periodically (every 3 months)
  uint constant CLAIMABLE_PERIODICALLY_PCT = 25;

  // Amount of settlement to be paid
  uint public settlementAmount;

  // SENDING PARTY (GOGO Protocol Association)
  address public sender;

  // RECEIVER (GOGO Token Holder)
  address public receiver;

  // ARBITER (Trusted Escrow Party)
  address public arbiter;

  // Token used for settlement (USDC)
  address public settlementToken;

  // Time when the first 25% of the settlement can be claimed
  uint public secondClaimUnlockTime;

  // Time when the second 25% of the settlement can be claimed
  uint public thirdClaimUnlockTime;

  // Whether the first 50% of the settlement has been claimed
  bool public receiverFirstClaimed = false;

  // Whether the second 25% of the settlement has been claimed
  bool public receiverSecondClaimed = false;

  // Whether the third 25% of the settlement has been claimed
  bool public receiverThirdClaimed = false;

  // Whether the settlement has been funded by the sender
  bool public funded = false;

  // Whether the contract is frozen
  bool public frozen = false;

  event Funded(uint amount, uint when);
  event Withdrawal(uint amount, uint when);
  event Frozen(uint when);
  event Unfrozen(uint when);

  modifier onlySender() {
    require(msg.sender == sender, "Only the sender can call this function");
    _;
  }
  modifier onlyReceiver() {
    require(msg.sender == receiver, "Only the receiver can call this function");
    _;
  }
  modifier onlyArbiter() {
    require(msg.sender == arbiter, "Only the arbiter can call this function");
    _;
  }

  modifier ifNotFrozen() {
    require(!frozen, "Contract is frozen");
    _;
  }

  constructor(
    address _sender,
    address _receiver,
    address _arbiter,
    address _settlementToken,
    uint _settlementAmount
  ) {
    sender = _sender;
    receiver = _receiver;
    arbiter = _arbiter;
    settlementToken = _settlementToken;
    secondClaimUnlockTime = block.timestamp + NINETY_DAYS;
    thirdClaimUnlockTime = block.timestamp + 2 * NINETY_DAYS;
    settlementAmount = _settlementAmount;
  }

  /**
   * Time until the next claim can be made in seconds
   */
  function timeUntilNextUnlock() public view returns (uint) {
    if (block.timestamp < secondClaimUnlockTime) {
      return secondClaimUnlockTime - block.timestamp;
    } else if (block.timestamp < thirdClaimUnlockTime) {
      return thirdClaimUnlockTime - block.timestamp;
    } else {
      return 0;
    }
  }

  /**
   * Amount of settlement that can be claimed next unlock window
   */
  function amountNextUnlock() public view returns (uint) {
    if (!receiverFirstClaimed) {
      return (settlementAmount * CLAIMABLE_IMMEDIATELY_PCT) / 100;
    }
    if (block.timestamp < thirdClaimUnlockTime) {
      return (settlementAmount * CLAIMABLE_PERIODICALLY_PCT) / 100;
    } else {
      return 0;
    }
  }

  /**
   * Total amount of settlement that has been claimed
   */
  function totalClaimed() public view returns (uint) {
    uint totalClaimed = 0;
    if (receiverFirstClaimed) {
      totalClaimed += (settlementAmount * CLAIMABLE_IMMEDIATELY_PCT) / 100;
    }
    if (receiverSecondClaimed) {
      totalClaimed += (settlementAmount * CLAIMABLE_PERIODICALLY_PCT) / 100;
    }
    if (receiverThirdClaimed) {
      totalClaimed += (settlementAmount * CLAIMABLE_PERIODICALLY_PCT) / 100;
    }
    return totalClaimed;
  }

  /**
   * Called by the sender to fund the settlement as per the terms of the agreement
   */
  function fund() public onlySender ifNotFrozen {
    require(!funded, "Settlement has already been funded");
    IERC20(settlementToken).transferFrom(
      sender,
      address(this),
      settlementAmount
    );
    funded = true;

    emit Funded(settlementAmount, block.timestamp);
  }

  /**
   * Called by receiver to withdraw settlement funds as per the terms of the agreement
   * - 50% of the settlement can be claimed immediately
   * - 25% of the settlement can be claimed periodically (every 3 months)
   */
  function withdraw() public onlyReceiver ifNotFrozen {
    require(funded, "Settlement has not been funded yet");

    if (!receiverFirstClaimed) {
      uint claimableNow = (settlementAmount * CLAIMABLE_IMMEDIATELY_PCT) / 100;
      receiverFirstClaimed = true;
      IERC20(settlementToken).transfer(receiver, claimableNow);
      emit Withdrawal(claimableNow, block.timestamp);
      receiverFirstClaimed = true;
    } else if (
      block.timestamp > secondClaimUnlockTime && !receiverSecondClaimed
    ) {
      uint claimableNow = (settlementAmount * CLAIMABLE_PERIODICALLY_PCT) / 100;
      IERC20(settlementToken).transfer(receiver, claimableNow);
      receiverSecondClaimed = true;
      emit Withdrawal(claimableNow, block.timestamp);
    } else if (
      block.timestamp > thirdClaimUnlockTime && !receiverThirdClaimed
    ) {
      uint claimableNow = (settlementAmount * CLAIMABLE_PERIODICALLY_PCT) / 100;
      IERC20(settlementToken).transfer(receiver, claimableNow);
      receiverThirdClaimed = true;
      emit Withdrawal(claimableNow, block.timestamp);
    } else {
      if (
        receiverFirstClaimed && receiverSecondClaimed && receiverThirdClaimed
      ) {
        revert("All settlement funds have been claimed");
      } else {
        revert("Claim period has not yet passed");
      }
    }
  }

  /**
   * Freeze the contract in case of dispute
   */
  function freeze() public onlyArbiter {
    frozen = true;
    emit Frozen(block.timestamp);
  }

  /**
   * Unfreeze the contract in case of dispute resolution
   */
  function unfreeze() public onlyArbiter {
    frozen = false;
    emit Unfrozen(block.timestamp);
  }

  /**
   * Recover funds in case of dispute resolution
   */
  function recoverFunds() public onlyArbiter {
    IERC20(settlementToken).transfer(
      arbiter,
      IERC20(settlementToken).balanceOf(address(this))
    );
  }

  function recoverERC20(
    address tokenAddress,
    uint tokenAmount
  ) public onlyArbiter {
    require(tokenAddress != settlementToken, "Cannot recover settlement token");
    IERC20(tokenAddress).transfer(arbiter, tokenAmount);
  }
}
