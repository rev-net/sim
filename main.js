/*********************************************
 * SECTION 1: IMPORTS AND CONSTANTS
 *********************************************/
import * as Plot from "@observablehq/plot";
const html = String.raw;
const solar = {
  base03: "#002b36",
  base02: "#073642",
  base01: "#586e75",
  base00: "#657b83",
  base0: "#839496",
  base1: "#93a1a1",
  base2: "#eee8d5",
  base3: "#fdf6e3",
  yellow: "#b58900",
  orange: "#cb4b16",
  red: "#dc322f",
  magenta: "#d33682",
  violet: "#6c71c4",
  blue: "#268bd2",
  cyan: "#2aa198",
  green: "#859900",
};
const helpBar = document.getElementById("help-bar");
const dashboard = document.getElementById("dashboard");
const plotStyles = {
  color: solar.base01,
  backgroundColor: solar.base3,
  fontSize: "16px",
  fontFamily: "'Times New Roman', Times, serif",
  overflow: "visible",
};

/**
 * TODO:
 * "Intelligent" LPs.
 */

/*********************************************
 * SECTION 2: UTILITY FUNCTIONS
 *********************************************/
function newLCG(seed) {
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  let currentSeed = seed;

  return function () {
    currentSeed = (a * currentSeed + c) % m;
    return currentSeed / m;
  };
}

function poissonRandomNumber(lambda, rand) {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;

  do {
    k++;
    p *= rand();
  } while (p > L);

  return k - 1;
}

function normalRandomNumber(rand) {
  return Math.sqrt(-2.0 * Math.log(rand())) * Math.cos(2.0 * Math.PI * rand());
}

function logNormRandomNumber(mu, sigma, rand) {
  return Math.exp(sigma * normalRandomNumber(rand) + mu);
}

/**
 * Converts an array of ids into an object where each id is a key and the value is the numerical value of the element with that id.
 * @param {Array} ids - An array of ids to be converted into an object.
 * @returns {Object} An object where each key is an id and the value is the numerical value of the element with that id.
 */
function objectify(ids) {
  return ids.reduce((obj, id) => {
    obj[id] = Number(document.getElementById(id).value);
    return obj;
  }, {});
}

/*********************************************
 * SECTION 3: CLASSES
 *********************************************/
class Pool {
  /**
   * Create a simplified constant product AMM liquidity pool (x*y==k).
   * @param {number} eth - The initial amount of ETH liquidity.
   * @param {number} revnetToken - The initial amount of Revnet Token liquidity.
   */
  constructor(eth, revnetToken, dayDeployed, fee) {
    this.eth = eth;
    this.revnetToken = revnetToken;
    this.dayDeployed = dayDeployed;
    this.fee = fee;

    this.ethFeesAccumulated = 0;
    this.revnetTokenFeesAccumulated = 0;
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
   * Calculate the amount of ETH the pool would need to have to fulfill a purchase spending a given amount of Revnet tokens.
   * @param {number} revnetTokenAmount - The amount of Revnet tokens.
   * @return {number} The amount of ETH that would be returned plus the fee.
   */
  getEthReturnPlusFee(revnetTokenAmount) {
    const invariant = this.eth * this.revnetToken;
    const newRevnetTokenBalance = this.revnetToken + revnetTokenAmount;
    const newEthBalance = invariant / newRevnetTokenBalance;
    return this.eth - newEthBalance;
  }

  /**
   * Calculate the amount of ETH that would be returned for a given amount of Revnet tokens.
   * @param {number} revnetTokenAmount - The amount of Revnet tokens.
   * @return {number} The amount of ETH that would be returned.
   */
  getEthReturn(revnetTokenAmount) {
    const invariant = this.eth * this.revnetToken;
    const newRevnetTokenBalance = this.revnetToken + revnetTokenAmount;
    const newEthBalance = invariant / newRevnetTokenBalance;
    return (this.eth - newEthBalance) * (1 - this.fee);
  }

  /**
   * Calculate the amount of Revnet tokens the pool would need to have to fulfill a purchase spending a given amount of ETH.
   * @param {number} ethAmount - The amount of ETH.
   * @return {number} The amount of Revnet tokens that would be returned.
   */
  getRevnetTokenReturnPlusFee(ethAmount) {
    const invariant = this.eth * this.revnetToken;
    const newEthBalance = this.eth + ethAmount;
    const newRevnetTokenBalance = invariant / newEthBalance;
    return this.revnetToken - newRevnetTokenBalance;
  }

  /**
   * Calculate the amount of Revnet tokens that would be returned for a given amount of ETH.
   * @param {number} ethAmount - The amount of ETH.
   * @return {number} The amount of Revnet tokens that would be returned.
   */
  getRevnetTokenReturn(ethAmount) {
    const invariant = this.eth * this.revnetToken;
    const newEthBalance = this.eth + ethAmount;
    const newRevnetTokenBalance = invariant / newEthBalance;
    return (this.revnetToken - newRevnetTokenBalance) * (1 - this.fee);
  }

  /**
   * Spend Revnet tokens to buy ETH.
   * @param {number} revnetTokenAmount - The amount of Revnet tokens to spend.
   * @return {number} The amount of ETH bought.
   */
  buyEth(revnetTokenAmount) {
    const invariant = this.eth * this.revnetToken;
    const newRevnetTokenBalance = this.revnetToken + revnetTokenAmount;
    const newEthBalance = invariant / newRevnetTokenBalance;
    const ethAmount = this.eth - newEthBalance;
    const ethFeeAmount = ethAmount * this.fee;
    this.revnetToken = newRevnetTokenBalance;
    this.eth = newEthBalance;
    this.ethFeesAccumulated += ethFeeAmount;
    return ethAmount - ethFeeAmount;
  }
  /**
   * Spend ETH to buy Revnet tokens.
   * @param {number} ethAmount - The amount of ETH to spend.
   * @returns {number} The amount of Revnet tokens bought.
   */
  buyRevnetTokens(ethAmount) {
    const invariant = this.eth * this.revnetToken;
    const newEthBalance = this.eth + ethAmount;
    const newRevnetTokenBalance = invariant / newEthBalance;
    const revnetTokenAmount = this.revnetToken - newRevnetTokenBalance;
    const revnetTokenFeeAmount = revnetTokenAmount * this.fee;
    this.eth = newEthBalance;
    this.revnetToken = newRevnetTokenBalance;
    this.revnetTokenFeesAccumulated += revnetTokenFeeAmount;
    return revnetTokenAmount - revnetTokenFeeAmount;
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
  }

  /**
   * Get the number of tokens created per ETH at the Revnet's current day.
   * @param {number} day The day to base the calculation off of.
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
   * @param {number} tokensBeingDestroyed The number of tokens being destroyed.
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
   * @param {number} ethAmount The amount of ETH.
   * @param {number} day The current day.
   * @return {number} The number of tokens returned to the payer.
   */
  createTokensAtCeiling(ethAmount, day) {
    const tokenAmount = ethAmount * this.getTokensCreatedPerEth(day);
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
    const ethAmount = this.getEthReclaimAmount(tokenAmount);
    this.tokenSupply -= tokenAmount;
    this.ethBalance -= ethAmount;
    return ethAmount;
  }

  /**
   * Get the current token price ceiling.
   * @return {number} The token price ceiling.
   */
  getPriceCeiling(day) {
    return 1 / this.getTokensCreatedPerEth(day);
  }
}

class Trader {
  recordPurchase(ethSpent, revnetTokensReceived, source, day) {
    this.purchase = { ethSpent, revnetTokensReceived, source, day };
  }

  recordSale(revnetTokensSpent, ethReceived, source, day) {
    this.sale = { revnetTokensSpent, ethReceived, source, day };
  }
}

class Simulator {
  constructor(revnetParams, poolParams, simParams) {
    this.revnet = new Revnet(
      revnetParams.priceCeilingIncreasePercentage,
      revnetParams.priceCeilingIncreaseFrequencyInDays,
      revnetParams.priceFloorTaxIntensity,
      revnetParams.premintAmount,
      revnetParams.boostPercent,
      revnetParams.boostDurationInDays
    );
    this.pool = new Pool(
      poolParams.eth,
      poolParams.revnetToken,
      poolParams.dayDeployed,
      poolParams.fee
    );
    this.daysToCalculate = simParams.daysToCalculate;
    this.randomnessSeed = simParams.randomnessSeed;
    this.dailyPurchasesLambda = simParams.dailyPurchasesLambda;
    this.purchaseAmountMean = simParams.purchaseAmountMean;
    this.purchaseAmountDeviation = simParams.purchaseAmountDeviation;
    this.revnetTokenLiquidityRatio = simParams.revnetTokenLiquidityRatio;
    this.ethLiquidityRatio = simParams.ethLiquidityRatio;
    this.saleProbability = simParams.saleProbability;
    this.minimumDaysHeld = simParams.minimumDaysHeld;

    /** @type {Array<Trader>} An array of traders. */
    this.traders = [];
    this.simulationResults = [];
    this.day = 0;

    if (poolParams.revnetToken > 0)
      this.revnet.tokenSupply += poolParams.revnetToken; // Add initial liquidity pool supply to outstanding token supply.
  }

  /**
   * Function to purchase Revnet tokens, routing payments to the most cost-effective option.
   * @param {number} ethSpent - The amount of ETH spent to purchase tokens.
   * @returns {number} - The number of tokens purchased.
   */
  purchaseRevnetTokens(ethSpent) {
    let source, revnetTokensReceived;
    if (
      this.day >= this.pool.dayDeployed &&
      this.pool.revnetToken > this.pool.getRevnetTokenReturnPlusFee(ethSpent) &&
      this.pool.getRevnetTokenReturn(ethSpent) >
        this.revnet.getTokensCreatedPerEth(this.day) * ethSpent
    ) {
      revnetTokensReceived = this.pool.buyRevnetTokens(ethSpent);
      if (this.day < this.revnet.boostDurationInDays) {
        const tokensToSendToBoost =
          revnetTokensReceived * this.revnet.boostPercent;
        this.revnet.tokensSentToBoost += tokensToSendToBoost;
        revnetTokensReceived -= tokensToSendToBoost;
      }
      source = "pool";
    } else {
      revnetTokensReceived = this.revnet.createTokensAtCeiling(
        ethSpent,
        this.day
      );
      source = "revnet";
    }
    return { revnetTokensReceived, source };
  }

  /**
   * Function to sell Revnet tokens, routing payments to the most cost-effective option.
   * @param {number} revnetTokensSpent - The amount of Revnet tokens spent to sell.
   * @returns {number} - The amount of ETH received from selling tokens.
   */
  sellRevnetTokens(revnetTokensSpent) {
    let source,
      ethReceived = 0;
    if (
      this.day >= this.pool.dayDeployed &&
      this.pool.eth > this.pool.getEthReturnPlusFee(revnetTokensSpent) &&
      this.pool.getEthReturn(revnetTokensSpent) >
        this.revnet.getEthReclaimAmount(revnetTokensSpent)
    ) {
      ethReceived = this.pool.buyEth(revnetTokensSpent);
      source = "pool";
    } else if (
      this.revnet.getEthReclaimAmount(revnetTokensSpent) <
      this.revnet.ethBalance
    ) {
      ethReceived = this.revnet.destroyTokensAtFloor(revnetTokensSpent);
      source = "revnet";
    }

    return { ethReceived, source };
  }

  simulate() {
    const poissonRand = newLCG(this.randomnessSeed + 2);
    const buyRand = newLCG(this.randomnessSeed);
    const sellRand = newLCG(this.randomnessSeed + 1);

    for (; this.day < this.daysToCalculate; this.day++) {
      // Make purchases
      const dailyPurchases = [];
      for (
        let i = 0;
        i < poissonRandomNumber(this.dailyPurchasesLambda, poissonRand);
        i++
      ) {
        const t = new Trader();
        const ethSpent = logNormRandomNumber(
          this.purchaseAmountMean,
          this.purchaseAmountDeviation,
          buyRand
        );
        const { revnetTokensReceived, source } =
          this.purchaseRevnetTokens(ethSpent);
        t.recordPurchase(ethSpent, revnetTokensReceived, source, this.day);
        if (this.day >= this.pool.dayDeployed)
          this.pool.provideRevnetTokens(
            this.revnetTokenLiquidityRatio * revnetTokensReceived
          );
        this.traders.push(t);
        dailyPurchases.push({ ethSpent, revnetTokensReceived, source });
      }

      // Make sales
      const dailySales = [];
      this.traders.forEach((t) => {
        if (t.sale) return;
        if (this.day < t.purchase.day + this.minimumDaysHeld) return;
        if (sellRand() < this.saleProbability) {
          const revnetTokensSpent =
            t.purchase.revnetTokensReceived *
            (1 - this.revnetTokenLiquidityRatio);
          const { ethReceived, source } =
            this.sellRevnetTokens(revnetTokensSpent);
          t.recordSale(revnetTokensSpent, ethReceived, source, this.day);
          if (this.day >= this.pool.dayDeployed)
            this.pool.provideEth(this.ethLiquidityRatio * ethReceived);
          dailySales.push({ revnetTokensSpent, ethReceived, source });
        }
      });

      // Record results
      this.simulationResults.push({
        day: this.day,
        ethBalance: this.revnet.ethBalance,
        tokenSupply: this.revnet.tokenSupply,
        priceCeiling: this.revnet.getPriceCeiling(this.day),
        priceFloor: this.revnet.getEthReclaimAmount(
          this.revnet.tokenSupply > 1 ? 1 : this.revnet.tokenSupply
        ),
        tokensSentToBoost: this.revnet.tokensSentToBoost,
        poolEthBalance: this.pool.eth,
        poolRevnetTokenBalance: this.pool.revnetToken,
        poolRevnetTokenPrice: this.pool.getMarginalPriceOfRevnetToken(),
        oneTokenReclaimAmount: this.revnet.getEthReclaimAmount(1),
        hundredTokenReclaimAmountPerToken:
          this.revnet.getEthReclaimAmount(100) / 100,
        fiveHundredTokenReclaimAmountPerToken:
          this.revnet.getEthReclaimAmount(500) / 500,
        ethFeesAccumulated: this.pool.ethFeesAccumulated,
        revnetTokenFeesAccumulated: this.pool.revnetTokenFeesAccumulated,
        dailyPurchases,
        dailySales,
      });
    }
  }
}

/*********************************************
 * SECTION 4: RUNTIME
 *********************************************/

function runSimulation() {
  const revnetParams = objectify([
    "priceCeilingIncreasePercentage",
    "priceCeilingIncreaseFrequencyInDays",
    "priceFloorTaxIntensity",
    "premintAmount",
    "boostPercent",
    "boostDurationInDays",
  ]);
  const poolParams = objectify(["eth", "revnetToken", "dayDeployed", "fee"]);
  const simParams = objectify([
    "daysToCalculate",
    "randomnessSeed",
    "dailyPurchasesLambda",
    "purchaseAmountMean",
    "purchaseAmountDeviation",
    "revnetTokenLiquidityRatio",
    "ethLiquidityRatio",
    "saleProbability",
    "minimumDaysHeld",
  ]);

  const simulator = new Simulator(revnetParams, poolParams, simParams);
  simulator.simulate();

  return [simulator.simulationResults, simulator.traders];
}

function render() {
  console.time("main");
  dashboard.innerHTML = "";

  console.time("simulate");

  const [simulationData, traders] = runSimulation();
  console.timeEnd("simulate");

  const tokenPricePlot = Plot.plot({
    title: "Revnet Token Price",
    style: plotStyles,
    marginLeft: 0,
    x: { label: "Day", insetLeft: 36 },
    y: { label: "ETH (Ξ)" },
    marks: [
      Plot.ruleY([0]),
      Plot.ruleX(
        simulationData,
        Plot.pointerX({
          x: "day",
          stroke: solar.base01,
        })
      ),
      Plot.gridY({
        strokeDasharray: "0.75,2",
        strokeOpacity: 1,
      }),
      Plot.axisY({
        tickSize: 0,
        dx: 38,
        dy: -6,
        lineAnchor: "bottom",
        tickFormat: (d, i, t) => (i === t.length - 1 ? `Ξ ${d}` : d),
      }),
      Plot.text(
        simulationData,
        Plot.pointerX({
          px: "day",
          dy: -17,
          dx: 90,
          frameAnchor: "top-left",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `AMM Price: ${d.poolRevnetTokenPrice.toFixed(2)} Ξ`,
              `Ceiling: ${d.priceCeiling.toFixed(2)} Ξ`,
              `Floor: ${d.priceFloor.toFixed(2)} Ξ`,
            ].join("    "),
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "poolRevnetTokenPrice",
        stroke: solar.blue,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "poolRevnetTokenPrice",
          dx: 3,
          text: () => "AMM Price",
          textAnchor: "start",
          fill: solar.blue,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "priceCeiling",
        stroke: solar.green,
        curve: "step-after",
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "priceCeiling",
          dx: 3,
          text: () => "Price Ceiling",
          textAnchor: "start",
          fill: solar.green,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "priceFloor",
        stroke: solar.red,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "priceFloor",
          dx: 3,
          text: () => "Price Floor",
          textAnchor: "start",
          fill: solar.red,
        })
      ),
    ],
  });
  tokenPricePlot.setAttribute(
    "data-help",
    "This chart shows the token's AMM price moving between the Revnet's price ceiling and price floor."
  );

  const revnetBalancesPlot = Plot.plot({
    title: "Revnet Balance and Token Supply",
    style: plotStyles,
    x: { label: "Day" },
    y: { label: "Amount", grid: true },
    marks: [
      Plot.text(
        simulationData,
        Plot.pointerX({
          px: "day",
          dy: -18,
          frameAnchor: "top-right",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `Total Token Supply: ${d.tokenSupply.toFixed(2)}`,
              `ETH in Revnet: ${d.ethBalance.toFixed(2)} Ξ`,
            ].join("     "),
        })
      ),
      Plot.ruleY([0]),
      Plot.ruleX(
        simulationData,
        Plot.pointerX({
          x: "day",
          stroke: solar.base01,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "tokenSupply",
        stroke: solar.red,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "tokenSupply",
          dx: 3,
          text: () => "Total Token Supply",
          textAnchor: "start",
          fill: solar.red,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "ethBalance",
        stroke: solar.blue,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "ethBalance",
          dx: 3,
          text: () => "ETH in Revnet",
          textAnchor: "start",
          fill: solar.blue,
        })
      ),
    ],
  });
  revnetBalancesPlot.setAttribute(
    "data-help",
    "The Revnet's current token supply and ETH balance over time."
  );

  const liquidityPoolPlot = Plot.plot({
    title: "Liquidity Pool Balances",
    style: plotStyles,
    x: { label: "Day" },
    y: { label: "Amount", grid: true },
    marks: [
      Plot.text(
        simulationData,
        Plot.pointerX({
          px: "day",
          dy: -18,
          frameAnchor: "top-right",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `Token Balance: ${d.poolRevnetTokenBalance.toFixed(2)}`,
              `ETH Balance: ${d.poolEthBalance.toFixed(2)} Ξ`,
            ].join("    "),
        })
      ),
      Plot.ruleY([0]),
      Plot.ruleX(
        simulationData,
        Plot.pointerX({
          x: "day",
          stroke: solar.base01,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "poolRevnetTokenBalance",
        stroke: solar.red,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "poolRevnetTokenBalance",
          dx: 3,
          text: () => "Token Balance",
          textAnchor: "start",
          fill: solar.red,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "poolEthBalance",
        stroke: solar.blue,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "poolEthBalance",
          dx: 3,
          text: () => "ETH Balance",
          textAnchor: "start",
          fill: solar.blue,
        })
      ),
    ],
  });
  liquidityPoolPlot.setAttribute(
    "data-help",
    "The liquidity pool's ETH and token balances over time."
  );

  const boostPlot = Plot.plot({
    title: "Cumulative Tokens Sent to Boost",
    style: plotStyles,
    x: { label: "Day" },
    y: { label: "Tokens", grid: true },
    marks: [
      Plot.text(
        simulationData,
        Plot.pointerX({
          px: "day",
          dy: -18,
          frameAnchor: "top-right",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `Tokens sent: ${d.tokensSentToBoost.toFixed(2)}`,
            ].join("    "),
        })
      ),
      Plot.ruleY([0]),
      Plot.ruleX(
        simulationData,
        Plot.pointerX({
          x: "day",
          stroke: solar.base01,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "tokensSentToBoost",
        stroke: solar.red,
      }),
    ],
  });
  boostPlot.setAttribute(
    "data-help",
    "The cumulative number of tokens sent to the boost address, including the premint."
  );

  const purchases = simulationData.flatMap((v) =>
    v.dailyPurchases.map((p) => {
      return { day: v.day, ...p };
    })
  );

  const sales = simulationData.flatMap((v) =>
    v.dailySales.map((s) => {
      return { day: v.day, ...s };
    })
  );

  const cumulativeTrades = [];
  const purchasesCopy = purchases.slice();
  const salesCopy = sales.slice();
  for (let i = 0; i < simulationData.length; i++) {
    let { ethSpent, revnetTokensReceived, revnetTokensSpent, ethReceived } =
      i === 0
        ? {
            ethSpent: 0,
            revnetTokensReceived: 0,
            revnetTokensSpent: 0,
            ethReceived: 0,
          }
        : cumulativeTrades[i - 1];

    while (purchasesCopy[0]?.day === i) {
      const purchaseToAdd = purchasesCopy.shift();
      ethSpent += purchaseToAdd.ethSpent;
      revnetTokensReceived += purchaseToAdd.revnetTokensReceived;
    }

    while (salesCopy[0]?.day === i) {
      const saleToAdd = salesCopy.shift();
      revnetTokensSpent += saleToAdd.revnetTokensSpent;
      ethReceived += saleToAdd.ethReceived;
    }

    cumulativeTrades.push({
      day: i,
      ethSpent,
      revnetTokensReceived,
      revnetTokensSpent,
      ethReceived,
    });
  }

  const cumulativeVolumesPlot = Plot.plot({
    title: "Cumulative Volumes (Revnet and Pool)",
    style: plotStyles,
    x: { label: "Day" },
    y: { label: "Amount", grid: true },
    marks: [
      Plot.text(
        cumulativeTrades,
        Plot.pointerX({
          px: "day",
          dy: -18,
          dx: 45,
          frameAnchor: "top-left",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `ETH Spent: ${d.ethSpent.toFixed(2)} Ξ`,
              `Tokens Received: ${d.revnetTokensReceived.toFixed(2)}`,
              `Tokens Spent: ${d.revnetTokensSpent.toFixed(2)}`,
              `ETH Recieved: ${d.ethReceived.toFixed(2)} Ξ`,
            ].join("   "),
        })
      ),
      Plot.ruleY([0]),
      Plot.ruleX(
        cumulativeTrades,
        Plot.pointerX({
          x: "day",
          stroke: solar.base01,
        })
      ),
      Plot.line(cumulativeTrades, {
        x: "day",
        y: "ethSpent",
        stroke: solar.blue,
      }),
      Plot.text(
        cumulativeTrades,
        Plot.selectLast({
          x: "day",
          y: "ethSpent",
          dx: 3,
          text: () => "ETH Spent",
          textAnchor: "start",
          fill: solar.blue,
        })
      ),
      Plot.line(cumulativeTrades, {
        x: "day",
        y: "revnetTokensReceived",
        stroke: solar.red,
      }),
      Plot.text(
        cumulativeTrades,
        Plot.selectLast({
          x: "day",
          y: "revnetTokensReceived",
          dx: 3,
          text: () => "Tokens Purchased",
          textAnchor: "start",
          fill: solar.red,
        })
      ),
      Plot.line(cumulativeTrades, {
        x: "day",
        y: "revnetTokensSpent",
        stroke: solar.green,
      }),
      Plot.text(
        cumulativeTrades,
        Plot.selectLast({
          x: "day",
          y: "revnetTokensSpent",
          dx: 3,
          text: () => "Tokens Sold",
          textAnchor: "start",
          fill: solar.green,
        })
      ),
      Plot.line(cumulativeTrades, {
        x: "day",
        y: "ethReceived",
        stroke: solar.cyan,
      }),
      Plot.text(
        cumulativeTrades,
        Plot.selectLast({
          x: "day",
          y: "ethReceived",
          dx: 3,
          text: () => "ETH Received From Sales",
          textAnchor: "start",
          fill: solar.cyan,
        })
      ),
    ],
  });
  cumulativeVolumesPlot.setAttribute(
    "data-help",
    "Totals for ETH/token spending and receiving across the Revnet and the liquidity pool."
  );

  const tokenReclaimAmountPlot = Plot.plot({
    title:
      "Reclaimable ETH Per Token at Price Floor for Different Token Amounts",
    style: plotStyles,
    x: { label: "Day" },
    y: { label: "ETH (Ξ)", grid: true },
    marks: [
      Plot.ruleY([0]),
      Plot.ruleX(
        simulationData,
        Plot.pointerX({ x: "day", stroke: solar.base01 })
      ),
      Plot.text(
        simulationData,
        Plot.pointerX({
          px: "day",
          dy: -18,
          frameAnchor: "top-right",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `1 Token -> ${d.oneTokenReclaimAmount.toFixed(2)}Ξ`,
              `100 Tokens -> ${d.hundredTokenReclaimAmountPerToken.toFixed(
                2
              )}Ξ`,
              `500 Tokens -> ${d.fiveHundredTokenReclaimAmountPerToken.toFixed(
                2
              )}Ξ`,
            ].join("    "),
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "oneTokenReclaimAmount",
        stroke: solar.green,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "oneTokenReclaimAmount",
          fill: solar.green,
          dx: 3,
          textAnchor: "start",
          text: () => "1 Token",
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "hundredTokenReclaimAmountPerToken",
        stroke: solar.violet,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "hundredTokenReclaimAmountPerToken",
          fill: solar.violet,
          dx: 3,
          textAnchor: "start",
          text: () => "100 Tokens",
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "fiveHundredTokenReclaimAmountPerToken",
        stroke: solar.cyan,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "fiveHundredTokenReclaimAmountPerToken",
          fill: solar.cyan,
          dx: 3,
          textAnchor: "start",
          text: () => "500 Tokens",
        })
      ),
    ],
  });
  tokenReclaimAmountPlot.setAttribute(
    "data-help",
    "The more tokens you destroy to reclaim ETH, the more ETH you get per token. This chart shows the ETH a reclaimer would receive per token when destroying different amounts of tokens at the price floor."
  );

  const accumulatedFeesPlot = Plot.plot({
    title: "Cumulative Revenue from Pool Fees",
    style: plotStyles,
    x: { label: "Day" },
    y: { label: "Amount", grid: true },
    marks: [
      Plot.text(
        simulationData,
        Plot.pointerX({
          px: "day",
          dy: -18,
          frameAnchor: "top-right",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `Revnet Token Fees Accumulated: ${d.revnetTokenFeesAccumulated.toFixed(
                2
              )}`,
              `ETH Fees Accumulated: ${d.ethFeesAccumulated.toFixed(2)} Ξ`,
            ].join("    "),
        })
      ),
      Plot.ruleY([0]),
      Plot.ruleX(
        simulationData,
        Plot.pointerX({
          x: "day",
          stroke: solar.base01,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "revnetTokenFeesAccumulated",
        stroke: solar.red,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "revnetTokenFeesAccumulated",
          fill: solar.red,
          dx: 3,
          textAnchor: "start",
          text: () => "Revnet Token Fees",
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "ethFeesAccumulated",
        stroke: solar.blue,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "ethFeesAccumulated",
          fill: solar.blue,
          dx: 3,
          textAnchor: "start",
          text: () => "ETH Fees",
        })
      ),
    ],
  });
  accumulatedFeesPlot.setAttribute(
    "data-help",
    "Cumulative fees accrued by liquidity providers."
  );

  const purchaseData = traders.filter((t) => t.purchase).map((t) => t.purchase);

  const purchasePlot = Plot.plot({
    title: "Purchases",
    style: plotStyles,
    grid: true,
    x: { label: "Day" },
    y: { label: "ETH Spent" },
    symbol: {
      label: "Source",
      legend: true,
      style: { background: "none", fontSize: "18px" },
    },
    color: { label: "Source", range: [solar.cyan, solar.magenta] },
    marks: [
      Plot.ruleY([0]),
      Plot.dot(purchaseData, {
        x: "day",
        y: "ethSpent",
        symbol: "source",
        stroke: "source",
        tip: true,
      }),
    ],
  });
  purchasePlot.setAttribute(
    "data-help",
    "Purchase amounts over time. Crosses were fulfilled by the Revnet, and circles were fulfilled by the liquidity pool."
  );

  const saleData = traders
    .filter((t) => t.sale)
    .map((t) => ({
      saleDay: t.sale.day,
      saleSource: t.sale.source,
      purchaseDay: t.purchase.day,
      purchaseSource: t.purchase.source,
      ethReceived: t.sale.ethReceived,
      daysHeld: t.sale.day - t.purchase.day,
      profit: t.sale.ethReceived - t.purchase.ethSpent,
      tokensPurchased: t.purchase.revnetTokensReceived,
    }));

  let avgReturn = 0,
    avgDaysHeld = 0,
    avgSaleSize = 0,
    salesThroughRevnet = 0,
    saleCount = 0,
    purchasesThroughRevnet = 0,
    avgPurchaseSize = 0,
    purchaseCount = 0;
  for (let trader of traders) {
    if (trader.purchase) {
      if (trader.purchase.source === "revnet") purchasesThroughRevnet++;
      avgPurchaseSize += trader.purchase.ethSpent;
      purchaseCount++;
    }

    if (trader.sale) {
      saleCount++;
      avgReturn += trader.sale.ethReceived - trader.purchase.ethSpent;
      avgDaysHeld += trader.sale.day - trader.purchase.day;
      avgSaleSize += trader.sale.ethReceived;
      if (trader.sale.source === "revnet") salesThroughRevnet++;
    }
  }
  avgPurchaseSize /= purchaseCount;

  avgReturn /= saleCount;
  avgDaysHeld /= saleCount;
  avgSaleSize /= saleCount;

  const salePlot = Plot.plot({
    title: "Sales",
    style: plotStyles,
    grid: true,
    x: { label: "Day" },
    y: { label: "ETH Received" },
    symbol: {
      label: "Source",
      legend: true,
      style: { background: "none", fontSize: "18px" },
    },
    color: { label: "Source", range: [solar.cyan, solar.magenta] },
    marks: [
      Plot.ruleY([0]),
      Plot.dot(saleData, {
        x: "saleDay",
        y: "ethReceived",
        symbol: "saleSource",
        stroke: "saleSource",
        tip: true,
      }),
    ],
  });
  salePlot.setAttribute(
    "data-help",
    "Sale amounts over time. Crosses were fulfilled by the Revnet, and circles were fulfilled by the liquidity pool."
  );

  const profitabilityPlot = Plot.plot({
    title: "Days Held vs. Return",
    style: plotStyles,
    grid: true,
    color: {
      scheme: "Warm",
      legend: true,
      label: "Day of Initial Purchase",
      style: { background: "none", fontSize: "12px" },
    },
    r: { label: "Tokens Purchased" },
    x: { label: "Days Held" },
    y: { label: "Return (Ξ)" },
    marks: [
      Plot.dot(saleData, {
        x: "daysHeld",
        y: "profit",
        r: "tokensPurchased",
        fill: "purchaseDay",
        tip: true,
      }),
    ],
  });
  profitabilityPlot.setAttribute(
    "data-help",
    "The x axis reflects the number of days a trader held their tokens, and the y axis reflects their return from selling. Larger dots represent greater token balances. Colors correpond to the initial purchase date."
  );

  dashboard.innerHTML += html`<table>
    <tr>
      <th>Category</th>
      <th>Value</th>
    </tr>
    <tr>
      <td>Average Return</td>
      <td>${avgReturn > 0 ? "+" : ""}${avgReturn.toFixed(2)}Ξ</td>
    </tr>
    <tr>
      <td>Purchase Count</td>
      <td>${purchaseCount}</td>
    </tr>
    <tr>
      <td>Purchases via Revnet</td>
      <td>
        ${purchasesThroughRevnet}
        (${((100 * purchasesThroughRevnet) / purchaseCount).toFixed(2)}%)
      </td>
    </tr>
    <tr>
      <td>Average Purchase Size</td>
      <td>${avgPurchaseSize.toFixed(2)}Ξ</td>
    </tr>
    <tr>
      <td>Sale Count</td>
      <td>${saleCount}</td>
    </tr>
    <tr>
      <td>Sales via Revnet</td>
      <td>
        ${salesThroughRevnet}
        (${((100 * salesThroughRevnet) / saleCount).toFixed(2)}%)
      </td>
    </tr>
    <tr>
      <td>Average Sale Size</td>
      <td>${avgSaleSize.toFixed(2)}Ξ</td>
    </tr>
    <tr>
      <td>Average Days Held</td>
      <td>${avgDaysHeld.toFixed(2)}</td>
    </tr>
  </table>`;

  [
    tokenPricePlot,
    profitabilityPlot,
    revnetBalancesPlot,
    liquidityPoolPlot,
    cumulativeVolumesPlot,
    accumulatedFeesPlot,
    purchasePlot,
    salePlot,
    tokenReclaimAmountPlot,
    boostPlot,
  ].forEach((p) => {
    dashboard.appendChild(p);

    p.addEventListener("mouseenter", function (event) {
      helpBar.textContent = event.target.getAttribute("data-help");
      helpBar.style.display = "block";
    });
    p.addEventListener("mouseleave", function () {
      helpBar.style.display = "none";
    });
  });

  console.timeEnd("main");
}

render();

document
  .querySelectorAll("input")
  .forEach((i) => i.addEventListener("input", render));

document.addEventListener("render", render);
