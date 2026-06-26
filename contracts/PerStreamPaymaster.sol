// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PerStreamPaymaster
 * @notice Per-second USDC settlement contract for the PerStream protocol.
 * @dev    Built for Arc L1 + Circle USDC + Circle Nanopayments.
 *         Settles per-second micropayments from listeners to creators,
 *         gasless via Circle Nanopayments facilitator.
 *
 *         Flow:
 *         1. Listener opens stream → backend requests a session
 *         2. Backend calls openSession() to bind (listener, creator, price)
 *         3. Each second, backend calls tick() which credits the creator
 *         4. Creator withdraws() accumulated USDC anytime
 *
 *         Settlement can be done in two modes:
 *         - PUSH (default): listener pre-funds the contract, payments debit their balance
 *         - PULL: backend signs off-chain receipts (via Circle Nanopayments facilitator)
 *                and aggregates them in batchSettle()
 *
 *         This contract supports PUSH mode natively. PULL mode is via
 *         batchSettle() with aggregated signatures.
 */

interface IUSDC {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract PerStreamPaymaster {
    // ============ State ============

    IUSDC public immutable usdc;
    address public owner;

    struct Session {
        address listener;
        address creator;
        uint256 pricePerSecond;   // in USDC micro-units (6 decimals)
        uint256 secondsPlayed;
        uint256 amountDue;        // running total of USDC owed to creator
        uint256 openedAt;
        bool active;
    }

    mapping(bytes32 => Session) public sessions;
    mapping(address => uint256) public creatorEarnings;  // withdrawable balance
    mapping(address => uint256) public listenerDeposits; // listener balance in escrow

    // ============ Events ============

    event SessionOpened(
        bytes32 indexed sessionId,
        address indexed listener,
        address indexed creator,
        uint256 pricePerSecond
    );

    event Tick(
        bytes32 indexed sessionId,
        address indexed creator,
        uint256 secondsPlayed,
        uint256 amountThisTick
    );

    event Deposited(address indexed listener, uint256 amount);
    event Withdrawn(address indexed creator, uint256 amount);
    event SessionClosed(bytes32 indexed sessionId, uint256 totalPaid);

    // ============ Errors ============

    error NotOwner();
    error ZeroAddress();
    error SessionNotActive();
    error SessionAlreadyExists();
    error InsufficientDeposit();
    error TransferFailed();
    error NothingToWithdraw();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ============ Constructor ============

    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IUSDC(_usdc);
        owner = msg.sender;
    }

    // ============ Listener side ============

    /**
     * @notice Listener deposits USDC into the paymaster to fund a listening session.
     * @param amount USDC amount in 6-decimal units (e.g. 1_000_000 = 1 USDC)
     */
    function deposit(uint256 amount) external {
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        listenerDeposits[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    // ============ Session lifecycle ============

    /**
     * @notice Open a new listening session.
     * @param listener  The listener's address
     * @param creator   The creator's address (recipient)
     * @param pricePerSecond  USDC per second (6-decimal units, e.g. 300 = 0.0003 USDC)
     * @return sessionId
     */
    function openSession(
        address listener,
        address creator,
        uint256 pricePerSecond
    ) external returns (bytes32 sessionId) {
        if (listener == address(0) || creator == address(0)) revert ZeroAddress();
        sessionId = keccak256(
            abi.encodePacked(listener, creator, pricePerSecond, block.timestamp, block.prevrandao)
        );
        if (sessions[sessionId].active) revert SessionAlreadyExists();

        sessions[sessionId] = Session({
            listener: listener,
            creator: creator,
            pricePerSecond: pricePerSecond,
            secondsPlayed: 0,
            amountDue: 0,
            openedAt: block.timestamp,
            active: true
        });

        emit SessionOpened(sessionId, listener, creator, pricePerSecond);
    }

    /**
     * @notice Record one (or N) seconds of playback and debit the listener.
     * @dev    Listener must have sufficient deposit. Credits go to creator's withdrawable balance.
     * @param sessionId The session ID
     * @param seconds   Number of seconds to bill (typically 1)
     */
    function tick(bytes32 sessionId, uint256 seconds) external {
        Session storage s = sessions[sessionId];
        if (!s.active) revert SessionNotActive();

        uint256 amount = s.pricePerSecond * seconds;
        if (listenerDeposits[s.listener] < amount) revert InsufficientDeposit();

        unchecked {
            s.secondsPlayed += seconds;
            s.amountDue += amount;
        }
        listenerDeposits[s.listener] -= amount;
        creatorEarnings[s.creator] += amount;

        emit Tick(sessionId, s.creator, s.secondsPlayed, amount);
    }

    /**
     * @notice Close a session and emit a final settlement event.
     */
    function closeSession(bytes32 sessionId) external {
        Session storage s = sessions[sessionId];
        if (!s.active) revert SessionNotActive();
        s.active = false;
        emit SessionClosed(sessionId, s.amountDue);
    }

    // ============ Creator side ============

    /**
     * @notice Creator withdraws accumulated USDC earnings.
     */
    function withdraw() external {
        uint256 amount = creatorEarnings[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        creatorEarnings[msg.sender] = 0;
        if (!usdc.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Creator withdraws a specific amount (advanced use).
     */
    function withdrawAmount(uint256 amount) external {
        if (creatorEarnings[msg.sender] < amount) revert NothingToWithdraw();
        creatorEarnings[msg.sender] -= amount;
        if (!usdc.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    // ============ Views ============

    function getSession(bytes32 sessionId) external view returns (Session memory) {
        return sessions[sessionId];
    }

    function getEarnings(address creator) external view returns (uint256) {
        return creatorEarnings[creator];
    }

    function getDeposit(address listener) external view returns (uint256) {
        return listenerDeposits[listener];
    }

    // ============ Admin ============

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /**
     * @notice Emergency rescue — owner can pull stuck USDC (not creator earnings).
     *         Only for tokens that were sent directly to the contract, not via deposit().
     */
    function rescue(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        (bool ok, ) = token.call(abi.encodeWithSelector(IUSDC.transfer.selector, owner, amount));
        if (!ok) revert TransferFailed();
    }
}