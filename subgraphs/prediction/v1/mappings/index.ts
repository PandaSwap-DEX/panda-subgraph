/* eslint-disable prefer-const */
import { BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { concat } from "@graphprotocol/graph-ts/helper-functions";
import { Bet, Market, Round, User } from "../generated/schema";
import {
  BetBear,
  BetBull,
  Claim,
  EndRound,
  LockRound,
  Pause,
  RatesUpdated,
  RewardsCalculated,
  StartRound,
  Unpause,
} from "../generated/Prediction/Prediction";

let ZERO_BI = BigInt.fromI32(0);
let ONE_BI = BigInt.fromI32(1);
let ZERO_BD = BigDecimal.fromString("0");
let EIGHT_BD = BigDecimal.fromString("1e8");
let EIGHTEEN_BD = BigDecimal.fromString("1e18");

// Prediction fees
let BASE_REWARD_RATE = BigInt.fromI32(3);
let BASE_TREASURY_RATE = BigInt.fromI32(97);

/**
 * PAUSE
 */

export function handlePause(event: Pause): void {
  let market = Market.load("1");
  if (market === null) {
    market = new Market("1");
    market.epoch = event.params.epoch.toString();
    market.paused = true;
    market.totalUsers = ZERO_BI;
    market.totalBets = ZERO_BI;
    market.totalBetsBull = ZERO_BI;
    market.totalBetsBear = ZERO_BI;
    market.totalXDAI = ZERO_BD;
    market.totalXDAIBull = ZERO_BD;
    market.totalXDAIBear = ZERO_BD;
    market.totalXDAITreasury = ZERO_BD;
    market.rewardRate = BASE_REWARD_RATE;
    market.treasuryRate = BASE_TREASURY_RATE;
    market.save();
  }
  market.epoch = event.params.epoch.toString();
  market.paused = true;
  market.save();

  // Pause event was called, cancelling rounds.
  let round = Round.load(event.params.epoch.toString());
  if (round !== null) {
    round.failed = true;
    round.save();

    // Also fail the previous round because it will not complete.
    let previousRound = Round.load(round.previous);
    if (previousRound !== null) {
      previousRound.failed = true;
      previousRound.save();
    }
  }
}

export function handleUnpause(event: Unpause): void {
  let market = Market.load("1");
  if (market === null) {
    market = new Market("1");
    market.epoch = event.params.epoch.toString();
    market.paused = false;
    market.totalUsers = ZERO_BI;
    market.totalBets = ZERO_BI;
    market.totalBetsBull = ZERO_BI;
    market.totalBetsBear = ZERO_BI;
    market.totalXDAI = ZERO_BD;
    market.totalXDAIBull = ZERO_BD;
    market.totalXDAIBear = ZERO_BD;
    market.totalXDAITreasury = ZERO_BD;
    market.rewardRate = BASE_REWARD_RATE;
    market.treasuryRate = BASE_TREASURY_RATE;
    market.save();
  }
  market.epoch = event.params.epoch.toString();
  market.paused = false;
  market.save();
}

/**
 * MARKET
 */

export function handleRatesUpdated(event: RatesUpdated): void {
  let market = Market.load("1");
  if (market === null) {
    market = new Market("1");
    market.epoch = event.params.epoch.toString();
    market.paused = false;
    market.totalUsers = ZERO_BI;
    market.totalBets = ZERO_BI;
    market.totalBetsBull = ZERO_BI;
    market.totalBetsBear = ZERO_BI;
    market.totalXDAI = ZERO_BD;
    market.totalXDAIBull = ZERO_BD;
    market.totalXDAIBear = ZERO_BD;
    market.totalXDAITreasury = ZERO_BD;
    market.rewardRate = BASE_REWARD_RATE;
    market.treasuryRate = BASE_TREASURY_RATE;
    market.save();
  }
  market.rewardRate = event.params.rewardRate;
  market.treasuryRate = event.params.treasuryRate;
  market.save();
}

/**
 * ROUND
 */

export function handleStartRound(event: StartRound): void {
  let market = Market.load("1");
  if (market === null) {
    market = new Market("1");
    market.epoch = event.params.epoch.toString();
    market.paused = false;
    market.totalUsers = ZERO_BI;
    market.totalBets = ZERO_BI;
    market.totalBetsBull = ZERO_BI;
    market.totalBetsBear = ZERO_BI;
    market.totalXDAI = ZERO_BD;
    market.totalXDAIBull = ZERO_BD;
    market.totalXDAIBear = ZERO_BD;
    market.totalXDAITreasury = ZERO_BD;
    market.rewardRate = BASE_REWARD_RATE;
    market.treasuryRate = BASE_TREASURY_RATE;
    market.save();
  }

  let round = Round.load(event.params.epoch.toString());
  if (round === null) {
    round = new Round(event.params.epoch.toString());
    round.epoch = event.params.epoch;
    round.previous = event.params.epoch.equals(ZERO_BI) ? null : event.params.epoch.minus(ONE_BI).toString();
    round.startAt = event.block.timestamp;
    round.startBlock = event.block.number;
    round.startHash = event.transaction.hash;
    round.totalBets = ZERO_BI;
    round.totalAmount = ZERO_BD;
    round.bullBets = ZERO_BI;
    round.bullAmount = ZERO_BD;
    round.bearBets = ZERO_BI;
    round.bearAmount = ZERO_BD;
    round.save();
  }

  market.epoch = round.id;
  market.paused = false;
  market.save();
}

export function handleLockRound(event: LockRound): void {
  let round = Round.load(event.params.epoch.toString());
  if (round === null) {
    log.error("Tried to lock round without an existing round (epoch: {}).", [event.params.epoch.toString()]);
  }

  round.lockAt = event.block.timestamp;
  round.lockBlock = event.block.number;
  round.lockHash = event.transaction.hash;
  round.lockPrice = event.params.price.divDecimal(EIGHT_BD);
  round.save();
}

export function handleEndRound(event: EndRound): void {
  let round = Round.load(event.params.epoch.toString());
  if (round === null) {
    log.error("Tried to end round without an existing round (epoch: {}).", [event.params.epoch.toString()]);
  }

  round.endAt = event.block.timestamp;
  round.endBlock = event.block.number;
  round.endHash = event.transaction.hash;
  round.closePrice = event.params.price.divDecimal(EIGHT_BD);

  // Get round result based on lock/close price.
  if (round.closePrice.equals(round.lockPrice as BigDecimal)) {
    round.position = "House";
  } else if (round.closePrice.gt(round.lockPrice as BigDecimal)) {
    round.position = "Bull";
  } else if (round.closePrice.lt(round.lockPrice as BigDecimal)) {
    round.position = "Bear";
  } else {
    round.position = null;
  }
  round.failed = false;

  round.save();
}

export function handleBetBull(event: BetBull): void {
  let market = Market.load("1");
  if (market === null) {
    log.error("Tried query market with bet (bear)", []);
  }
  market.totalBets = market.totalBets.plus(ONE_BI);
  market.totalBetsBull = market.totalBetsBull.plus(ONE_BI);
  market.totalXDAI = market.totalXDAI.plus(event.params.amount.divDecimal(EIGHTEEN_BD));
  market.totalXDAIBull = market.totalXDAIBull.plus(event.params.amount.divDecimal(EIGHTEEN_BD));
  market.save();

  let round = Round.load(event.params.currentEpoch.toString());
  if (round === null) {
    log.error("Tried to bet (bull) without an existing round (epoch: {}).", [event.params.currentEpoch.toString()]);
  }
  round.totalBets = round.totalBets.plus(ONE_BI);
  round.totalAmount = round.totalAmount.plus(event.params.amount.divDecimal(EIGHTEEN_BD));
  round.bullBets = round.bullBets.plus(ONE_BI);
  round.bullAmount = round.bullAmount.plus(event.params.amount.divDecimal(EIGHTEEN_BD));
  round.save();

  // Fail safe condition in case the user has not been created yet.
  let user = User.load(event.params.sender.toHex());
  if (user === null) {
    user = new User(event.params.sender.toHex());
    user.address = event.params.sender;
    user.createdAt = event.block.timestamp;
    user.updatedAt = event.block.timestamp;
    user.block = event.block.number;
    user.totalBets = ZERO_BI;
    user.totalXDAI = ZERO_BD;

    market.totalUsers = market.totalUsers.plus(ONE_BI);
    market.save();
  }
  user.updatedAt = event.block.timestamp;
  user.totalBets = user.totalBets.plus(ONE_BI);
  user.totalXDAI = user.totalXDAI.plus(event.params.amount.divDecimal(EIGHTEEN_BD));
  user.save();

  let betId = concat(event.params.sender, Bytes.fromI32(event.params.currentEpoch.toI32())).toHex();
  let bet = new Bet(betId);
  bet.round = round.id;
  bet.user = user.id;
  bet.hash = event.transaction.hash;
  bet.amount = event.params.amount.divDecimal(EIGHTEEN_BD);
  bet.position = "Bull";
  bet.claimed = false;
  bet.createdAt = event.block.timestamp;
  bet.updatedAt = event.block.timestamp;
  bet.block = event.block.number;
  bet.save();
}

export function handleBetBear(event: BetBear): void {
  let market = Market.load("1");
  if (market === null) {
    log.error("Tried query market with bet (bear)", []);
  }
  market.totalBets = market.totalBets.plus(ONE_BI);
  market.totalBetsBear = market.totalBetsBear.plus(ONE_BI);
  market.totalXDAI = market.totalXDAI.plus(event.params.amount.divDecimal(EIGHTEEN_BD));
  market.totalXDAIBear = market.totalXDAIBear.plus(event.params.amount.divDecimal(EIGHTEEN_BD));
  market.save();

  let round = Round.load(event.params.currentEpoch.toString());
  if (round === null) {
    log.error("Tried to bet (bear) without an existing round (epoch: {}).", [event.params.currentEpoch.toString()]);
  }
  round.totalBets = round.totalBets.plus(ONE_BI);
  round.totalAmount = round.totalAmount.plus(event.params.amount.divDecimal(EIGHTEEN_BD));
  round.bearBets = round.bearBets.plus(ONE_BI);
  round.bearAmount = round.bearAmount.plus(event.params.amount.divDecimal(EIGHTEEN_BD));
  round.save();

  // Fail safe condition in case the user has not been created yet.
  let user = User.load(event.params.sender.toHex());
  if (user === null) {
    user = new User(event.params.sender.toHex());
    user.address = event.params.sender;
    user.createdAt = event.block.timestamp;
    user.updatedAt = event.block.timestamp;
    user.block = event.block.number;
    user.totalBets = ZERO_BI;
    user.totalXDAI = ZERO_BD;

    market.totalUsers = market.totalUsers.plus(ONE_BI);
    market.save();
  }
  user.updatedAt = event.block.timestamp;
  user.totalBets = user.totalBets.plus(ONE_BI);
  user.totalXDAI = user.totalXDAI.plus(event.params.amount.divDecimal(EIGHTEEN_BD));
  user.save();

  let betId = concat(event.params.sender, Bytes.fromI32(event.params.currentEpoch.toI32())).toHex();
  let bet = new Bet(betId);
  bet.round = round.id;
  bet.user = user.id;
  bet.hash = event.transaction.hash;
  bet.amount = event.params.amount.divDecimal(EIGHTEEN_BD);
  bet.position = "Bear";
  bet.claimed = false;
  bet.createdAt = event.block.timestamp;
  bet.updatedAt = event.block.timestamp;
  bet.block = event.block.number;
  bet.save();
}

export function handleClaim(event: Claim): void {
  let betId = concat(event.params.sender, Bytes.fromI32(event.params.currentEpoch.toI32())).toHex();
  let bet = Bet.load(betId);
  if (bet !== null) {
    bet.claimed = true;
    bet.claimedAmount = event.params.amount.divDecimal(EIGHTEEN_BD);
    bet.claimedHash = event.transaction.hash;
    bet.updatedAt = event.block.timestamp;
    bet.save();
  }
}

export function handleRewardsCalculated(event: RewardsCalculated): void {
  let market = Market.load("1");
  if (market === null) {
    log.error("Tried query market after rewards were calculated for a round", []);
  }
  market.totalXDAITreasury = market.totalXDAITreasury.plus(event.params.treasuryAmount.divDecimal(EIGHTEEN_BD));
  market.save();

  let round = Round.load(event.params.epoch.toString());
  if (round === null) {
    log.error("Tried query round (epoch: {}) after rewards were calculated for a round", [
      event.params.epoch.toString(),
    ]);
  }
  round.totalAmountTreasury = event.params.treasuryAmount.divDecimal(EIGHTEEN_BD);
  round.save();
}
