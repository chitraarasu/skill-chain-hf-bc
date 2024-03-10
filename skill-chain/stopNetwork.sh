set -ex

# Bring the test network down
pushd ../test-network
./network.sh down
popd


rm -rf wapoka-login-server/wallet/
# rm -rf application-go/keystore/