/* eslint-disable prefer-const */
import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Pair } from "../../generated/templates/Pair/Pair";

export let BI_ZERO = BigInt.fromI32(0);
export let BI_ONE = BigInt.fromI32(1);
export let BD_ZERO = BigDecimal.fromString("0");
export let BD_1E18 = BigDecimal.fromString("1e18");

export const WXDAI_USDC = "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16";

export let TRACKED_TOKEN_XDAI_PAIRS: string[] = [
  "0x11c0b2bb4fbb430825d07507a9e24e4c32f7704d", // LAZIO/XDAI
  "0x0a292e96abb35297786a38fdd67dc4f82689e670", // PORTO/XDAI
  "0x06043b346450bbcfde066ebc39fdc264fdffed74", // SANTOS/XDAI
  "0x0ed7e52944161450477ee417de9cd3a859b14fd0", // PANDA/XDAI
];

export let TRACKED_TOKEN_USDC_PAIRS: string[] = [
  "0xdc49a4d0ccb2615a4d44d908d92dd79866d12ed5", // LAZIO/USDC
  "0xc9e0b6eb78ff5c28fbb112f4f7cca7cfbc03e4ec", // PORTO/USDC
  "0x2ac135e73babdd747e18dcfc14583c9cbe624085", // SANTOS/USDC
  "0x804678fa97d91b974ec2af3c843270886528a9e6", // PANDA/USDC
];

export function getXdaiPriceInUSD(): BigDecimal {
  // Bind WXDAI/USDC contract to query the pair.
  let pairContract = Pair.bind(Address.fromString(WXDAI_USDC));

  // Fail-safe call to get XDAI price as USDC.
  let reserves = pairContract.try_getReserves();
  if (!reserves.reverted) {
    let reserve0 = reserves.value.value0.toBigDecimal().div(BD_1E18);
    let reserve1 = reserves.value.value1.toBigDecimal().div(BD_1E18);

    if (reserve0.notEqual(BD_ZERO)) {
      return reserve1.div(reserve0);
    }
  }

  return BD_ZERO;
}
