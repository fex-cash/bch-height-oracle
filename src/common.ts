import { Utxo } from "cashscript";
import {
    CashAddressNetworkPrefix, encodeCashAddress, CashAddressType,
    hash160, binToHex, bigIntToVmNumber, decodePrivateKeyWif, disassembleBytecodeBCH,
    secp256k1
} from '@bitauth/libauth';
function bchUtxoComparator(a: Utxo, b: Utxo): number {
    return Number(a.satoshis) > Number(b.satoshis) ? -1 : 1;
}

export function findEnoughBchUtxos(myUtxos: Utxo[], needBchVal: bigint): [Utxo[], bigint] {
    const myBchUtxos = myUtxos
        .filter(x => !x.token)
        .sort(bchUtxoComparator);
    let inputBchVal = 0n;
    let needBchUtxos = [];
    for (const bchUtxo of myBchUtxos) {
        if (inputBchVal >= needBchVal) {
            break;
        }
        needBchUtxos.push(bchUtxo);
        inputBchVal += bchUtxo.satoshis;
    }
    console.log(`inputBchAmt: ${inputBchVal}`);
    console.log(`needBchVal: ${needBchVal}`);
    console.log('needBchUtxos:', needBchUtxos);
    if (inputBchVal < needBchVal) {
        throw new Error(`Not enough bch values`);
    }

    return [needBchUtxos, inputBchVal]
}

export function wifToPrivateKey(secret: string): Uint8Array {
    let wifResult = decodePrivateKeyWif(secret);

    if (typeof wifResult === "string") {
        throw Error(wifResult as string);
    }
    return wifResult.privateKey;
}


export function height2Commitment(index: number) {
    if (index === 0) {
        return '00'
    }
    return binToHex(bigIntToVmNumber(BigInt(index)))
}


export function commitment2Height(commitment: string) {
    return Number(`0x${reverseHexBytes(commitment)}`)
}

export function reverseHexBytes(hexStr: string): string {
    if (hexStr === '') {
        return '';
    }
    if (hexStr.length % 2 !== 0) {
        hexStr = '0' + hexStr;
    }
    return hexStr.match(/[a-fA-F0-9]{2}/g)!.reverse().join('');
}


export function deriveCashaddr(
    privateKey: Uint8Array,
    networkPrefix: CashAddressNetworkPrefix,
    addrType: CashAddressType
): string {
    let publicKey = secp256k1.derivePublicKeyCompressed(privateKey);
    if (typeof publicKey === "string") {
        throw new Error(publicKey);
    }
    let pkh = hash160(publicKey);
    return encodeCashAddress(networkPrefix, addrType, pkh);
}