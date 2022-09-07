/* eslint-disable prefer-const */
import { BigDecimal, log } from "@graphprotocol/graph-ts";
import { Bundle, Competition, Team, User, PairStats } from "../generated/schema";
import { Swap } from "../generated/templates/Pair/Pair";
import {
  BD_1E18,
  BD_ZERO,
  BI_ONE,
  MOBOX_XDAI,
  MOBOX_USDC,
  TRACKED_TOKEN_XDAI_PAIRS,
  TRACKED_TOKEN_USDC_PAIRS,
} from "./utils";

/**
 * SWAP
 */

export function handleSwap(event: Swap): void {
  let competition = Competition.load("3");
  // Competition is not in progress, ignoring trade.
  if (competition.status.notEqual(BI_ONE)) {
    log.info("Competition is not in progress, ignoring trade; status: {}", [competition.status.toString()]);
    return;
  }

  // User is not registered for the competition, skipping.
  let user = User.load(event.transaction.from.toHex());
  if (user === null) {
    log.info("User is not registered, ignoring trade; user: {}", [event.transaction.from.toHex()]);
    return;
  }

  // We load other entities as the trade is doomed valid and competition is in progress.
  let bundle = Bundle.load("1");
  let team = Team.load(user.team);

  let xdaiIN: BigDecimal;
  let xdaiOUT: BigDecimal;

  let usdcIN: BigDecimal;
  let usdcOUT: BigDecimal;

  log.info("Pair info: {}, amount0In: {}, amount1In: {}, amount0Out: {}, amount1Out: {}", [
    event.address.toHex(),
    event.params.amount0In.toString(),
    event.params.amount1In.toString(),
    event.params.amount0Out.toString(),
    event.params.amount1Out.toString(),
  ]);

  if (TRACKED_TOKEN_USDC_PAIRS.includes(event.address.toHex())) {
    usdcIN = event.params.amount1In.toBigDecimal().div(BD_1E18);
    usdcOUT = event.params.amount1Out.toBigDecimal().div(BD_1E18);
    log.info("Pair found: {}, usdcIN: {}, usdcOUT: {}", [event.address.toHex(), usdcIN.toString(), usdcOUT.toString()]);
  } else if (TRACKED_TOKEN_XDAI_PAIRS.includes(event.address.toHex())) {
    xdaiIN = event.params.amount1In.toBigDecimal().div(BD_1E18);
    xdaiOUT = event.params.amount1Out.toBigDecimal().div(BD_1E18);
    log.info("Pair found: {}, xdaiIN: {}, xdaiOUT: {}", [event.address.toHex(), xdaiIN.toString(), xdaiOUT.toString()]);
  } else {
    log.info("Pair not tracked: {}", [event.address.toHex()]);
    return;
  }

  let volumeXDAI: BigDecimal;
  let volumeUSD: BigDecimal;
  if (xdaiIN) {
    volumeXDAI = xdaiOUT.plus(xdaiIN);
    volumeUSD = volumeXDAI.times(bundle.xdaiPrice);
  } else {
    volumeUSD = usdcIN.plus(usdcOUT);
    volumeXDAI = volumeUSD.div(bundle.xdaiPrice);
  }

  log.info("Volume: {} for {} XDAI, or {} USD", [
    event.transaction.from.toHex(),
    volumeXDAI.toString(),
    volumeUSD.toString(),
  ]);

  // Fail safe condition in case the pairStats has already been created.
  let pairStats = PairStats.load(event.address.toHex());
  if (pairStats === null) {
    pairStats = new PairStats(event.address.toHex());
    pairStats.volumeUSD = BD_ZERO;
    pairStats.volumeXDAI = BD_ZERO;
    pairStats.save();
  }
  pairStats.volumeUSD = pairStats.volumeUSD.plus(volumeUSD);
  pairStats.volumeXDAI = pairStats.volumeXDAI.plus(volumeXDAI);
  pairStats.save();

  user.volumeUSD = user.volumeUSD.plus(volumeUSD);
  user.volumeXDAI = user.volumeXDAI.plus(volumeXDAI);
  if (event.address.toHex() == MOBOX_XDAI || event.address.toHex() == MOBOX_USDC) {
    user.moboxVolumeUSD = user.moboxVolumeUSD.plus(volumeUSD);
    user.moboxVolumeXDAI = user.moboxVolumeXDAI.plus(volumeXDAI);
  }
  user.txCount = user.txCount.plus(BI_ONE);
  user.save();

  // Team statistics.
  team.volumeUSD = team.volumeUSD.plus(volumeUSD);
  team.volumeXDAI = team.volumeXDAI.plus(volumeXDAI);
  team.txCount = team.txCount.plus(BI_ONE);
  team.save();

  // Competition statistics.
  competition.volumeUSD = competition.volumeUSD.plus(volumeUSD);
  competition.volumeXDAI = competition.volumeXDAI.plus(volumeXDAI);
  competition.txCount = competition.txCount.plus(BI_ONE);
  competition.save();
}
