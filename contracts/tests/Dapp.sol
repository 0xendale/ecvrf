// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {KeepersVRFConsumer} from "../KeeperVRFConsumer.sol";

contract DappConsumer is KeepersVRFConsumer {
    constructor(
        address vrfCoordinator,
        bytes32 keyHash,
        uint16 requestConfirmations,
        uint256 upkeepInterval
    )
        KeepersVRFConsumer(
            vrfCoordinator,
            keyHash,
            requestConfirmations,
            upkeepInterval
        )
    {}

    event RandomFulfilled(
        uint256 requestId,
        uint256 randomness,
        uint256 vrfRequestCounter,
        uint256 vrfResponseCounter
    );

    function getContractState()
        external
        view
        returns (
            uint256 lastTimeStamp,
            uint256 vrfRequestCounter,
            uint256 vrfResponseCounter
        )
    {
        return (s_lastTimeStamp, s_vrfRequestCounter, s_vrfResponseCounter);
    }

    function requestRandomWords() external {
        _requestRandomWords();
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        // Check that the request exists. If not, revert.
        RequestRecord memory record = s_requests[requestId];
        // solhint-disable-next-line gas-custom-errors
        require(record.requestId == requestId, "request ID not found in map");

        // Update the randomness in the record, and increment the response counter.
        s_requests[requestId].fulfilled = true;
        s_requests[requestId].randomness = randomWords[0];
        s_vrfResponseCounter++;

        emit RandomFulfilled(
            requestId,
            randomWords[0],
            s_vrfRequestCounter,
            s_vrfResponseCounter
        );
    }
}
