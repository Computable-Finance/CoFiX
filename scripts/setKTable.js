const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const Decimal = require('decimal.js');
const XLSX = require('xlsx');
const { web3 } = require('@openzeppelin/test-environment');

const CoFiXKTable = artifacts.require("CoFiXKTable");
const verbose = process.env.VERBOSE;
const { calcK, convert_from_fixed_point, convert_into_fixed_point, calcRelativeDiff } = require('../lib/calc');
const assert = require("chai").assert;

const errorDelta = 10 ** -15;
const argv = require('yargs').argv;


module.exports = async function (callback) {
    try {
        var KTable;

        console.log(`argv> ktable=${argv.ktable}, check=${argv.validate}`);

        if (argv.ktable === "" || argv.ktable === undefined) {
            KTable = await CoFiXKTable.deployed();
        } else {
            KTable = await CoFiXKTable.at(argv.ktable);
        }

        const tLen = 91;
        const sigmaLen = 20;
        const sigmaStep = 0.00005;

        const workbook = XLSX.readFile('./data/k-table-v2.xlsx');
        const sheet_name_list = workbook.SheetNames;
        kData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
        // console.log("kData:", kData);
        expect(kData.length).to.equal(tLen);
        for (let i = 0; i < kData.length; i++) {
            expect(Object.keys(kData[i]).length).to.equal(sigmaLen + 1);
            expect(kData[i].__EMPTY).to.equal(10 * i);
        }

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
                // console.log(`key: ${key}, Decimal(key).div(Decimal(sigmaStep)).sub(1): ${Decimal(key).div(Decimal(sigmaStep)).sub(1)}`);
                k0s.push(convert_into_fixed_point(value));
            }
        }
        // console.log("tIdxs:", tIdxs);
        // console.log("sigmaIdxs:", sigmaIdxs);
        // console.log("k0s:", k0s);
        // console.log("tIdxs.length:", tIdxs.length);
        // console.log("sigmaIdxs.length:", sigmaIdxs.length);
        // console.log("k0s.length:", k0s.length);
        expect(tIdxs.length).to.equal(sigmaLen * tLen);
        expect(sigmaIdxs.length).to.equal(sigmaLen * tLen);
        expect(k0s.length).to.equal(sigmaLen * tLen);

        let step = sigmaLen * 10;
        let start = 0;
        let end = start + step;

        if (!argv.validate) {
            for (let i = 0; i < tIdxs.length / step; i++) {
                let subTArray = tIdxs.slice(start, end);
                let subSigmaArray = sigmaIdxs.slice(start, end);
                let subK0Array = k0s.slice(start, end);
                console.log(`i: ${i}, subTArray.len: ${subTArray.length}, start:${start}, end:${end}`);
                await KTable.setK0InBatch(subTArray, subSigmaArray, subK0Array);
                start = end;
                end = start + step;
                if (end > tIdxs.length) {
                    end = tIdxs.length;
                }
            }
        }

        console.log("check onchain k table");

        for (let i = 0; i < tLen; i++) {
            expect(kData[i].__EMPTY).to.equal(i*10);
            for (let j = 0; j < sigmaLen; j++) {
                const k0 = await KTable.getK0(i, j);
                const sigma = Decimal(j+1).mul(Decimal(sigmaStep)).toString();
                // console.log(`kData[i][sigma]: ${kData[i][sigma]}, i:${i}, sigma:${sigma}`);

                const expected = kData[i][sigma];
                const actual = convert_from_fixed_point(k0);

                let error = calcRelativeDiff(expected, actual);
                console.log(`i: ${i}, j: ${j}, expected: ${expected}, actual:${actual}, error:${error}`);
                assert.isAtMost(error.toNumber(), errorDelta);
            }
            console.log(`T index ${i} verified`);
        }
        console.log(`full k table verified`);

        callback();
    } catch (e) {
        callback(e);
    }
}