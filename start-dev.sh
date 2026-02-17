#!/bin/bash

echo "🧱 Compiling contracts..."
yarn compile

echo "🚀 Deploying to testnet..."
yarn deploy --testnet

echo "🧠 Starting dev backend..."
yarn dev --testnet