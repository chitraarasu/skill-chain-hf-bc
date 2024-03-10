set -e

# don't rewrite paths for Windows Git Bash users
export MSYS_NO_PATHCONV=1
starttime=$(date +%s)
export TIMEOUT=10
export DELAY=3

# launch network; create channel and join peer to channel
pushd ../test-network
./network.sh down

echo "Bring up network"
./network.sh up createChannel -s couchdb -ca
echo "Deploying Chaincode"
./network.sh deployCC -ccn basic -ccp ../skill-chain/skill-chain-chaincode -ccl javascript
echo "Deploying Chaincode Completed"


export PATH=${PWD}/../bin:$PATH     
export FABRIC_CFG_PATH=$PWD/../config/  


export CORE_PEER_TLS_ENABLED=true     
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051


peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllUsers"]}' | jq
# peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" -C mychannel -n basic --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" -c '{"function":"CreateUser","Args":["1","test user 1","test1", "09-07-2002","1234567892","test@gmail.com", "123456", "2023-11-09T10:37:26.031Z"]}'
# sleep 5 && peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllUsers"]}' | jq

popd
cat <<EOF

Total setup execution time : $(($(date +%s) - starttime)) secs ...

EOF
