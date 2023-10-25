import yargs from 'yargs';
import { hideBin } from 'yargs/helpers'
import { ElectrumClient } from 'electrum-cash'
import {  BlockHeightOracle } from "../src/block-height-oracle"

yargs(hideBin(process.argv))
    .command('init', 'init covenant', (yargs) => {
        return yargs
            .option('network', { type: "string", demandOption: true, description: "network", }) // keyof typeof Network: MAINNET ｜ TESTNET3 ｜ TESTNET4 ｜ CHIPNET 
            .option('wif', { type: 'string', demandOption: true })
            .option('reward', { type: 'number', demandOption: true })
    }, async ({ network, wif, reward }) => {
        const blockHeightOracle = new BlockHeightOracle(network as any, "")
        await blockHeightOracle.init(wif, reward)
        process.exit(0);
    })

    .command('update-height', 'Update height', (yargs) => {
        return yargs
            .option('network', { type: "string", demandOption: true, description: "network", }) // keyof typeof Network: MAINNET ｜ TESTNET3 ｜ TESTNET4 ｜ CHIPNET 
            .option('token-category', { type: 'string', demandOption: true })
            .option('receiver', { type: 'string', demandOption: true })
            .option('exit', { type: "boolean", demandOption: false, default: true })
    }, async ({ network, receiver, tokenCategory, exit }) => {
        if (process.env.receiver) {
            receiver = process.env.receiver
        }

        const blockHeightOracle = new BlockHeightOracle(network as any, tokenCategory)
        await blockHeightOracle.updateLestHeight(receiver)
        if (exit) {
            process.exit(0);
        }
        const electrum: any = (blockHeightOracle.provider as any).electrum
        const electrum_: any = Object.entries(electrum.clients)[0][1]
        const connection = electrum_.connection.connection

        const newElectrum: any = new ElectrumClient('Electrum client ', '1.4.1', connection.host, connection.port, connection.scheme)
        await newElectrum.connect()
        await newElectrum.subscribe(async (data: any) => {
            console.log("blockchain.headers.subscribe: ", data)
            await blockHeightOracle.updateLestHeight(receiver)
        }, 'blockchain.headers.subscribe')
        setInterval(function () { }, 100000000)
        return
    })

    .command('add-reward', 'Add reward', (yargs) => {
        return yargs
            .option('network', { type: "string", demandOption: true, description: "network", }) // keyof typeof Network: MAINNET ｜ TESTNET3 ｜ TESTNET4 ｜ CHIPNET 
            .option('token-category', { type: 'string', demandOption: true })
            .option('wif', { type: 'string', demandOption: true })
            .option('reward', { type: 'number', demandOption: true })
    }, async ({ network, tokenCategory, wif, reward }) => {
        const blockHeight = new BlockHeightOracle(network as any, tokenCategory)
        await blockHeight.addReward(wif, reward)
        process.exit(0);
    })
    
    .command('height', 'Get height', (yargs) => {
        return yargs
            .option('network', { type: "string", demandOption: true, description: "network", }) // keyof typeof Network: MAINNET ｜ TESTNET3 ｜ TESTNET4 ｜ CHIPNET 
            .option('token-category', { type: 'string', demandOption: true })
    }, async ({ network, tokenCategory }) => {
        const blockHeightOracle = new BlockHeightOracle(network as any, tokenCategory)
        const height = await blockHeightOracle.getLatestHeight()
        console.log("LatestHeight: ", height)
        process.exit(0);
    })
    .strictCommands()
    .argv;