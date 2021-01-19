// const { expect } = require('chai');
// require('chai').should();
// const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
// const upgrades = require('@openzeppelin/truffle-upgrades');

// const ERC20 = artifacts.require("TestERC20");
// const CoFiXController = artifacts.require("CoFiXController");
// const CoFiXController02 = artifacts.require('CoFiXController02Test');

// const NEST3PriceOracleMock = artifacts.require("mock/NEST3PriceOracleMock");
// const TestUSDT = artifacts.require("test/USDT");
// const TestNEST = artifacts.require("test/NEST");

// contract('CoFiXController (proxy)', (accounts) => {
//   const admin = accounts[0];
//   const nonAdmin = accounts[1];

//   before(async function () {
//     USDT = await TestUSDT.new();
//     NEST = await TestNEST.new();
//     this.oracle = await NEST3PriceOracleMock.new(NEST.address);
//     this.controller = await upgrades.deployProxy(CoFiXController, [this.oracle.address]); // no deployer args when deployProxy in test
//   });

//   it('should read through proxy correctly', async function () {
//     let alpha = await this.controller.ALPHA({from: nonAdmin});
//     let k_base = await this.controller.K_BASE({from: nonAdmin});
//     console.log(`alpha:${alpha.toString()}, k_base:${k_base.toString()}`);
//     expect(k_base).to.bignumber.equal(new BN('100000'));
//   });

//   it('should add price to price oracle mock correctly', async function () {
//     // add enough prices in NEST3PriceOracleMock
//     let ethAmount = new BN("10000000000000000000");
//     let tokenAmount = new BN("3255000000");

//     for (let i = 0; i < 50; i++) {
//       await this.oracle.addPriceToList(USDT.address, ethAmount, tokenAmount, "0", { from: admin });
//       tokenAmount = tokenAmount.mul(new BN("1001")).div(new BN("1000")); // very stable price
//     }
//     let priceLen = await this.oracle.getPriceLength(USDT.address);
//     console.log("priceLen:", priceLen.toString(), ", tokenAmount:", tokenAmount.toString());
//     expect(priceLen).to.bignumber.equal(new BN("50"));
//   });

//   // The NEST V3 Oracle Use transfer() to send back the oracle fee change
//   // it would run into out-of-gas error when transferring to proxy contract which cost more than 2300 gas
//   // it('should call queryOracle() through proxy correctly', async function () {
//   //   let _msgValue = web3.utils.toWei('0.01', 'ether');
//   //   let result = await this.controller.queryOracle(USDT.address, admin, { from: admin, value: _msgValue });
//   //   console.log("queryOracle>receipt.gasUsed:", result.receipt.gasUsed);
//   //   let evtArgs0 = result.receipt.logs[0].args;
//   //   console.log("queryOracle>evtArgs0> K:", evtArgs0.K.toString(), ", sigma:", evtArgs0.sigma.toString(), ", T:", evtArgs0.T.toString(), ", ethAmount:", evtArgs0.ethAmount.toString(), ", erc20Amount:", evtArgs0.erc20Amount.toString());
//   // });

//   it('should upgrade correctly', async function () {
//     // must deployProxy here, could not use the one create in before setup
//     await upgrades.upgradeProxy(this.controller.address, CoFiXController02, [this.oracle.address]);
//     let alpha = await this.controller.ALPHA();
//     let k_base = await this.controller.K_BASE();
//     console.log(`alpha:${alpha.toString()}, k_base:${k_base.toString()}`);
//     expect(k_base).to.bignumber.equal(new BN('1000000'));
//   });

//   it('should not be initialized again', async function () {
//     await expectRevert(this.controller.initialize(this.oracle.address), "Contract instance has already been initialized");
//   });

// });