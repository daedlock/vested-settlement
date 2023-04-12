# Vested settlement - Escrow smart contract 
*Inspired by https://github.com/JackBekket/escrow-eth*


Smart contract to facilitate fund movement between two parties (sender, receiver) leveraging escrow mechanics in smart contract. A trusted third party (arbiter) has access to freeze/unfreeze the settlement in case of disputes.

![Diagram](/assets/dia.png)

## Sender
The party offering a token to the receiver party

Allowed actions:
- Fund: Fund the smart contract with the settlement token (usually USDC)


## Receiver
The party receiving the token from sender

Allowed actions:
- Withdraw: Withdraw funds from the escrow smart contract following the following vesting mechanics
  - 50% claimable immediately
  - 25% claimable after T + 90 days 
  - 25% claimable after T + 180 days

## Arbiter
Moderating trusted third-party responsible for resolving any disputes

Allowed actions:
- Freeze: Freeze the contract operations preventing any subsequent withdrawals
- Unfreeze: resume contract operations
- Recover: recover any amount of settlement token from the escrow contract
- RecoverERC20: recover any other token sent by mistake to this contract


# Tests
Included in the repo are comrpehensaive test cases against the contract logic. Here is the test output for all scenarios

```
  VestedSettlement
    Fund
      ✔ Sender: Should fund the contract (61ms)
      ✔ Receiver/Arbiter: Should not fund the contract
    Withdraw
      ✔ should allow receiver to claim 50% immediately then 25% every 90 days (139ms)
      ✔ should disallow withdraw from any other party
      ✔ should disallow withdraw before funding
    Freeze
      ✔ should allow arbiter or receiver to freeze
      ✔ should disallow receiver to freeze
      ✔ should disallow sender to freeze
      ✔ should allow arbiter only to unfreeze
      ✔ should revert on fund if frozen
      ✔ should revert on withdraw if frozen (38ms)
    Arbiter: Recover Funds
      ✔ should allow arbiter to recover funds (38ms)
      ✔ should disallow sender to recover funds
      ✔ should disallow receiver to recover funds
    recoverERC20
      ✔ should allow arbiter to recover ERC20 (65ms)
      ✔ should disallow sender to recover ERC20 (45ms)
      ✔ should disallow receiver to recover ERC20 (48ms)
```