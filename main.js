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
  getPriceFloor(ethAmount) {
    const sqrtTerm = Math.sqrt(this.ethBalance * (4 * this.priceFloorTaxIntensity * ethAmount + this.ethBalance - 2 * this.priceFloorTaxIntensity * this.ethBalance + this.priceFloorTaxIntensity * this.priceFloorTaxIntensity * this.ethBalance))
    
    const x1 = (-this.tokenSupply * this.ethBalance + this.priceFloorTaxIntensity * this.tokenSupply * this.ethBalance - this.tokenSupply * sqrtTerm) / (2 * this.priceFloorTaxIntensity * this.ethBalance)
    const x2 = (-this.tokenSupply * this.ethBalance + this.priceFloorTaxIntensity * this.tokenSupply * this.ethBalance + this.tokenSupply * sqrtTerm) / (2 * this.priceFloorTaxIntensity * this.ethBalance)
    
    return x1 > x2 ? x1 : x2
  }

  incrementDay() {
    this.day += 1;
  }
}

// Simulation metaparameters
const daysToCalculate = 30;
const volumeRatio = 0.03; // 0-1: The average portion of token supply which is traded over 24 hours. Typically 1-5%.
const volumeVariance = 0.5; // 0-1: The amount by which the volume fluctuates.
const volatility = 0.5; // 0-1: The range of random price changes. At 100%.
const demand = 0.5; // -1 to 1: The overall trend of price changes (negative for downward, positive for upward).
const liquidityRatio = 0.1; // The percentage of tokens made available on secondary markets once they are purchased.

function main() {
  const r = new Revnet(0.02, 1, 0.33, 100, 0.1, 100);
  const p = new LiquidityPool(10, 10);
  const simulationResults = [];

  for (; r.day < daysToCalculate; r.incrementDay()) {
    // Create orders
    p.provideEth(0.02);

    // purchase
    let ethSpent = 2;
    let revnetTokensReceived;
    if (
      p.revnetToken > p.getRevnetTokenReturn(ethSpent) &&
      p.getRevnetTokenReturn(ethSpent) > r.getTokensCreatedPerEth() * ethSpent
    ) {
      revnetTokensReceived = p.buyRevnetTokens(ethSpent);
    } else {
      revnetTokensReceived = r.createTokensAtCeiling(ethSpent);
    }
    p.provideRevnetTokens(revnetTokensReceived * liquidityRatio);

    // sale
    let revnetTokensSpent = 1;
    let ethReceived;
    if (
      p.eth > p.getEthReturn(revnetTokensSpent) &&
      p.getEthReturn(revnetTokensSpent) >
        r.getEthReclaimAmount(revnetTokensSpent)
    ) {
      ethReceived = p.buyEth(revnetTokensSpent);
    } else {
      ethReceived = r.destroyTokensAtFloor(revnetTokensSpent);
    }
    // p.provideEth(ethReceived * liquidityRatio);

    simulationResults.push({
      day: r.day,
      ethBalance: r.ethBalance,
      tokenSupply: r.tokenSupply,
      priceCeiling: r.getPriceCeiling(),
      priceFloor: r.getPriceFloor(1),
      ethReclaimAmount: r.getEthReclaimAmount(1),
      tokensSentToBoost: r.tokensSentToBoost,
      poolEthBalance: p.eth,
      poolRevnetTokenBalance: p.revnetToken,
      poolRevnetTokenPrice: p.getMarginalPriceOfRevnetToken(),
    });
  }

  console.table(simulationResults);
}

function test() {
  let data = [];
  let r;
  for (r = new Revnet(0.05, 1, 0.5, 0, 0, 0); r.day < 20; r.incrementDay()) {
    r.createTokensAtCeiling(1);

    data.push({
      tokenSupply: r.tokenSupply,
      ethBalance: r.ethBalance,
      priceFloor: r.getPriceFloor(1),
      ethReclaimAmount: r.getEthReclaimAmount(1),
      priceCeiling: r.getPriceCeiling(),
    });
  }

  console.table(data);
}

console.time("simulate");
main();
// test();
console.timeEnd("simulate");
