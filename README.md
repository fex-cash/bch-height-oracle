# Block Height Oracle for Bitcoin Cash Smart Contracts

## Background
As the cashtokens feature upgrades, developers can now write more powerful smart contracts (also called covenants) on the Bitcoin Cash.
However, due to limitations of the BCH script, for instance, `tx.time` and `tx.age` can only be compared against the upper limit rather than being read directly.
BCH smart contracts cannot read the available block height on-chain, so many DeFi applications that rely on block height cannot be implemented on BCH.
Therefore, we propose a block height oracle, which encourages developers or users within the ecosystem to input the correct block height for smart contracts to use.

## Introduction

Here is the cashscript code of block height oracle:
```cashscript
pragma cashscript ^0.9.0;

contract BlockHeightOracle(int rewardPerBlock, int fee) {
    function spend(int height) {
        require(height < 500000000);
        require(tx.time >= height);
        require(tx.inputs[this.activeInputIndex].lockingBytecode == tx.outputs[this.activeInputIndex].lockingBytecode);
        int delta = height - int(tx.inputs[this.activeInputIndex].nftCommitment);
        require(delta >= 0);
        if(delta == 0) {
            if(tx.inputs[this.activeInputIndex].value > 500000000) {
                fee = 0;
            }
            require(tx.inputs[this.activeInputIndex].value + fee <= tx.outputs[this.activeInputIndex].value);
        } else {
            require(tx.inputs[this.activeInputIndex].value - rewardPerBlock * delta <= tx.outputs[this.activeInputIndex].value);
        }
        require(height == int(tx.outputs[this.activeInputIndex].nftCommitment));
    }
}
```

Based on the code, it is clear that these oracle users can be categorized into two types of roles: oracle consumers and oracle updaters.

- Oracle consumers will be using oracle frequently, and typically the height entered by the consumers is equal to the latest height.
  Oracle consumers need to pay a small fee for each call, which is stored on the oracle covenants in order to reward oracle updaters.
  But if the stored rewards reach the limit(indicative set 5 BCH), they don't have to pay.
- Oracle updaters regularly update block height information for rewards.
  They can get `(new height - old height) * rewardPerBlock` sats rewards every time they update the block height information.

Since this covenant is permissionless, anyone can become an oracle updater.
With bounty hunters looking for profit, oracle can almost always provide the latest block height on-chain.


## Example

We have deployed the height oracle covenant on BCH `chipnet` and `mainnet` respectively:

- BCH Chipnet
  - Covenant Address: `bchtest:pqq0y9k6wr6cdud4x6fp9u889sk0t7vv4c4m3c8g3n`
  - NFT Category: `9e19e9aa75926e9329e6f30a6634ee7ad3cc9cc166df6d34284c1e2b5b47eaf3`
- BCH Mainnet
  - Covenant Address: `bitcoincash:pqq0y9k6wr6cdud4x6fp9u889sk0t7vv4c3f4l9lk0`
  - NFT Category: `f10fe0965f4b7d1b9666783bbe25ec031a876b11997e812d27d534d127db1f32`

Developers can use the above covenants directly to read BCH block heights inside smart contracts.

### Install

```bash
git clone https://github.com/fex-cash/bch-height-oracle.git
cd bch-height-oracle
yarn
```

### Command Line Usage

#### Init new height oracle
```bash
# wif: Your wif private key
# network: MAINNET or CHIPNET
# reward: reward per block for oracle updaters
ts-node scripts/cli.ts init \
      --wif=<your-wif-key> \
      --network=CHIPNET \
      --reward=1000 
```

#### Update height
```bash
# network: MAINNET or CHIPNET
# token-category: The height oracle nft category
# receiver: Your address for receiving rewards
ts-node scripts/cli.ts update-height \
    --network=CHIPNET \  
    --token-category=9e19e9aa75926e9329e6f30a6634ee7ad3cc9cc166df6d34284c1e2b5b47eaf3 \ 
    --receiver=bchtest:qz8km8s0t6rpjcyc6xk2vx5rhyf4pf46lue92sjstc  
```

#### Add reward
```bash
# wif: Your wif private key
# network: MAINNET or CHIPNET
# token-category: The height oracle nft category
# reward: The amount of bch satoshi you intend to donate to this oracle
ts-node scripts/cli.ts add-reward \
       --wif=<your-wif-key> \
       --token-category=9e19e9aa75926e9329e6f30a6634ee7ad3cc9cc166df6d34284c1e2b5b47eaf3 \
       --network=CHIPNET \
       --reward=20000
```

#### Get height
```bash
# network: MAINNET or CHIPNET
# token-category: The height oracle nft category
ts-node scripts/cli.ts height \
        --token-category=9e19e9aa75926e9329e6f30a6634ee7ad3cc9cc166df6d34284c1e2b5b47eaf3 \
        --network=CHIPNET
```

### Run the Auto-Update Bot
When the BCH block height is updated, the bot automatically updates the oracle height data.

#### Install pm2
``` bash
yarn global add pm2 
or
npm install -g pm2
```

#### Run Bot
- BCH Chipnet
  ```bash
  receiver=<your-cash-address> npm run pm2:CHIPNET
  ```

- BCH Mainnet
  ```bash
  receiver=<your-cash-address> npm run pm2
  ```

#### Stop Bot
- BCH Chipnet
  ```bash
  pm2 stop BCH-HEIGHT-ORACLE-CHIPNET
  ```

- BCH Mainnet
  ```bash
  pm2 stop BCH-HEIGHT-ORACLE-MAINNET
  ```