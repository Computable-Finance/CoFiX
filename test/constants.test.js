const { bytecode } = require('../build/contracts/CofiXPair.json');

const { keccak256 } = require('@ethersproject/solidity');


const {INIT_CODE_HASH} = require("../lib/constants");

const verbose = process.env.VERBOSE;

const COMPUTED_INIT_CODE_HASH = web3.utils.soliditySha3({t: 'bytes', v: `${bytecode}`});

const COMPUTED_INIT_CODE_HASH_2 = keccak256(['bytes'], [`${bytecode}`])

describe('constants', () => {
  describe('INIT_CODE_HASH', () => {
    it('matches computed bytecode hash', () => {
        if (verbose) {
          // DEBUG GitHub CI issues
            console.log("bytecode:", bytecode);
            console.log("COMPUTED_INIT_CODE_HASH:", COMPUTED_INIT_CODE_HASH);
            console.log("COMPUTED_INIT_CODE_HASH_2:", COMPUTED_INIT_CODE_HASH_2);
        }
        expect(COMPUTED_INIT_CODE_HASH).to.equal(INIT_CODE_HASH);
    })
  })
})