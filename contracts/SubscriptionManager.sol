// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Pausable} from '@openzeppelin/contracts/utils/Pausable.sol';

contract SubscriptionManager is Ownable, Pausable {
    error InvalidDays();
    error Underpaid();
    error RefundFailed();
    error InvalidAddress();

    event Subscribed(address indexed agent, uint256 indexed daysPurchased, uint256 paidWei, uint256 expiryTimestamp);
    event Renewed(address indexed agent, uint256 indexed daysPurchased, uint256 paidWei, uint256 expiryTimestamp);
    event PricePerDayUpdated(uint256 newPricePerDayWei);
    event TreasuryWithdrawn(address indexed to, uint256 amountWei);

    mapping(address => uint256) public subscriptionExpiry;
    mapping(address => uint256) public paymentsMade;

    uint256 public pricePerDayWei;

    constructor(uint256 _pricePerDayWei) Ownable(msg.sender) {
        if (_pricePerDayWei == 0) revert Underpaid();
        pricePerDayWei = _pricePerDayWei;
    }

    receive() external payable {}

    function subscribe(uint256 daysToBuy) external payable whenNotPaused returns (uint256 expiry) {
        expiry = _applySubscription(msg.sender, daysToBuy, msg.value);
        emit Subscribed(msg.sender, daysToBuy, msg.value, expiry);
    }

    function renew(uint256 daysToBuy) external payable whenNotPaused returns (uint256 expiry) {
        expiry = _applySubscription(msg.sender, daysToBuy, msg.value);
        emit Renewed(msg.sender, daysToBuy, msg.value, expiry);
    }

    function isActive(address agent) external view returns (bool) {
        return subscriptionExpiry[agent] > block.timestamp;
    }

    function checkStatus(address agent)
        external
        view
        returns (bool active, uint256 expiryDate, uint256 daysLeft, uint256 paymentCount)
    {
        expiryDate = subscriptionExpiry[agent];
        active = expiryDate > block.timestamp;
        daysLeft = active ? ((expiryDate - block.timestamp + 1 days - 1) / 1 days) : 0;
        paymentCount = paymentsMade[agent];
    }

    function setPricePerDayWei(uint256 _newPricePerDayWei) external onlyOwner {
        if (_newPricePerDayWei == 0) revert Underpaid();
        pricePerDayWei = _newPricePerDayWei;
        emit PricePerDayUpdated(_newPricePerDayWei);
    }

    function withdrawTreasury(address payable to, uint256 amountWei) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (amountWei > address(this).balance) revert Underpaid();
        (bool ok,) = to.call{value: amountWei}("");
        if (!ok) revert RefundFailed();
        emit TreasuryWithdrawn(to, amountWei);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _applySubscription(address agent, uint256 daysToBuy, uint256 amountWei) internal returns (uint256 expiry) {
        if (daysToBuy == 0) revert InvalidDays();

        uint256 requiredWei = daysToBuy * pricePerDayWei;
        if (amountWei < requiredWei) revert Underpaid();

        uint256 baseTs = subscriptionExpiry[agent] > block.timestamp ? subscriptionExpiry[agent] : block.timestamp;
        expiry = baseTs + (daysToBuy * 1 days);
        subscriptionExpiry[agent] = expiry;
        paymentsMade[agent] += 1;

        uint256 refund = amountWei - requiredWei;
        if (refund > 0) {
            (bool ok,) = payable(agent).call{value: refund}("");
            if (!ok) revert RefundFailed();
        }
    }
}
