import * as Plot from "@observablehq/plot";

class LiquidityPool {
  /**
   * Create a simplified constant product AMM liquidity pool (x*y==k).
   * @param {number} eth - The initial amount of ETH liquidity.
   * @param {number} revnetToken - The initial amount of Revnet Token liquidity.
   */
  constructor(eth, revnetToken) {
    this.eth = eth;
    this.revnetToken = revnetToken;
  }

  /**
   * @param {number} amount - The amount of ETH liquidity to provide.
   */
  provideEth(amount) {
    this.eth += amount;
  }

  /**
   * @param {number} amount - The amount of Revnet Token liquidity to provide.
   */
  provideRevnetTokens(amount) {
    this.revnetToken += amount;
  }

  /**
   * @return {number} The price of 1 ETH in terms of Revnet tokens.
   */
  getMarginalPriceOfEth() {
    return this.revnetToken / this.eth;
  }

  /**
   * @return {number} The price of 1 Revnet token in terms of ETH.
   */
  getMarginalPriceOfRevnetToken() {
    return this.eth / this.revnetToken;
  }

  /**
   * Calculate the amount of ETH that would be returned for a given amount of Revnet tokens.
   * @param {number} revnetTokenAmount - The amount of Revnet tokens.
   * @return {number} The amount of ETH that would be returned.
   */
  getEthReturn(revnetTokenAmount) {
    const invariant = this.eth * this.revnetToken;
    let newRevnetTokenBalance = this.revnetToken + revnetTokenAmount;
    let newEthBalance = invariant / newRevnetTokenBalance;
    return this.eth - newEthBalance;
  }

  /**
   * Calculate the amount of Revnet tokens that would be returned for a given amount of ETH.
   * @param {number} ethAmount - The amount of ETH.
   * @return {number} The amount of Revnet tokens that would be returned.
   */
  getRevnetTokenReturn(ethAmount) {
    const invariant = this.eth * this.revnetToken;
    let newEthBalance = this.eth + ethAmount;
    let newRevnetTokenBalance = invariant / newEthBalance;
    return this.revnetToken - newRevnetTokenBalance;
  }

  /**
   * Spend Revnet tokens to buy ETH.
   * @param {number} revnetTokenAmount - The amount of Revnet tokens to spend.
   * @return {number} The amount of ETH bought.
   */
  buyEth(revnetTokenAmount) {
    const invariant = this.eth * this.revnetToken;
    let newRevnetTokenBalance = this.revnetToken + revnetTokenAmount;
    let newEthBalance = invariant / newRevnetTokenBalance;
    let ethAmount = this.eth - newEthBalance;
    this.revnetToken = newRevnetTokenBalance;
    this.eth = newEthBalance;
    return ethAmount;
  }
  /**
   * Spend ETH to buy Revnet tokens.
   * @param {number} ethAmount - The amount of ETH to spend.
   * @returns {number} The amount of Revnet tokens bought.
   */
  buyRevnetTokens(ethAmount) {
    const invariant = this.eth * this.revnetToken;
    let newEthBalance = this.eth + ethAmount;
    let newRevnetTokenBalance = invariant / newEthBalance;
    let revnetTokenAmount = this.revnetToken - newRevnetTokenBalance;
    this.eth = newEthBalance;
    this.revnetToken = newRevnetTokenBalance;
    return revnetTokenAmount;
  }

  displayPool() {
    const poolData = {
      "ETH balance": this.eth.toLocaleString(),
      "Revnet token balance": this.revnetToken.toLocaleString(),
      "Marginal ETH price": this.getMarginalPriceOfEth().toLocaleString(),
      "Marginal Revnet token price":
        this.getMarginalPriceOfRevnetToken().toLocaleString(),
    };
    console.table(poolData);
  }
}

class Revnet {
  /**
   * Create a simplified representation of a Revnet.
   * @param {number} priceCeilingIncreasePercentage - The percentage by which token issuance is reduced at the price ceiling increase frequency. 0-1.
   * @param {number} priceCeilingIncreaseFrequencyInDays - The frequency of price ceiling increase in days. Positive integer greater than zero.
   * @param {number} priceFloorTaxIntensity - The percentage curve of the price floor tax. 0-1.
   * @param {number} premintAmount - The amount of tokens preminted to the boost. Must be >= 0.
   * @param {number} boostPercent - The percentage of tokens routed to the boost. 0-1.
   * @param {number} boostDurationInDays - The duration of the boost in days. Positive integer greater than zero.
   * @param {Date} startDate - The start date of the Revnet.
   */
  constructor(
    priceCeilingIncreasePercentage,
    priceCeilingIncreaseFrequencyInDays,
    priceFloorTaxIntensity,
    premintAmount,
    boostPercent,
    boostDurationInDays
  ) {
    this.priceCeilingIncreasePercentage = priceCeilingIncreasePercentage;
    this.priceCeilingIncreaseFrequencyInDays =
      priceCeilingIncreaseFrequencyInDays;
    this.priceFloorTaxIntensity = priceFloorTaxIntensity;
    this.premintAmount = premintAmount;
    this.boostPercent = boostPercent;
    this.boostDurationInDays = boostDurationInDays;
    this.tokensSentToBoost = premintAmount;
    this.tokenSupply = premintAmount;
    this.ethBalance = 0;
    this.day = 0; // Start at day 0
  }

  /**
   * Get the number of tokens created per ETH at the Revnet's current day.
   * @return {number} The number of tokens created per ETH.
   */
  getTokensCreatedPerEth() {
    return Math.pow(
      1 - this.priceCeilingIncreasePercentage,
      Math.floor(this.day / this.priceCeilingIncreaseFrequencyInDays)
    );
  }
  /**
   * Get the amount of ETH which can currently be reclaimed by destroying a given number of tokens.
   * @param {number} tokensBeingDestroyed - The number of tokens being destroyed.
   * @return {number} The amount of ETH which can be reclaimed.
   */
  getEthReclaimAmount(tokensBeingDestroyed) {
    const ratioBeingDestroyed = tokensBeingDestroyed / this.tokenSupply;
    const intensityTerm =
      ratioBeingDestroyed * this.priceFloorTaxIntensity +
      1 -
      this.priceFloorTaxIntensity;
    return this.ethBalance * ratioBeingDestroyed * intensityTerm;
  }

  /**
   * Create tokens at the current ceiling price by paying in ETH.
   * @param {number} ethAmount - The amount of ETH.
   * @return {number} The number of tokens returned to the payer.
   */
  createTokensAtCeiling(ethAmount) {
    let tokenAmount = ethAmount * this.getTokensCreatedPerEth();
    this.ethBalance += ethAmount;
    this.tokenSupply += tokenAmount;
    if (this.day < this.boostDurationInDays) {
      this.tokensSentToBoost += tokenAmount * this.boostPercent;
      return tokenAmount * (1 - this.boostPercent);
    } else {
      return tokenAmount;
    }
  }

  /**
   * Destroy tokens at the floor price and return the amount of ETH reclaimed.
   * @param {number} tokenAmount - The amount of tokens to destroy.
   * @return {number} The amount of ETH reclaimed.
   */
  destroyTokensAtFloor(tokenAmount) {
    let ethAmount = this.getEthReclaimAmount(tokenAmount);
    this.tokenSupply -= tokenAmount;
    this.ethBalance -= ethAmount;
    return ethAmount;
  }

  /**
   * Get the current token price ceiling.
   * @return {number} The token price ceiling.
   */
  getPriceCeiling() {
    return 1 / this.getTokensCreatedPerEth();
  }

  /**
   * TODO
   * Get the number of tokens you need to destroy to reclaim a given amount of ETH.
   * @param {number} ethAmount The amount of ETH returned.
   * @return {number} The token price floor, or the number of tokens needed to reclaim ethAmount.
   */
  getTokensNeededToClaimEthAmount(ethAmount) {
    const sqrtTerm = Math.sqrt(
      this.ethBalance *
        (4 * this.priceFloorTaxIntensity * ethAmount +
          this.ethBalance -
          2 * this.priceFloorTaxIntensity * this.ethBalance +
          this.priceFloorTaxIntensity *
            this.priceFloorTaxIntensity *
            this.ethBalance)
    );

    const x1 =
      (-this.tokenSupply * this.ethBalance +
        this.priceFloorTaxIntensity * this.tokenSupply * this.ethBalance -
        this.tokenSupply * sqrtTerm) /
      (2 * this.priceFloorTaxIntensity * this.ethBalance);
    const x2 =
      (-this.tokenSupply * this.ethBalance +
        this.priceFloorTaxIntensity * this.tokenSupply * this.ethBalance +
        this.tokenSupply * sqrtTerm) /
      (2 * this.priceFloorTaxIntensity * this.ethBalance);

    return x1 > x2 ? x1 : x2;
  }

  incrementDay() {
    this.day += 1;
  }
}

/**
 * Function to purchase Revnet tokens, routing payments to the most cost-effective option.
 * @param {number} ethSpent - The amount of ETH spent to purchase tokens.
 * @param {object} r - The Revnet object.
 * @param {object} p - The LiquidityPool object.
 * @returns {number} - The number of tokens purchased.
 */
function purchaseRevnetTokens(ethSpent, r, p) {
  if (
    p.revnetToken > p.getRevnetTokenReturn(ethSpent) &&
    p.getRevnetTokenReturn(ethSpent) > r.getTokensCreatedPerEth() * ethSpent
  ) {
    return p.buyRevnetTokens(ethSpent);
  } else {
    return r.createTokensAtCeiling(ethSpent);
  }
}

/**
 * Function to sell Revnet tokens, routing payments to the most cost-effective option.
 * @param {number} revnetTokensSpent - The amount of Revnet tokens spent to sell.
 * @param {object} r - The Revnet object.
 * @param {object} p - The LiquidityPool object.
 * @returns {number} - The amount of ETH received from selling tokens.
 */
function sellRevnetTokens(revnetTokensSpent, r, p) {
  if (
    p.eth > p.getEthReturn(revnetTokensSpent) &&
    p.getEthReturn(revnetTokensSpent) > r.getEthReclaimAmount(revnetTokensSpent)
  ) {
    return p.buyEth(revnetTokensSpent);
  } else if (r.getEthReclaimAmount(revnetTokensSpent) < r.ethBalance) {
    return r.destroyTokensAtFloor(revnetTokensSpent);
  }
  return 0;
}

function poissonRandomNumber(lambda) {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;

  do {
    k++;
    p *= Math.random();
  } while (p > L);

  return k - 1;
}

function normalRandomNumber() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function logNormRandomNumber(mu = 0, sigma = 1.5) {
  return Math.exp(mu + sigma * normalRandomNumber());
}

function randomTrial() {
  let results = [];
  for (let i = 0; i < 100; i++) {
    results.push({
      index: i,
      poisson: poissonRandomNumber(i),
      normalRandomNumber: normalRandomNumber(),
      logvar1_1: logNormRandomNumber(1, 1),
      logvar0_1: logNormRandomNumber(0, 1),
      logvar0_15: logNormRandomNumber(0, 1.5),
    });
  }

  console.table(results);
}
// randomTrial();

// Simulation metaparameters
const daysToCalculate = 100; // The number of days to simulate for (10 - 100)
const dailyTradesLambda = 5; // The lambda used in a poisson distribution for the number of daily trades
const demandTrend = 0.6; // 0 to 1: The overall trend of price changes (<0.5 downward, >0.5 upward).

const tradeAmountMean = 0; // The lognorm mean for the amount in a trade
const tradeAmountVariance = 1.5; // The lognorm variance for the amount in a trade

const revnetTokenLiquidityRatio = 0.1; // The percentage of tokens made available on secondary markets once they are purchased.
const ethLiquidityRatio = 0.1; // The percentage of eth made available on secondary markets once it is purchased

function simulate() {
  const r = new Revnet(0.02, 1, 0.33, 0, 0.1, 100);
  const p = new LiquidityPool(10, 10);
  const simulationResults = [];

  for (; r.day < daysToCalculate; r.incrementDay()) {
    let trades = [];
    for (let i = 0; i < poissonRandomNumber(dailyTradesLambda); i++) {
      let tradeAmount = logNormRandomNumber(
        tradeAmountMean,
        tradeAmountVariance
      );
      if (Math.random() < demandTrend) {
        let revnetTokensPurchased = purchaseRevnetTokens(tradeAmount, r, p);
        p.provideRevnetTokens(
          revnetTokenLiquidityRatio * revnetTokensPurchased
        );
        trades.push({
          trade: i,
          type: "buy",
          spent: tradeAmount,
          received: revnetTokensPurchased,
        });
      } else {
        let ethPurchased = sellRevnetTokens(tradeAmount, r, p);
        p.provideEth(ethLiquidityRatio * ethPurchased);
        trades.push({
          trade: i,
          type: "sell",
          spent: tradeAmount,
          received: ethPurchased,
        });
      }
    }

    simulationResults.push({
      day: r.day,
      ethBalance: r.ethBalance,
      tokenSupply: r.tokenSupply,
      priceCeiling: r.getPriceCeiling(),
      priceFloor: r.getEthReclaimAmount(1),
      tokensSentToBoost: r.tokensSentToBoost,
      poolEthBalance: p.eth,
      poolRevnetTokenBalance: p.revnetToken,
      poolRevnetTokenPrice: p.getMarginalPriceOfRevnetToken(),
      trades,
    });
  }

  console.table(simulationResults);

  return simulationResults;
}

const gruv = {
  light: "#fbf1c7",
  light1: "#ebdbb2",
  light2: "#d5c4a1",
  light3: "#bdae93",
  light4: "#a89984",
  dark: "#282828",
  dark1: "#3c3836",
  dark2: "#504945",
  dark3: "#665c54",
  dark4: "#7c6f64",
  red: "#fb4934",
  green: "#b8bb26",
  yellow: "#fabd2f",
  blue: "#83a598",
  purple: "#d3869b",
  aqua: "#8ec07c",
  orange: "#fe8019",
};

function main() {
  const dashboard = document.getElementById("dashboard");

  console.time("simulate");
  let simulationData = simulate();
  console.timeEnd("simulate");

  let plot = Plot.plot({
    title: "Revnet Token Price",
    style: {
      color: gruv.dark,
      backgroundColor: gruv.light,
      fontSize: "16px",
      fontFamily: "'Times New Roman', Times, serif",
    },
    x: { label: "Day" },
    y: { label: "ETH", grid: true },
    marks: [
      Plot.ruleY([0]),
      Plot.line(simulationData, {
        x: "day",
        y: "poolRevnetTokenPrice",
        stroke: gruv.blue,
      }),
      Plot.line(simulationData, {
        x: "day",
        y: "priceCeiling",
        stroke: gruv.green,
        curve: "step",
      }),
      Plot.line(simulationData, {
        x: "day",
        y: "priceFloor",
        stroke: gruv.red,
      }),
    ],
  });

  dashboard.appendChild(plot);
}

main();
