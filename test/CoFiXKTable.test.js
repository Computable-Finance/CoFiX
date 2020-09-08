const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const Decimal = require('decimal.js');
const XLSX = require('xlsx');
const { calcK, convert_from_fixed_point, convert_into_fixed_point, calcRelativeDiff } = require('../lib/calc');

const CoFiXKTable = artifacts.require("CoFiXKTable");
const verbose = process.env.VERBOSE;

const errorDelta = 10 ** -15;

contract('CoFiXKTable', (accounts) => {

    const owner = accounts[0];
    let deployer = owner;
    let kData;
    const non_owner = accounts[1];


    const tLen = 91;
    const sigmaLen = 20;
    const sigmaStep = 0.00005;

    before(async () => {
        KTable = await CoFiXKTable.new({ from: deployer });
    });

    it("should read k-table.xls correctly", async () => {
        const workbook = XLSX.readFile('./data/k-table-v2.xlsx');
        const sheet_name_list = workbook.SheetNames;
        kData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
        // console.log("kData:", kData);
        expect(kData.length).to.equal(tLen);
        for (let i = 0; i < kData.length; i++) {
            expect(Object.keys(kData[i]).length).to.equal(sigmaLen+1);
            expect(kData[i].__EMPTY).to.equal(10*i);
            // for (const [key, value] of Object.entries(kData[i])) {
            //     console.log(`${key}: ${value}`);
            // }
        }
    });

    it("should revert if non_owner calc setK0 or setK0InBatch", async () => {
        await expectRevert(KTable.setK0(0, 0, 0, { from: non_owner }), "CKTable: !governance");
        await expectRevert(KTable.setK0InBatch([0], [0], [0], { from: non_owner }), "CKTable: !governance");
    });


    it("should add k data correctly", async () => {
        await KTable.setK0(0, 0, 0, { from: deployer });
        const k0 = await KTable.getK0(0, 0);
        expect(k0).to.bignumber.equal("0");
    });

    it("should setK0InBatch correctly", async () => {
        let tIdxs = [];
        let sigmaIdxs = [];
        let k0s = [];
        for (let i = 0; i < kData.length; i++) {
            const tIdx = kData[i].__EMPTY / 10;
            for (const [key, value] of Object.entries(kData[i])) {
                // console.log(`${key}: ${value}`);
                if (key == "__EMPTY") {
                    continue;
                }
                tIdxs.push(tIdx);
                let sigma = Decimal(key).div(Decimal(sigmaStep)).sub(Decimal(1));
                sigmaIdxs.push(sigma.toString());
                // console.log(`key: ${key}, Decimal(key).div(Decimal(sigmaStep)).sub(1): ${Decimal(key).div(Decimal(0.0001)).sub(1)}`);
                k0s.push(convert_into_fixed_point(value));
            }
        }
        // console.log("tIdxs:", tIdxs);
        // console.log("sigmaIdxs:", sigmaIdxs);
        // console.log("k0s:", k0s);
        // console.log("tIdxs.length:", tIdxs.length);
        // console.log("sigmaIdxs.length:", sigmaIdxs.length);
        // console.log("k0s.length:", k0s.length);
        expect(tIdxs.length).to.equal(sigmaLen*tLen);
        expect(sigmaIdxs.length).to.equal(sigmaLen*tLen);
        expect(k0s.length).to.equal(sigmaLen*tLen);

        let step = sigmaLen*10;
        let start = 0;
        let end = start+step;

        for (let i = 0; i < tIdxs.length/step; i++) {
            let subTArray = tIdxs.slice(start, end);
            let subSigmaArray = sigmaIdxs.slice(start, end);
            let subK0Array = k0s.slice(start, end);
            if (verbose) {
                console.log(`i: ${i}, subTArray.len: ${subTArray.length}, start:${start}, end:${end}`);
            }
            await KTable.setK0InBatch(subTArray, subSigmaArray, subK0Array, { from: deployer });
            start = end;
            end = start+step;
            if (end > tIdxs.length) {
                end = tIdxs.length;
            }
        }
    });

    it("should getK0 correctly", async () => {
        for (let i = 0; i < tLen; i++) {
            expect(kData[i].__EMPTY).to.equal(i*10);
            for (let j = 0; j < sigmaLen; j++) {
                const k0 = await KTable.getK0(i, j);
                const sigma = Decimal(j+1).mul(Decimal(sigmaStep)).toString();
                // console.log(`kData[i][sigma]: ${kData[i][sigma]}, i:${i}, sigma:${sigma}`);

                const expected = kData[i][sigma];
                const actual = convert_from_fixed_point(k0);

                let error = calcRelativeDiff(expected, actual);
                // console.log(`expected: ${expected}, actual:${actual}, error:${error}`);
                assert.isAtMost(error.toNumber(), errorDelta);
            }
        }
    });

    it("should revert if try to set k again", async () => {
        await expectRevert(KTable.setK0(0, 0, 0, { from: deployer }), "CKTable: already set");
    });

    it("should revert if tIdx or sigmaIdx exceed", async () => {
        await expectRevert(KTable.getK0(tLen, 0, { from: deployer }), "CKTable: tIdx must < 91");
        await expectRevert(KTable.getK0(0, sigmaLen, { from: deployer }), "CKTable: sigmaIdx must < 20");
    });
});