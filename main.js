class LiquidityPool {
  /**
   * Create a simplified AMM liquidity pool.
   * @param {number} tokenA - The initial amount of tokenA liquidity.
   * @param {number} tokenB - The initial amount of tokenB liquidity.
   */
  constructor(tokenA, tokenB) {
    this.tokenA = tokenA;
    this.tokenB = tokenB;
  }

  /**
   * @param {number} amountA - The amount of tokenA liquidity to provide.
   */
  provideTokenA(amountA) {
    this.tokenA += amountA;
  }

  /**
   * @param {number} amountB - The amount of tokenB liquidity to provide.
   */
  proveTokenB(amountB) {
    this.tokenB += amountB;
  }

  /**
   * @return {number} The price of tokenA in terms of tokenB.
   */
  getPriceOfTokenA() {
    return this.tokenB / this.tokenA;
  }

  /**
   * @return {number} The price of tokenB in terms of tokenA.
   */
  getPriceOfTokenB() {
    return this.tokenA / this.tokenB;
  }

  /**
   * Spend tokenB to buy tokenA.
   * @param {number} amountB - The amount of tokenB to spend.
   */
  buyTokenA(amountB) {
    let amountA = amountB / this.getPriceOfTokenA();
    this.tokenA -= amountA;
    this.tokenB += amountB;
  }
  /**
   * Spend tokenA to buy tokenB.
   * @param {number} amountA - The amount of tokenA to spend.
   */
  buyTokenB(amountA) {
    let amountB = amountA / this.getPriceOfTokenB();
    this.tokenB -= amountB;
    this.tokenA += amountA;
  }

  displayPool() {
    const poolData = {
      "tokenA balance": this.tokenA.toLocaleString(),
      "tokenB balance": this.tokenB.toLocaleString(),
      "tokenA price": this.getPriceOfTokenA().toLocaleString(),
      "tokenB price": this.getPriceOfTokenB().toLocaleString(),
    };
    console.table(poolData);
  }
}

class Revnet {
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

  getTokensCreatedPerEth(day) {
    return Math.pow(
        1 - this.priceCeilingIncreasePercentage,
        Math.floor(day / this.priceCeilingIncreaseFrequencyInDays)
      )
  }
  getEthReclaimAmount(tokensBeingDestroyed) {
    const ratioBeingDestroyed = tokensBeingDestroyed / this.tokenSupply;
    const intensityTerm =
      1 -
      this.priceFloorTaxIntensity +
      ratioBeingDestroyed * this.priceFloorTaxIntensity;
    return tokensBeingDestroyed * this.ethBalance * intensityTerm;
  }

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
  destroyTokensAtFloor(tokenAmount) {
    let ethAmount = this.getEthReclaimAmount(tokenAmount)
    this.tokenSupply -= tokenAmount
    this.ethBalance -= ethAmount
    return ethAmount;
  }
}

// Simulation params
const daysToCalculate = 365;
const volumeRatio = 0.03; // 0-1: The average portion of token supply which is traded over 24 hours. Typically 1-5%.
const volumeVariance = 0.5; // 0-1: The amount by which the volume fluctuates.
const volatility = 0.5; // 0-1: The range of random price changes. At 100%.
const demand = 0.5; // -1 to 1: The overall trend of price changes (negative for downward, positive for upward).
const liquidity = 0.1; // The percentage of tokens made available on secondary markets once they are purchased.