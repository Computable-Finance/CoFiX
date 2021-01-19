if (process.env.MAINNET_FORK) {

    // ropsten
    /*
    router = await CoFiXRouter02.new("0x8E636BDB79752BFa2C41285535852bbBDd50b2ca", "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", "0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3")

    weth = await WETH9.at("0x59b8881812Ac484Ab78b8fc7c10b2543e079a6C3")
    usdt = await USDT.at("0x200506568C2980B4943B5EaA8713A5740eb2c98A")
    nest = await NEST.at("0xD287Bc43eCD3D892204aA3792165fe8728636E29")

    to = "0x45EE4E055612e82688e1f2c62b3A0d0DF395a7eC"

    // usdt -> weth -> nest
    usdt.approve(router.address, -1)
    router.hybridSwapExactTokensForTokens(100000000, 0, [usdt.address, weth.address, nest.address], [0, 1], to, 99999999999, {value: web3.utils.toWei("0.01", "ether")})

    // nest -> weth -> usdt
    nest.approve(router.address, -1)
    router.hybridSwapExactTokensForTokens("3000000000000000000000", 0, [nest.address, weth.address, usdt.address], [1, 0], to, 99999999999, {value: web3.utils.toWei("0.01", "ether")})

    // nest -> weth
    router.hybridSwapExactTokensForTokens("3000000000000000000000", 0, [nest.address, weth.address], [1], to, 99999999999, {value: 0})
    */


    // mainnet
    /*
    router = await CoFiXRouter02.at("0xE57130499e7f3e7fE53B1D26154850889603823e")

    weth = await WETH9.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
    usdt = await USDT.at("0xdAC17F958D2ee523a2206206994597C13D831ec7")
    mph = "0x8888801aF4d980682e47f1A9036e589479e835C5"
    to = "0xf02F6A0F347CC664fFfd55591A765F403E610d8E"

    // usdt -> weth -> mph
    usdt.approve(router.address, -1)
    router.hybridSwapExactTokensForTokens(500000000, 0, [usdt.address, weth.address, mph], [0, 1], to, 99999999999, {value: web3.utils.toWei("0.01", "ether")})
    */
}