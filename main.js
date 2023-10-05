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
    const invariant = this.eth * this.revnetToken
    let newRevnetTokenBalance = this.revnetToken + revnetTokenAmount
    let newEthBalance = invariant / newRevnetTokenBalance
    return(this.eth - newEthBalance)
  }

  /**
   * Calculate the amount of Revnet tokens that would be returned for a given amount of ETH.
   * @param {number} ethAmount - The amount of ETH.
   * @return {number} The amount of Revnet tokens that would be returned.
   */
  getRevnetTokenReturn(ethAmount) {
    const invariant = this.eth * this.revnetToken
    let newEthBalance = this.eth + ethAmount
    let newRevnetTokenBalance = invariant / newEthBalance
    return(this.revnetToken - newRevnetTokenBalance)
  }

  /**
   * Spend Revnet tokens to buy ETH.
   * @param {number} revnetTokenAmount - The amount of Revnet tokens to spend.
   * @return {number} The amount of ETH bought.
   */
  buyEth(revnetTokenAmount) {
    const invariant = this.eth * this.revnetToken
    let newRevnetTokenBalance = this.revnetToken + revnetTokenAmount
    let newEthBalance = invariant / newRevnetTokenBalance
    let ethAmount = this.eth - newEthBalance
    this.revnetToken = newRevnetTokenBalance
    this.eth = newEthBalance
    return ethAmount
  }
  /**
   * Spend ETH to buy Revnet tokens.
   * @param {number} ethAmount - The amount of ETH to spend.
   * @returns {number} The amount of Revnet tokens bought.
   */
  buyRevnetTokens(ethAmount) {
    const invariant = this.eth * this.revnetToken
    let newEthBalance = this.eth + ethAmount
    let newRevnetTokenBalance = invariant / newEthBalance
    let revnetTokenAmount = this.revnetToken - newRevnetTokenBalance
    this.eth = newEthBalance
    this.revnetToken = newRevnetTokenBalance
    return revnetTokenAmount
  }

  displayPool() {
    const poolData = {
      "ETH balance": this.eth.toLocaleString(),
      "Revnet token balance": this.revnetToken.toLocaleString(),
      "Marginal ETH price": this.getMarginalPriceOfEth().toLocaleString(),
      "Marginal Revnet token price": this.getMarginalPriceOfRevnetToken().toLocaleString(),
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
  }

  /**
   * Get the number of tokens created per ETH at a given day.
   * @param {number} day - The day at which to calculate.
   * @return {number} The number of tokens created per ETH.
   */
  getTokensCreatedPerEth(day) {
    return Math.pow(
      1 - this.priceCeilingIncreasePercentage,
      Math.floor(day / this.priceCeilingIncreaseFrequencyInDays)
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
      1 -
      this.priceFloorTaxIntensity +
      ratioBeingDestroyed * this.priceFloorTaxIntensity;
    return tokensBeingDestroyed * this.ethBalance * intensityTerm;
  }

  /**
   * Create tokens at the ceiling price by paying in ETH.
   * @param {number} ethAmount - The amount of ETH.
   * @param {number} day - The day at which to pay.
   * @return {number} The number of tokens returned to the payer.
   */
  createTokensAtCeiling(ethAmount, day) {
    let tokenAmount = ethAmount * this.getTokensCreatedPerEth(day);
    this.ethBalance += ethAmount;
    this.tokenSupply += tokenAmount;
    if (day < this.boostDurationInDays) {
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
   * Get the token price ceiling at a given day.
   * @param {number} day - The day at which to calculate the price ceiling.
   * @return {number} The token price ceiling.
   */
  getPriceCeiling(day) {
    return 1 / this.getTokensCreatedPerEth(day);
  }

  /**
   * Get the current token price floor for a given number of tokens being destroyed.
   * @param {number} tokensBeingDestroyed - The number of tokens being destroyed.
   * @return {number} The token price floor.
   */
  getPriceFloor(tokensBeingDestroyed) {
    return 1 / this.getEthReclaimAmount(tokensBeingDestroyed);
  }
}

// Simulation metaparameters
const daysToCalculate = 365;
const volumeRatio = 0.03; // 0-1: The average portion of token supply which is traded over 24 hours. Typically 1-5%.
const volumeVariance = 0.5; // 0-1: The amount by which the volume fluctuates.
const volatility = 0.5; // 0-1: The range of random price changes. At 100%.
const demand = 0.5; // -1 to 1: The overall trend of price changes (negative for downward, positive for upward).
const liquidityRatio = 0.1; // The percentage of tokens made available on secondary markets once they are purchased.

function main() {
  const r = new Revnet(0.02, 1, 0.33, 100, 0.1, 100)
  const p = new LiquidityPool(10, 10)
  const simulationResults = []

  for(let i=0; i < daysToCalculate; i ++) {
    // Create orders
    
    // purchase
    let ethSpent = 2
    let revnetTokensReceived;
    if(r.getTokensCreatedPerEth(i) < p.getMarginalPriceOfRevnetToken()) {
      revnetTokensReceived = p.buyRevnetTokens(ethSpent)
    } else {
      revnetTokensReceived = r.createTokensAtCeiling(ethSpent)
    }
    p.provideRevnetTokens(revnetTokensReceived * liquidityRatio)
    
    // sale
    let revnetTokensSpent = 1
    let ethReceived;
    if(r.getEthReclaimAmount(revnetTokensSpent) / revnetTokensSpent > p.getMarginalPriceOfEth()) {
      ethReceived = r.destroyTokensAtFloor(revnetTokensSpent)
    } else {
      ethReceived = p.buyEth(revnetTokensSpent)
    }
    
    simulationResults.push({
      day: i,
      ethBalance: r.ethBalance,
      tokenSupply: r.tokenSupply,
      priceCeiling: r.getPriceCeiling(i),
      priceFloor: r.getPriceFloor(1),
      tokensSentToBoost: r.tokensSentToBoost,
      poolEthBalance: p.eth,
      poolRevnetTokenBalance: p.revnetToken,
      poolRevnetTokenPrice: p.getMarginalPriceOfRevnetToken(),
    })
  }
  
  console.log(simulationResults)
}

main()