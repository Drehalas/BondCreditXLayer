// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {Pausable} from '@openzeppelin/contracts/utils/Pausable.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

interface ISubscriptionManager {
    function isActive(address agent) external view returns (bool);
}

contract PaymentGuarantor is AccessControl, Pausable, ReentrancyGuard {
    error InvalidAddress();
    error InvalidAmount();
    error SubscriptionInactive();
    error InsufficientLiquidity();
    error GuaranteeNotFound();
    error GuaranteeExpired();
    error GuaranteeInactive();
    error NotGuaranteeOwner();
    error AlreadyFinalized();
    error RepayValueTooLow();
    error WithdrawalExceedsFreeLiquidity();
    error RefundFailed();

    bytes32 public constant VERIFIER_ROLE = keccak256('VERIFIER_ROLE');
    bytes32 public constant TREASURY_ROLE = keccak256('TREASURY_ROLE');

    struct Guarantee {
        address agent;
        address recipient;
        uint256 amountWei;
        uint256 feeWei;
        uint256 createdAt;
        uint256 expiresAt;
        bool active;
        bool used;
        bool cancelled;
        bool repaid;
        bytes32 x402PayloadHash;
    }

    event PoolFunded(address indexed funder, uint256 amountWei, uint256 poolBalance);
    event PoolWithdrawn(address indexed to, uint256 amountWei, uint256 poolBalance);
    event GuaranteeCreated(
        bytes32 indexed guaranteeId,
        address indexed agent,
        address indexed recipient,
        uint256 amountWei,
        uint256 feeWei,
        uint256 expiresAt
    );
    event GuaranteeCancelled(bytes32 indexed guaranteeId, address indexed cancelledBy);
    event GuaranteeUsed(bytes32 indexed guaranteeId, bytes32 indexed x402PayloadHash, address indexed verifier);
    event GuaranteeRepaid(bytes32 indexed guaranteeId, address indexed payer, uint256 paidWei);

    ISubscriptionManager public immutable subscriptionManager;

    uint256 public immutable maxGuaranteeTtlSeconds;
    uint256 public feeBps;
    uint256 public totalOutstandingWei;

    mapping(address => uint256) public outstandingByAgent;
    mapping(bytes32 => Guarantee) public guarantees;
    mapping(address => uint256) public guaranteeNonce;

    constructor(address _subscriptionManager, uint256 _feeBps, uint256 _maxGuaranteeTtlSeconds, address admin) {
        if (_subscriptionManager == address(0) || admin == address(0)) revert InvalidAddress();
        if (_feeBps > 5_000) revert InvalidAmount();
        if (_maxGuaranteeTtlSeconds == 0) revert InvalidAmount();

        subscriptionManager = ISubscriptionManager(_subscriptionManager);
        feeBps = _feeBps;
        maxGuaranteeTtlSeconds = _maxGuaranteeTtlSeconds;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    receive() external payable {
        emit PoolFunded(msg.sender, msg.value, address(this).balance);
    }

    function fundPool() external payable whenNotPaused {
        if (msg.value == 0) revert InvalidAmount();
        emit PoolFunded(msg.sender, msg.value, address(this).balance);
    }

    function withdrawPool(address payable to, uint256 amountWei)
        external
        whenNotPaused
        nonReentrant
        onlyRole(TREASURY_ROLE)
    {
        if (to == address(0)) revert InvalidAddress();
        if (amountWei == 0) revert InvalidAmount();
        if (amountWei > freeLiquidityWei()) revert WithdrawalExceedsFreeLiquidity();

        (bool ok,) = to.call{value: amountWei}("");
        if (!ok) revert RefundFailed();

        emit PoolWithdrawn(to, amountWei, address(this).balance);
    }

    function createGuarantee(address recipient, uint256 amountWei, uint256 ttlSeconds)
        external
        whenNotPaused
        returns (bytes32 guaranteeId)
    {
        if (recipient == address(0)) revert InvalidAddress();
        if (amountWei == 0) revert InvalidAmount();
        if (ttlSeconds == 0 || ttlSeconds > maxGuaranteeTtlSeconds) revert InvalidAmount();

        bool activeSub = subscriptionManager.isActive(msg.sender);
        if (!activeSub) revert SubscriptionInactive();

        if (amountWei > freeLiquidityWei()) revert InsufficientLiquidity();

        uint256 feeWei = (amountWei * feeBps) / 10_000;
        uint256 expiresAt = block.timestamp + ttlSeconds;

        guaranteeId = keccak256(
            abi.encodePacked(msg.sender, recipient, amountWei, ttlSeconds, block.chainid, guaranteeNonce[msg.sender]++)
        );

        guarantees[guaranteeId] = Guarantee({
            agent: msg.sender,
            recipient: recipient,
            amountWei: amountWei,
            feeWei: feeWei,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            active: true,
            used: false,
            cancelled: false,
            repaid: false,
            x402PayloadHash: bytes32(0)
        });

        outstandingByAgent[msg.sender] += amountWei;
        totalOutstandingWei += amountWei;

        emit GuaranteeCreated(guaranteeId, msg.sender, recipient, amountWei, feeWei, expiresAt);
    }

    function cancelGuarantee(bytes32 guaranteeId) external whenNotPaused {
        Guarantee storage g = guarantees[guaranteeId];
        if (g.agent == address(0)) revert GuaranteeNotFound();
        if (!g.active) revert GuaranteeInactive();
        if (g.used || g.repaid) revert AlreadyFinalized();
        if (g.expiresAt <= block.timestamp) revert GuaranteeExpired();

        if (msg.sender != g.agent && !hasRole(VERIFIER_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotGuaranteeOwner();
        }

        g.active = false;
        g.cancelled = true;

        outstandingByAgent[g.agent] -= g.amountWei;
        totalOutstandingWei -= g.amountWei;

        emit GuaranteeCancelled(guaranteeId, msg.sender);
    }

    function markGuaranteeUsed(bytes32 guaranteeId, bytes32 x402PayloadHash)
        external
        whenNotPaused
        onlyRole(VERIFIER_ROLE)
    {
        Guarantee storage g = guarantees[guaranteeId];
        if (g.agent == address(0)) revert GuaranteeNotFound();
        if (!g.active) revert GuaranteeInactive();
        if (g.expiresAt <= block.timestamp) revert GuaranteeExpired();

        g.active = false;
        g.used = true;
        g.x402PayloadHash = x402PayloadHash;

        emit GuaranteeUsed(guaranteeId, x402PayloadHash, msg.sender);
    }

    function repayGuarantee(bytes32 guaranteeId)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Guarantee storage g = guarantees[guaranteeId];
        if (g.agent == address(0)) revert GuaranteeNotFound();
        if (!g.used) revert GuaranteeInactive();
        if (g.repaid) revert AlreadyFinalized();

        uint256 required = g.amountWei + g.feeWei;
        if (msg.value < required) revert RepayValueTooLow();

        g.repaid = true;

        outstandingByAgent[g.agent] -= g.amountWei;
        totalOutstandingWei -= g.amountWei;

        uint256 refund = msg.value - required;
        if (refund > 0) {
            (bool ok,) = payable(msg.sender).call{value: refund}("");
            if (!ok) revert RefundFailed();
        }

        emit GuaranteeRepaid(guaranteeId, msg.sender, required);
    }

    function checkGuarantee(bytes32 guaranteeId)
        external
        view
        returns (bool active, bool used, bool cancelled, bool repaid, uint256 expiresAt, bytes32 payloadHash)
    {
        Guarantee memory g = guarantees[guaranteeId];
        if (g.agent == address(0)) {
            return (false, false, true, false, 0, bytes32(0));
        }
        active = g.active && g.expiresAt > block.timestamp;
        used = g.used;
        cancelled = g.cancelled;
        repaid = g.repaid;
        expiresAt = g.expiresAt;
        payloadHash = g.x402PayloadHash;
    }

    function freeLiquidityWei() public view returns (uint256) {
        return address(this).balance > totalOutstandingWei ? address(this).balance - totalOutstandingWei : 0;
    }

    function setFeeBps(uint256 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > 5_000) revert InvalidAmount();
        feeBps = newFeeBps;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
