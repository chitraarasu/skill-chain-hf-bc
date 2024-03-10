set -ex

# Bring the test network down
pushd ../test-network
./network.sh down
popd


rm -rf skill-chain-server/wallet/
# rm -rf application-go/keystore/