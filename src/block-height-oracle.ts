import {Contract, ElectrumNetworkProvider, Network, SignatureTemplate, TransactionBuilder} from 'cashscript';
import {CashAddressNetworkPrefix, CashAddressType} from "@bitauth/libauth"
import {commitment2Height, deriveCashaddr, findEnoughBchUtxos, height2Commitment, wifToPrivateKey} from './common';
import artifact from './height_oracle.json' assert {type: 'json'};

const REWARD_PER_BLOCK = 2000n
const DEFAULT_USER_FEE = 20000n
const DEFAULT_MINER_FEE = 546n

export class BlockHeightOracle {
    provider: ElectrumNetworkProvider

    async getLatestHeight() {
        const utxo = await this.getUtxo(this.tokenCategory)
        return commitment2Height(utxo.token?.nft?.commitment!)
    }

    async updateLestHeight(receiver: string) {
        const height = await this.provider.getBlockHeight()
        console.log("Electrum height: ", height)

        const latestHeight = await this.getLatestHeight()
        console.log("oracle height: ", latestHeight)

        if (height === latestHeight) {
            console.log("Unneeded update")
            return
        }

        const utxo = await this.getUtxo(this.tokenCategory)
        console.log("old utxo: ", utxo)

        const reward = REWARD_PER_BLOCK * BigInt(height - latestHeight)
        const reamingReward = utxo.satoshis - reward
        if (reamingReward < 546n) {
            throw new Error("Reward Not Enough")
        }

        const contract = this.getBlockHeightContract()
        const details = await contract.functions
            .spend(BigInt(height))
            .from(utxo)
            .to(contract.tokenAddress, reamingReward, {
                category: utxo!.token!.category, amount: utxo!.token!.amount,
                nft: { capability: utxo!.token!.nft!.capability, commitment: height2Commitment(height) }
            })
            .to(receiver, reward - DEFAULT_MINER_FEE)
            .withHardcodedFee(DEFAULT_MINER_FEE)
            .withTime(height)
            .send();
        console.log("Update response: ", details)
        console.log("new utxo: ", await this.getUtxo(this.tokenCategory))
    }

    async init(wif: string, reward: number) {
        await this.makeUtxo0(wif, reward)

        const height = await this.provider.getBlockHeight()

        const address = await this.wifToCashAddr(wif)
        const utxos = await this.provider.getUtxos(address)
        const genesisInput = utxos.find((val) => val.vout === 0 && val.satoshis >= reward && !val.token);
        if (!genesisInput) {
            throw new Error("No suitable inputs with vout=0 available for new token genesis");
        }

        const transactionBuilder = new TransactionBuilder({ provider: this.provider });
        transactionBuilder.addInput(genesisInput, new SignatureTemplate(wifToPrivateKey(wif)).unlockP2PKH());
        transactionBuilder.addOutput({
            to: this.getBlockHeightContract().address, amount: BigInt(reward),
            token: {
                amount: 0n, category: genesisInput.txid,
                nft: { commitment: height2Commitment(height), capability: "mutable" }
            }
        })
        transactionBuilder.addOutput({ to: address, amount: genesisInput.satoshis - BigInt(reward) - DEFAULT_MINER_FEE })
        const txDetails = await transactionBuilder.setMaxFee(DEFAULT_MINER_FEE).send()
        console.log("init response: ", txDetails)
    }

    async addReward(wif: string, reward: number) {
        if (reward < DEFAULT_USER_FEE) {
            throw new Error("Reward too less")
        }

        const address = await this.wifToCashAddr(wif)

        const needBchVal = BigInt(reward) + DEFAULT_MINER_FEE
        const [needBchUtxos, inputBchVal] = findEnoughBchUtxos(await this.provider.getUtxos(address), needBchVal);


        const height = await this.provider.getBlockHeight()
        console.log("Electrum height: ", height)

        const latestHeight = await this.getLatestHeight()
        console.log("oracle height: ", latestHeight)

        const utxo = await this.getUtxo(this.tokenCategory)
        console.log("old utxo: ", utxo)

        const contract = this.getBlockHeightContract()
        const details = await contract.functions
            .spend(BigInt(height))
            .from(utxo)
            .fromP2PKH(needBchUtxos, new SignatureTemplate(wifToPrivateKey(wif)))
            .to(contract.tokenAddress, utxo.satoshis + BigInt(reward), {
                category: utxo!.token!.category, amount: utxo!.token!.amount,
                nft: { capability: utxo!.token!.nft!.capability, commitment: height2Commitment(height) }
            })
            .to(address, inputBchVal - needBchVal)
            .withHardcodedFee(DEFAULT_MINER_FEE)
            .withTime(height)
            .send();
        console.log("addReward response: ", details)
        console.log("new utxo: ", await this.getUtxo(this.tokenCategory))
    }

    constructor(private network: keyof typeof Network, private tokenCategory: string) {
        if (!Network[network]) {
            throw new Error(`Incorrenct network: ${network}`)
        }
        this.provider = new ElectrumNetworkProvider(Network[this.network]);
    }

    private getBlockHeightContract() {
        const addressType = 'p2sh20';
        return new Contract(artifact, [REWARD_PER_BLOCK, DEFAULT_USER_FEE], {provider: this.provider, addressType})
    }

    private async getUtxo(tokenCategory: string) {
        const contract = this.getBlockHeightContract()
        const utxos = await contract.getUtxos()
        const utxo = utxos.find(x => x.token?.category === tokenCategory)

        if (!utxo) {
            throw new Error("Utxo Not found")
        }
        return utxo
    }

    private async makeUtxo0(wif: string, value: number) {
        console.log('makeUtxo0, value:', value);

        const address = await this.wifToCashAddr(wif)
        const needBchVal = BigInt(value) + DEFAULT_MINER_FEE
        const [needBchUtxos, inputBchVal] = findEnoughBchUtxos(await this.provider.getUtxos(address), needBchVal);

        const transactionBuilder = new TransactionBuilder({ provider: this.provider });

        transactionBuilder.addInputs(needBchUtxos, new SignatureTemplate(wifToPrivateKey(wif)).unlockP2PKH());
        transactionBuilder.addOutput({ to: address, amount: inputBchVal - DEFAULT_MINER_FEE })
        const txDetails = await transactionBuilder.setMaxFee(DEFAULT_MINER_FEE).send()
        console.log('makeUtxo0 response:', txDetails);
    }

    private async wifToCashAddr(wif: string) {
        return deriveCashaddr(wifToPrivateKey(wif), Network[this.network] === Network.MAINNET ? CashAddressNetworkPrefix.mainnet : CashAddressNetworkPrefix.testnet, CashAddressType.p2pkh)
    }
}