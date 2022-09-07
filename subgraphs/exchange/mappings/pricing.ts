/* eslint-disable prefer-const */
import { BigDecimal, Address } from "@graphprotocol/graph-ts/index";
import { Pair, Token, Bundle } from "../generated/schema";
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD } from "./utils";

let WXDAI_ADDRESS = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";
let USDC_WXDAI_PAIR = "0xAe5A3f7f2F8438247eC0FC12eD1707BE009E670c"; // created block 589414
let USDT_WXDAI_PAIR = "0x4DcE08660e259D1306d658c7af7b5c65dA624700"; // created block 648115

export function getXdaiPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdtPair = Pair.load(USDT_WXDAI_PAIR); // usdt is token0
  let usdcPair = Pair.load(USDC_WXDAI_PAIR); // usdc is token1

  if (usdcPair !== null && usdtPair !== null) {
    let totalLiquidityXDAI = usdcPair.reserve0.plus(usdtPair.reserve1);
    if (totalLiquidityXDAI.notEqual(ZERO_BD)) {
      let usdcWeight = usdcPair.reserve0.div(totalLiquidityXDAI);
      let usdtWeight = usdtPair.reserve1.div(totalLiquidityXDAI);
      return usdcPair.token1Price.times(usdcWeight).plus(usdtPair.token0Price.times(usdtWeight));
    } else {
      return ZERO_BD;
    }
  } else if (usdcPair !== null) {
    return usdcPair.token1Price;
  } else if (usdtPair !== null) {
    return usdtPair.token0Price;
  } else {
    return ZERO_BD;
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d", // WXDAI
  "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83", // USDC
  "0x4ecaba5870353805a9f068101a40e0f32ed605c6", // USDT
  "0xdd96B45877d0E8361a4DDb732da741e97f3191Ff", // BUSD
  "0x8e5bBbb09Ed1ebdE8674Cda39A0c169401db4252", // WBTC
  "0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1", // WETH
];

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_XDAI = BigDecimal.fromString("10");

/**
 * Search through graph to find derived XDAI per token.
 * @todo update to be derived XDAI (add stablecoin estimates)
 **/
export function findXdaiPerToken(token: Token): BigDecimal {
  if (token.id == WXDAI_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]));
    if (pairAddress.toHex() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHex());
      if (pair.token0 == token.id && pair.reserveXDAI.gt(MINIMUM_LIQUIDITY_THRESHOLD_XDAI)) {
        let token1 = Token.load(pair.token1);
        return pair.token1Price.times(token1.derivedXDAI as BigDecimal); // return token1 per our token * XDAI per token 1
      }
      if (pair.token1 == token.id && pair.reserveXDAI.gt(MINIMUM_LIQUIDITY_THRESHOLD_XDAI)) {
        let token0 = Token.load(pair.token0);
        return pair.token0Price.times(token0.derivedXDAI as BigDecimal); // return token0 per our token * XDAI per token 0
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedXDAI.times(bundle.xdaiPrice);
  let price1 = token1.derivedXDAI.times(bundle.xdaiPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1)).div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedXDAI.times(bundle.xdaiPrice);
  let price1 = token1.derivedXDAI.times(bundle.xdaiPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
