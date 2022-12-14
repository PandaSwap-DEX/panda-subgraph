/* eslint-disable prefer-const */
import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { Bundle, Competition, Team, User } from "../generated/schema";
import { Pair as PairTemplate } from "../generated/templates";
import { NewCompetitionStatus, UserRegister } from "../generated/TradingCompetitionV2/TradingCompetitionV2";
import {
  BD_ZERO,
  BI_ONE,
  BI_ZERO,
  getXdaiPriceInUSD,
  TRACKED_TOKEN_USDC_PAIRS,
  TRACKED_TOKEN_XDAI_PAIRS,
  WXDAI_USDC,
} from "./utils";

/**
 * BLOCK
 */

export function handleBlock(event: ethereum.Block): void {
  // Fail safe condition in case the bundle has already been created.
  let bundle = Bundle.load("1");
  if (bundle === null) {
    bundle = new Bundle("1");
    bundle.xdaiPrice = BD_ZERO;
    bundle.block = BI_ZERO;
    bundle.save();
  }
  bundle.xdaiPrice = getXdaiPriceInUSD();
  bundle.block = event.number;
  bundle.save();
}

/**
 * COMPETITION
 */

export function handleUserRegister(event: UserRegister): void {
  // Fail safe condition in case the competition has already been created.
  let competition = Competition.load(event.params.competitionId.toString());
  if (competition === null) {
    competition = new Competition(event.params.competitionId.toString());
    competition.status = BI_ZERO; // Registration
    competition.userCount = BI_ZERO;
    competition.volumeUSD = BD_ZERO;
    competition.volumeXDAI = BD_ZERO;
    competition.txCount = BI_ZERO;
    competition.save();
  }
  competition.userCount = competition.userCount.plus(BI_ONE);
  competition.save();

  // Fail safe condition in case the team has already been created.
  let team = Team.load(event.params.teamId.toString()); // Use `String` instead of `hex` to make the reconciliation simpler.
  if (team === null) {
    team = new Team(event.params.teamId.toString());
    team.userCount = BI_ZERO;
    team.volumeUSD = BD_ZERO;
    team.volumeXDAI = BD_ZERO;
    team.txCount = BI_ZERO;
    team.save();
  }
  team.userCount = team.userCount.plus(BI_ONE);
  team.save();

  // Fail safe condition in case the user has already been created.
  let user = User.load(event.params.userAddress.toHex());
  if (user === null) {
    user = new User(event.params.userAddress.toHex());
    user.competition = competition.id;
    user.team = team.id;
    user.block = event.block.number;
    user.volumeUSD = BD_ZERO;
    user.volumeXDAI = BD_ZERO;
    user.txCount = BI_ZERO;
    user.save();
  }
}

export function handleNewCompetitionStatus(event: NewCompetitionStatus): void {
  // Fail safe condition in case the competition has already been created.
  let competition = Competition.load(event.params.competitionId.toString());
  if (competition === null) {
    competition = new Competition(event.params.competitionId.toString());
    competition.status = BI_ZERO; // Registration
    competition.userCount = BI_ZERO;
    competition.volumeUSD = BD_ZERO;
    competition.volumeXDAI = BD_ZERO;
    competition.txCount = BI_ZERO;
    competition.save();
  }
  competition.status = BigInt.fromI32(event.params.status);
  competition.save();

  // Competition has opened, trigger PairCreated to follow `Swap` events.
  if (BigInt.fromI32(event.params.status).equals(BI_ONE)) {
    PairTemplate.create(Address.fromString(WXDAI_USDC));

    log.info("Created pair with address {}.", [WXDAI_USDC]);
    TRACKED_TOKEN_USDC_PAIRS.forEach((address: string) => {
      PairTemplate.create(Address.fromString(address));

      log.info("Created pair with address {}.", [address]);
    });
    TRACKED_TOKEN_XDAI_PAIRS.forEach((address: string) => {
      PairTemplate.create(Address.fromString(address));

      log.info("Created pair with address {}.", [address]);
    });
  }
}
