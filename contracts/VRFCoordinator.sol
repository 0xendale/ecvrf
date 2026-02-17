// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {VRFCoordinatorV2Interface} from "./interfaces/VRFCoordinatorInterface.sol";
import {ITypeAndVersion} from "./shared/interfaces/ITypeAndVersion.sol";
import {IERC677Receiver} from "./shared/interfaces/IERC677Receiver.sol";
import {VRF} from "./core/VRF.sol";
import {ConfirmedOwner} from "./shared/access/ConfirmedOwner.sol";
import {VRFConsumerBaseV2} from "./VRFConsumer.sol";
contract VRFCoordinatorV2 is
    VRF,
    ConfirmedOwner,
    ITypeAndVersion,
    VRFCoordinatorV2Interface,
    IERC677Receiver
{
    // We need to maintain a list of consuming addresses.
    // This bound ensures we are able to loop over them as needed.
    // Should a user require more consumers, they can use multiple subscriptions.
    uint16 public constant MAX_CONSUMERS = 100;

    // Set this maximum to 200 to give us a 56 block window to fulfill
    // the request before requiring the block hash feeder.
    uint16 public constant MAX_REQUEST_CONFIRMATIONS = 200;
    uint32 public constant MAX_NUM_WORDS = 500;
    // 5k is plenty for an EXTCODESIZE call (2600) + warm CALL (100)
    // and some arithmetic operations.
    uint256 private constant GAS_FOR_CALL_EXACT_CHECK = 5_000;
    struct RequestCommitment {
        uint64 blockNum;
        uint32 callbackGasLimit;
        uint32 numWords;
        address sender;
    }
    // Note a nonce of 0 indicates an the consumer is not assigned.
    mapping(address => uint64) /* consumer */ /* nonce */ private s_consumers;
    mapping(bytes32 => address) /* keyHash */ /* oracle */
        private s_provingKeys;
    bytes32[] private s_provingKeyHashes;
    mapping(uint256 => bytes32) /* requestID */ /* commitment */
        private s_requestCommitments;
    event ProvingKeyRegistered(bytes32 keyHash, address indexed oracle);
    event ProvingKeyDeregistered(bytes32 keyHash, address indexed oracle);
    event RandomWordsRequested(
        bytes32 indexed keyHash,
        uint64 blockNum,
        uint256 requestId,
        uint256 preSeed,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        address indexed sender
    );
    event RandomWordsFulfilled(
        uint256 indexed requestId,
        uint256 outputSeed,
        bool success
    );
    struct Config {
        uint16 minimumRequestConfirmations;
        uint32 maxGasLimit;
        // Reentrancy protection.
        bool reentrancyLock;
        // Gas to cover oracle payment after we calculate the payment.
        // We make it configurable in case those operations are repriced.
        uint32 gasAfterPaymentCalculation;
    }
    Config private s_config;

    event ConfigSet(
        uint16 minimumRequestConfirmations,
        uint32 maxGasLimit,
        uint32 gasAfterPaymentCalculation
    );

    event ConsumerAdded(address indexed consumer);
    event ConsumerRemoved(address indexed consumer);

    constructor() ConfirmedOwner(msg.sender) {}

    /**
     * @notice Registers a proving key to an oracle.
     * @param oracle address of the oracle
     * @param publicProvingKey key that oracle can use to submit vrf fulfillments
     */
    function registerProvingKey(
        address oracle,
        uint256[2] calldata publicProvingKey
    ) external onlyOwner {
        bytes32 kh = hashOfKey(publicProvingKey);
        require(
            s_provingKeys[kh] == address(0),
            "Proving key already registered"
        );
        s_provingKeys[kh] = oracle;
        s_provingKeyHashes.push(kh);
        emit ProvingKeyRegistered(kh, oracle);
    }

    /**
     * @notice Deregisters a proving key to an oracle.
     * @param publicProvingKey key that oracle can use to submit vrf fulfillments
     */
    function deregisterProvingKey(
        uint256[2] calldata publicProvingKey
    ) external onlyOwner {
        bytes32 kh = hashOfKey(publicProvingKey);
        address oracle = s_provingKeys[kh];
        require(oracle != address(0), "No such proving key");
        delete s_provingKeys[kh];
        for (uint256 i = 0; i < s_provingKeyHashes.length; i++) {
            if (s_provingKeyHashes[i] == kh) {
                bytes32 last = s_provingKeyHashes[
                    s_provingKeyHashes.length - 1
                ];
                // Copy last element and overwrite kh to be deleted with it
                s_provingKeyHashes[i] = last;
                s_provingKeyHashes.pop();
            }
        }
        emit ProvingKeyDeregistered(kh, oracle);
    }

    /**
     * @inheritdoc VRFCoordinatorV2Interface
     */
    function addConsumer(address consumer) external override onlyOwner {
        s_consumers[consumer] = 1;
        emit ConsumerAdded(consumer);
    }

    /**
     * @inheritdoc VRFCoordinatorV2Interface
     */
    function removeConsumer(address consumer) external override onlyOwner {
        delete s_consumers[consumer];
        emit ConsumerRemoved(consumer);
    }

    function getConsumer(
        address consumer
    ) external view override returns (uint64) {
        return s_consumers[consumer];
    }

    /**
     * @notice Returns the proving key hash key associated with this public key
     * @param publicKey the key to return the hash of
     */
    function hashOfKey(
        uint256[2] memory publicKey
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(publicKey));
    }

    /**
     * @notice Sets the configuration of the vrfv2 coordinator
     * @param minimumRequestConfirmations global min for request confirmations
     * @param maxGasLimit global max for request gas limit
     * @param gasAfterPaymentCalculation gas used in doing accounting after completing the gas measurement
     */
    function setConfig(
        uint16 minimumRequestConfirmations,
        uint32 maxGasLimit,
        uint32 gasAfterPaymentCalculation
    ) external onlyOwner {
        require(
            minimumRequestConfirmations <= MAX_REQUEST_CONFIRMATIONS,
            "Invalid request confirmations"
        );
        s_config = Config({
            minimumRequestConfirmations: minimumRequestConfirmations,
            maxGasLimit: maxGasLimit,
            gasAfterPaymentCalculation: gasAfterPaymentCalculation,
            reentrancyLock: false
        });
        emit ConfigSet(
            minimumRequestConfirmations,
            maxGasLimit,
            gasAfterPaymentCalculation
        );
    }

    function getConfig()
        external
        view
        returns (
            uint16 minimumRequestConfirmations,
            uint32 maxGasLimit,
            uint32 gasAfterPaymentCalculation
        )
    {
        return (
            s_config.minimumRequestConfirmations,
            s_config.maxGasLimit,
            s_config.gasAfterPaymentCalculation
        );
    }

    /**
     * @inheritdoc VRFCoordinatorV2Interface
     */
    function getRequestConfig()
        external
        view
        override
        returns (uint16, uint32, bytes32[] memory)
    {
        return (
            s_config.minimumRequestConfirmations,
            s_config.maxGasLimit,
            s_provingKeyHashes
        );
    }

    /**
     * @inheritdoc VRFCoordinatorV2Interface
     */
    function requestRandomWords(
        bytes32 keyHash,
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external override nonReentrant returns (uint256) {
        // Its important to ensure that the consumer is in fact who they say they
        // are, otherwise they could use someone else's subscription balance.
        // A nonce of 0 indicates consumer is not allocated to the sub.
        uint64 currentNonce = s_consumers[msg.sender];
        require(currentNonce != 0, "Consumer not registered");
        // Input validation using the config storage word.
        require(
            requestConfirmations >= s_config.minimumRequestConfirmations &&
                requestConfirmations <= MAX_REQUEST_CONFIRMATIONS,
            "Invalid request confirmations"
        );
        // No lower bound on the requested gas limit. A user could request 0
        // and they would simply be billed for the proof verification and wouldn't be
        // able to do anything with the random value.
        require(callbackGasLimit <= s_config.maxGasLimit, "Gas limit too big");
        require(numWords <= MAX_NUM_WORDS, "Num words too big");
        // Note we do not check whether the keyHash is valid to save gas.
        // The consequence for users is that they can send requests
        // for invalid keyHashes which will simply not be fulfilled.
        uint64 nonce = currentNonce + 1;
        (uint256 requestId, uint256 preSeed) = _computeRequestId(
            keyHash,
            msg.sender,
            nonce
        );

        uint64 blockNum = uint64(block.number);
        s_requestCommitments[requestId] = keccak256(
            abi.encode(
                requestId,
                blockNum,
                callbackGasLimit,
                numWords,
                msg.sender
            )
        );
        emit RandomWordsRequested(
            keyHash,
            blockNum,
            requestId,
            preSeed,
            requestConfirmations,
            callbackGasLimit,
            numWords,
            msg.sender
        );
        s_consumers[msg.sender] = nonce;

        return requestId;
    }

    /**
     * @notice Get request commitment
     * @param requestId id of request
     * @dev used to determine if a request is fulfilled or not
     */
    function getCommitment(uint256 requestId) external view returns (bytes32) {
        return s_requestCommitments[requestId];
    }

    function _computeRequestId(
        bytes32 keyHash,
        address sender,
        uint64 nonce
    ) private pure returns (uint256, uint256) {
        uint256 preSeed = uint256(
            keccak256(abi.encode(keyHash, sender, nonce))
        );
        return (uint256(keccak256(abi.encode(keyHash, preSeed))), preSeed);
    }

    /**
     * @dev calls target address with exactly gasAmount gas and data as calldata
     * or reverts if at least gasAmount gas is not available.
     */
    function _callWithExactGas(
        uint256 gasAmount,
        address target,
        bytes memory data
    ) private returns (bool success) {
        assembly {
            let g := gas()
            // Compute g -= GAS_FOR_CALL_EXACT_CHECK and check for underflow
            // The gas actually passed to the callee is min(gasAmount, 63//64*gas available).
            // We want to ensure that we revert if gasAmount >  63//64*gas available
            // as we do not want to provide them with less, however that check itself costs
            // gas.  GAS_FOR_CALL_EXACT_CHECK ensures we have at least enough gas to be able
            // to revert if gasAmount >  63//64*gas available.
            if lt(g, GAS_FOR_CALL_EXACT_CHECK) {
                revert(0, 0)
            }
            g := sub(g, GAS_FOR_CALL_EXACT_CHECK)
            // if g - g//64 <= gasAmount, revert
            // (we subtract g//64 because of EIP-150)
            if iszero(gt(sub(g, div(g, 64)), gasAmount)) {
                revert(0, 0)
            }
            // solidity calls check that a contract actually exists at the destination, so we do the same
            if iszero(extcodesize(target)) {
                revert(0, 0)
            }
            // call and return whether we succeeded. ignore return data
            // call(gas,addr,value,argsOffset,argsLength,retOffset,retLength)
            success := call(
                gasAmount,
                target,
                0,
                add(data, 0x20),
                mload(data),
                0,
                0
            )
        }
        return success;
    }

    function _getRandomnessFromProof(
        Proof calldata proof,
        RequestCommitment memory rc
    ) private view returns (uint256 requestId, uint256 randomness) {
        bytes32 keyHash = hashOfKey(proof.pk);
        // Only registered proving keys are permitted.
        address oracle = s_provingKeys[keyHash];
        require(oracle != address(0), "No such proving key");
        requestId = uint256(keccak256(abi.encode(keyHash, proof.seed)));
        bytes32 commitment = s_requestCommitments[requestId];
        require(commitment != bytes32(0), "No corresponding request");

        require(
            commitment ==
                keccak256(
                    abi.encode(
                        requestId,
                        rc.blockNum,
                        rc.callbackGasLimit,
                        rc.numWords,
                        rc.sender
                    )
                ),
            "Incorrect commitment"
        );

        // Check that the block number is old enough
        require(
            block.number - rc.blockNum >= s_config.minimumRequestConfirmations,
            "Not enough confirmations"
        );

        bytes32 blockHash = blockhash(rc.blockNum);
        require(blockHash != bytes32(0), "Blockhash not in store");

        // The seed actually used by the VRF machinery, mixing in the blockhash
        uint256 actualSeed = uint256(
            keccak256(abi.encodePacked(proof.seed, blockHash))
        );

        randomness = VRF._randomValueFromVRFProof(proof, actualSeed); // Reverts on failure
        return (requestId, randomness);
    }

    /*
     * @notice Fulfill a randomness request
     * @param proof contains the proof and randomness
     * @param rc request commitment pre-image, committed to at request time
     * @return payment amount billed to the subscription
     * @dev simulated offchain to determine if sufficient balance is present to fulfill the request
     */
    function fulfillRandomWords(
        Proof calldata proof,
        RequestCommitment memory rc
    ) external nonReentrant returns (bool) {
        (uint256 requestId, uint256 randomness) = _getRandomnessFromProof(
            proof,
            rc
        );

        uint256[] memory randomWords = new uint256[](rc.numWords);
        for (uint256 i = 0; i < rc.numWords; i++) {
            randomWords[i] = uint256(keccak256(abi.encode(randomness, i)));
        }

        delete s_requestCommitments[requestId];
        VRFConsumerBaseV2 v;
        bytes memory resp = abi.encodeWithSelector(
            v.rawFulfillRandomWords.selector,
            requestId,
            randomWords
        );
        // Call with explicitly the amount of callback gas requested
        // Important to not let them exhaust the gas budget and avoid oracle payment.
        // Do not allow any non-view/non-pure coordinator functions to be called
        // during the consumers callback code via reentrancyLock.
        // Note that _callWithExactGas will revert if we do not have sufficient gas
        // to give the callee their requested amount.
        s_config.reentrancyLock = true;
        bool success = _callWithExactGas(rc.callbackGasLimit, rc.sender, resp);
        s_config.reentrancyLock = false;

        emit RandomWordsFulfilled(requestId, randomness, success);
        return success;
    }

    modifier nonReentrant() {
        require(!s_config.reentrancyLock, "Reentrant");
        _;
    }

    /**
     * @notice The type and version of this contract
     * @return Type and version string
     */
    function typeAndVersion()
        external
        pure
        virtual
        override
        returns (string memory)
    {
        return "VRFCoordinatorV2 1.0.0";
    }

    function onTokenTransfer(
        address /* sender */,
        uint256 amount,
        bytes calldata data
    ) external override nonReentrant {}
}
